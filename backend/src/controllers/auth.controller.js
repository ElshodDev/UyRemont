// =============================================
// UyRemont - Autentifikatsiya Controller
// OTP orqali kirish tizimi
// =============================================

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { randomUUID: uuidv4 } = require('crypto');
const { query, withTransaction } = require('../config/database');
const { sendOtpSms, isSmsConfigured } = require('../services/sms.service');
const { normalizePhone, optionalString, requiredString } = require('../utils/validators');
const { HttpError } = require('../middleware/errorHandler');
const { UPLOAD_DIR } = require('../middleware/upload');
const { OTP_DEV_MODE, OTP_DAILY_LIMIT, TERMS_VERSION } = require('../config/security');
const totp = require('../utils/totp');

const OTP_TTL_MS = 5 * 60 * 1000;      // Kod amal qilish muddati: 5 daqiqa
const OTP_RESEND_MS = 60 * 1000;       // Qayta yuborish oralig'i: 1 daqiqa
const OTP_MAX_ATTEMPTS = 5;            // Bitta kod uchun maksimal urinishlar
const TWO_FACTOR_TTL = '5m';           // 2FA bosqichi uchun vaqtinchalik token muddati
const TWO_FACTOR_MAX_ATTEMPTS = 5;     // Bitta 2FA bosqichida noto'g'ri kodlar soni

// Faol buyurtmasi bor foydalanuvchi hisobini o'chira olmaydi
const ACTIVE_ORDER_STATUSES = ['pending', 'searching', 'accepted', 'arrived', 'in_progress'];

// 2FA bosqichidagi urinishlar (xotirada, token muddati tugaguncha)
const twoFactorAttempts = new Map();

/**
 * OTP kodni generatsiya qilish (6 xonali, kriptografik xavfsiz)
 */
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

/**
 * JWT token yaratish. tv (token_version) oshirilsa barcha eski tokenlar bekor bo'ladi
 */
const generateToken = (user) => {
    return jwt.sign(
        { userId: user.id, tv: user.token_version || 0 },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

/**
 * Foydalanuvchining to'liq ma'lumotlari (usta profili bilan)
 */
const loadUserProfile = async (userId) => {
    const result = await query(
        `SELECT
            u.id, u.phone, u.role, u.name, u.avatar_url, u.created_at,
            u.totp_enabled, u.terms_accepted_at,
            mp.id as master_profile_id, mp.bio, mp.experience_years,
            mp.hourly_rate, mp.district, mp.city, mp.is_verified,
            mp.rating, mp.reviews_count, mp.is_available,
            COALESCE(
                (SELECT JSON_AGG(ms.specialization_id ORDER BY ms.specialization_id)
                 FROM master_specializations ms WHERE ms.master_id = mp.id),
                '[]'
            ) as specialization_ids
         FROM users u
         LEFT JOIN master_profiles mp ON mp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
    );
    return result.rows[0] || null;
};

/**
 * OTP yuborish
 * POST /api/auth/send-otp
 * Body: { phone }
 */
const sendOTP = async (req, res, next) => {
    try {
        const phone = normalizePhone(req.body.phone);

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri telefon raqam formati. +998XXXXXXXXX formatida kiriting',
            });
        }

        // SMS ham, sinov rejimi ham yo'q bo'lsa kod hech kimga yetib bormaydi
        if (!isSmsConfigured() && !OTP_DEV_MODE) {
            console.error('❌ OTP yuborilmadi: SMS (ESKIZ_*) sozlanmagan. Sinov uchun backend/.env da OTP_DEV_MODE=true qiling');
            return res.status(503).json({
                success: false,
                message: 'Kirish vaqtincha ishlamayapti: SMS xizmati sozlanmagan',
            });
        }

        // Sutkalik limit: kodni ko'p marta so'rab taxmin qilishning oldini olish
        const daily = await query(
            `SELECT COUNT(*)::int as total FROM otp_codes
             WHERE phone = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
            [phone]
        );
        if (daily.rows[0].total >= OTP_DAILY_LIMIT) {
            return res.status(429).json({
                success: false,
                message: 'Bu raqamga bugun juda ko\'p kod so\'raldi. Ertaga qayta urinib ko\'ring',
            });
        }

        // Juda tez-tez so'rov yuborilishining oldini olish
        const recent = await query(
            `SELECT created_at FROM otp_codes
             WHERE phone = $1 AND created_at > NOW() - ($2::int * INTERVAL '1 millisecond')
             ORDER BY created_at DESC LIMIT 1`,
            [phone, OTP_RESEND_MS]
        );
        if (recent.rows.length > 0) {
            const waitSeconds = Math.ceil(
                (OTP_RESEND_MS - (Date.now() - new Date(recent.rows[0].created_at).getTime())) / 1000
            );
            return res.status(429).json({
                success: false,
                message: `Kodni qayta yuborish uchun ${Math.max(waitSeconds, 1)} soniya kuting`,
                retryAfter: Math.max(waitSeconds, 1),
            });
        }

        // OTP generatsiya
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);

        // Oldingi kodlarni bekor qilish
        await query(
            'UPDATE otp_codes SET is_used = TRUE WHERE phone = $1 AND is_used = FALSE',
            [phone]
        );

        // Yangi OTP saqlash
        await query(
            'INSERT INTO otp_codes (id, phone, code, expires_at) VALUES ($1, $2, $3, $4)',
            [uuidv4(), phone, code, expiresAt]
        );

        const { delivered } = await sendOtpSms(phone, code);

        res.status(200).json({
            success: true,
            message: 'OTP kod yuborildi',
            data: {
                phone,
                expiresIn: OTP_TTL_MS / 1000,
                // Faqat aniq yoqilgan sinov rejimida (OTP_DEV_MODE=true) kod javobda qaytariladi
                ...(!delivered && OTP_DEV_MODE && { devCode: code }),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * OTP tasdiqlash va tizimga kirish
 * POST /api/auth/verify-otp
 * Body: { phone, code, name?, accept_terms }
 * 2FA yoqilgan bo'lsa token o'rniga { requires_2fa, challenge_token } qaytadi
 */
const verifyOTP = async (req, res, next) => {
    try {
        const phone = normalizePhone(req.body.phone);
        const code = typeof req.body.code === 'string' ? req.body.code.trim() : String(req.body.code || '');
        const name = optionalString(req.body.name, { max: 100, field: 'Ism' });
        const acceptTerms = req.body.accept_terms === true;

        if (!phone || !/^\d{6}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Telefon raqam va 6 xonali OTP kod kiritilishi shart',
            });
        }

        // Yangi foydalanuvchi shartlarga rozilik bermasa kod sarflanmaydi
        const known = await query('SELECT terms_accepted_at FROM users WHERE phone = $1', [phone]);
        if (!acceptTerms && (!known.rows[0] || !known.rows[0].terms_accepted_at)) {
            return res.status(400).json({
                success: false,
                code: 'TERMS_REQUIRED',
                message: 'Davom etish uchun foydalanish shartlari va maxfiylik siyosatiga rozilik bering',
            });
        }

        // Eng so'nggi faol OTP ni olish
        const otpResult = await query(
            `SELECT * FROM otp_codes
             WHERE phone = $1 AND is_used = FALSE AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [phone]
        );

        const otp = otpResult.rows[0];
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'Kod muddati o\'tgan. Yangi kod so\'rang',
            });
        }

        const codesMatch = otp.code.length === code.length
            && crypto.timingSafeEqual(Buffer.from(otp.code), Buffer.from(code));

        if (!codesMatch) {
            // Urinishlar sonini oshirish, limitdan o'tsa kodni bekor qilish
            const updated = await query(
                `UPDATE otp_codes
                 SET attempts = attempts + 1,
                     is_used = (attempts + 1 >= $2)
                 WHERE id = $1
                 RETURNING attempts`,
                [otp.id, OTP_MAX_ATTEMPTS]
            );
            const left = OTP_MAX_ATTEMPTS - updated.rows[0].attempts;
            return res.status(400).json({
                success: false,
                message: left > 0
                    ? `Noto'g'ri kod. Yana ${left} ta urinish qoldi`
                    : 'Urinishlar tugadi. Yangi kod so\'rang',
            });
        }

        const { user, isNewUser } = await withTransaction(async (client) => {
            // OTP ni ishlatilgan deb belgilash
            await client.query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1', [otp.id]);

            const existing = await client.query('SELECT * FROM users WHERE phone = $1', [phone]);
            if (existing.rows.length > 0) {
                // Ismi bo'lmagan bo'lsa ism, rozilik bermagan bo'lsa rozilikni saqlash
                const upd = await client.query(
                    `UPDATE users
                     SET name = COALESCE(name, $1),
                         terms_accepted_at = CASE WHEN $3 AND terms_accepted_at IS NULL THEN NOW() ELSE terms_accepted_at END,
                         terms_version = CASE WHEN $3 AND terms_accepted_at IS NULL THEN $4 ELSE terms_version END
                     WHERE id = $2 RETURNING *`,
                    [name, existing.rows[0].id, acceptTerms, TERMS_VERSION]
                );
                return { user: upd.rows[0], isNewUser: false };
            }

            const created = await client.query(
                `INSERT INTO users (id, phone, role, name, is_active, terms_accepted_at, terms_version)
                 VALUES ($1, $2, 'client', $3, TRUE, NOW(), $4)
                 RETURNING *`,
                [uuidv4(), phone, name, TERMS_VERSION]
            );
            return { user: created.rows[0], isNewUser: true };
        });

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Hisobingiz bloklangan. Qo\'llab-quvvatlash xizmatiga murojaat qiling',
            });
        }

        // Ikki bosqichli kirish yoqilgan bo'lsa: avval authenticator ilovasidagi kod
        if (user.totp_enabled) {
            const challengeToken = jwt.sign(
                { userId: user.id, tv: user.token_version, purpose: '2fa', jti: uuidv4() },
                process.env.JWT_SECRET,
                { expiresIn: TWO_FACTOR_TTL }
            );
            return res.status(200).json({
                success: true,
                message: 'Authenticator ilovasidagi kodni kiriting',
                data: { requires_2fa: true, challenge_token: challengeToken },
            });
        }

        // JWT token yaratish
        const token = generateToken(user);

        res.status(200).json({
            success: true,
            message: isNewUser ? 'Ro\'yxatdan o\'tdingiz' : 'Tizimga kirdingiz',
            data: {
                token,
                user: await loadUserProfile(user.id),
                isNewUser,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Joriy foydalanuvchi ma'lumotlari
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
    try {
        const user = await loadUserProfile(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi',
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Shaxsiy ma'lumotlarni yangilash
 * PUT /api/auth/me
 * Body: { name }
 */
const updateMe = async (req, res, next) => {
    try {
        const name = requiredString(req.body.name, { min: 2, max: 100, field: 'Ism' });

        await query('UPDATE users SET name = $1 WHERE id = $2', [name, req.user.id]);

        res.status(200).json({
            success: true,
            message: 'Ma\'lumotlar saqlandi',
            data: await loadUserProfile(req.user.id),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Rolni yangilash (client <-> master)
 * PUT /api/auth/set-role
 * Body: { role }
 */
const setRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        const userId = req.user.id;

        if (!['client', 'master'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri rol',
            });
        }

        if (req.user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Administrator rolini bu yerda o\'zgartirib bo\'lmaydi',
            });
        }

        await withTransaction(async (client) => {
            await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

            // Agar master bo'lsa, profil yaratish
            if (role === 'master') {
                await client.query(
                    `INSERT INTO master_profiles (id, user_id) VALUES ($1, $2)
                     ON CONFLICT (user_id) DO NOTHING`,
                    [uuidv4(), userId]
                );
            }
        });

        res.status(200).json({
            success: true,
            message: 'Rol yangilandi',
            data: await loadUserProfile(userId),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2FA: kirishning ikkinchi bosqichi
 * POST /api/auth/2fa/verify
 * Body: { challenge_token, code }
 */
const verifyTwoFactorLogin = async (req, res, next) => {
    try {
        let decoded;
        try {
            decoded = jwt.verify(String(req.body.challenge_token || ''), process.env.JWT_SECRET);
        } catch {
            throw new HttpError(401, 'Kirish vaqti tugadi. Qaytadan telefon raqam bilan kiring');
        }
        if (decoded.purpose !== '2fa') throw new HttpError(401, 'Noto\'g\'ri token');

        const attempts = (twoFactorAttempts.get(decoded.jti) || 0) + 1;
        if (attempts > TWO_FACTOR_MAX_ATTEMPTS) {
            throw new HttpError(429, 'Urinishlar tugadi. Qaytadan telefon raqam bilan kiring');
        }

        const result = await query(
            'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
            [decoded.userId]
        );
        const user = result.rows[0];
        if (!user || !user.totp_enabled || user.token_version !== decoded.tv) {
            throw new HttpError(401, 'Kirish vaqti tugadi. Qaytadan telefon raqam bilan kiring');
        }
        if (!user.is_active) throw new HttpError(403, 'Hisobingiz bloklangan');

        const counter = totp.verifyTotp(totp.decryptSecret(user.totp_secret), req.body.code);
        // Bir marta ishlatilgan kodni qayta ishlatib bo'lmaydi
        if (counter === null || (user.totp_last_counter !== null && counter <= Number(user.totp_last_counter))) {
            twoFactorAttempts.set(decoded.jti, attempts);
            setTimeout(() => twoFactorAttempts.delete(decoded.jti), 5 * 60 * 1000).unref();
            throw new HttpError(400, `Kod noto'g'ri. Yana ${TWO_FACTOR_MAX_ATTEMPTS - attempts} ta urinish qoldi`);
        }

        await query('UPDATE users SET totp_last_counter = $2 WHERE id = $1', [user.id, counter]);
        twoFactorAttempts.delete(decoded.jti);

        res.status(200).json({
            success: true,
            message: 'Tizimga kirdingiz',
            data: { token: generateToken(user), user: await loadUserProfile(user.id), isNewUser: false },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2FA ni sozlash: yangi maxfiy kalit va QR kod (hali yoqilmaydi)
 * POST /api/auth/2fa/setup
 */
const setupTwoFactor = async (req, res, next) => {
    try {
        if (req.user.totp_enabled) throw new HttpError(400, 'Ikki bosqichli kirish allaqachon yoqilgan');

        const secret = totp.generateSecret();
        await query(
            'UPDATE users SET totp_secret = $2, totp_last_counter = NULL WHERE id = $1',
            [req.user.id, totp.encryptSecret(secret)]
        );

        const url = totp.otpauthUrl(secret, req.user.phone);
        res.status(200).json({
            success: true,
            data: {
                secret,
                otpauth_url: url,
                qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }),
            },
        });
    } catch (error) {
        next(error);
    }
};

const loadTotpSecret = async (userId) => {
    const result = await query('SELECT totp_secret, totp_last_counter FROM users WHERE id = $1', [userId]);
    const row = result.rows[0];
    if (!row || !row.totp_secret) throw new HttpError(400, 'Avval QR kodni skanerlang (2FA sozlash)');
    return { secret: totp.decryptSecret(row.totp_secret), lastCounter: row.totp_last_counter };
};

/**
 * 2FA ni yoqish (authenticator ilovasidagi birinchi kod bilan tasdiqlanadi)
 * POST /api/auth/2fa/enable  Body: { code }
 */
const enableTwoFactor = async (req, res, next) => {
    try {
        const { secret } = await loadTotpSecret(req.user.id);
        const counter = totp.verifyTotp(secret, req.body.code);
        if (counter === null) throw new HttpError(400, 'Kod noto\'g\'ri. Ilovadagi yangi kodni kiriting');

        await query(
            'UPDATE users SET totp_enabled = TRUE, totp_last_counter = $2 WHERE id = $1',
            [req.user.id, counter]
        );
        res.status(200).json({
            success: true,
            message: 'Ikki bosqichli kirish yoqildi',
            data: await loadUserProfile(req.user.id),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 2FA ni o'chirish (joriy kod bilan tasdiqlanadi)
 * POST /api/auth/2fa/disable  Body: { code }
 */
const disableTwoFactor = async (req, res, next) => {
    try {
        if (!req.user.totp_enabled) throw new HttpError(400, 'Ikki bosqichli kirish yoqilmagan');
        const { secret } = await loadTotpSecret(req.user.id);
        if (totp.verifyTotp(secret, req.body.code) === null) {
            throw new HttpError(400, 'Kod noto\'g\'ri');
        }
        await query(
            'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, totp_last_counter = NULL WHERE id = $1',
            [req.user.id]
        );
        res.status(200).json({
            success: true,
            message: 'Ikki bosqichli kirish o\'chirildi',
            data: await loadUserProfile(req.user.id),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Barcha qurilmalardan chiqish: barcha tokenlar bekor qilinadi
 * POST /api/auth/logout-all
 */
const logoutAll = async (req, res, next) => {
    try {
        await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
        await disconnectUserSockets(req, req.user.id);
        res.status(200).json({ success: true, message: 'Barcha qurilmalardan chiqildi' });
    } catch (error) {
        next(error);
    }
};

const disconnectUserSockets = async (req, userId) => {
    const io = req.app.get('io');
    if (!io) return;
    const sockets = await io.fetchSockets();
    sockets.filter((socket) => socket.data.userId === userId).forEach((socket) => socket.disconnect(true));
};

/**
 * Hisobni o'chirish. Shaxsiy ma'lumotlar (ism, telefon, rasm, portfolio, xabarlar) o'chiriladi;
 * buyurtma va sharhlar ikkinchi tomon tarixi uchun anonim holda qoladi.
 * DELETE /api/auth/me  Body: { confirm: true }
 */
const deleteMe = async (req, res, next) => {
    try {
        const userId = req.user.id;
        if (req.body.confirm !== true) throw new HttpError(400, 'Hisobni o\'chirishni tasdiqlang');
        if (req.user.role === 'admin') {
            throw new HttpError(400, 'Administrator hisobini o\'chirib bo\'lmaydi. Avval boshqa administrator rolingizni o\'zgartirsin');
        }

        const active = await query(
            `SELECT COUNT(*)::int as total FROM orders
             WHERE (client_id = $1 OR master_id = $1) AND status = ANY($2::text[])`,
            [userId, ACTIVE_ORDER_STATUSES]
        );
        if (active.rows[0].total > 0) {
            throw new HttpError(409, 'Sizda faol buyurtmalar bor. Avval ularni yakunlang yoki bekor qiling');
        }

        const files = await withTransaction(async (client) => {
            const portfolio = await client.query(
                `SELECT p.image_url FROM portfolio_items p
                 JOIN master_profiles mp ON mp.id = p.master_id WHERE mp.user_id = $1`,
                [userId]
            );
            const phone = (await client.query('SELECT phone FROM users WHERE id = $1', [userId])).rows[0].phone;

            await client.query('DELETE FROM master_profiles WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM messages WHERE sender_id = $1', [userId]);
            await client.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);
            await client.query('UPDATE reviews SET comment = NULL WHERE client_id = $1', [userId]);
            // Telefon o'rniga noyob belgi: shu raqam bilan keyin yangi hisob ochish mumkin
            await client.query(
                `UPDATE users
                 SET name = NULL, avatar_url = NULL, role = 'client', is_active = FALSE,
                     phone = $2, deleted_at = NOW(), token_version = token_version + 1,
                     totp_enabled = FALSE, totp_secret = NULL
                 WHERE id = $1`,
                [userId, `x${crypto.randomBytes(7).toString('hex')}`]
            );
            return portfolio.rows.map((row) => row.image_url);
        });

        // Serverga yuklangan portfolio rasmlarini o'chirish
        await Promise.all(files
            .filter((url) => url.startsWith('/uploads/'))
            .map((url) => fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {})));
        await disconnectUserSockets(req, userId);

        res.status(200).json({ success: true, message: 'Hisobingiz va shaxsiy ma\'lumotlaringiz o\'chirildi' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendOTP,
    verifyOTP,
    verifyTwoFactorLogin,
    setupTwoFactor,
    enableTwoFactor,
    disableTwoFactor,
    logoutAll,
    deleteMe,
    getMe,
    updateMe,
    setRole,
};
