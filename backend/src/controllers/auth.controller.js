// =============================================
// UyRemont - Autentifikatsiya Controller
// OTP orqali kirish tizimi
// =============================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { sendOtpSms } = require('../services/sms.service');
const { normalizePhone, optionalString, requiredString } = require('../utils/validators');

const OTP_TTL_MS = 5 * 60 * 1000;      // Kod amal qilish muddati: 5 daqiqa
const OTP_RESEND_MS = 60 * 1000;       // Qayta yuborish oralig'i: 1 daqiqa
const OTP_MAX_ATTEMPTS = 5;            // Bitta kod uchun maksimal urinishlar

/**
 * OTP kodni generatsiya qilish (6 xonali, kriptografik xavfsiz)
 */
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

/**
 * JWT token yaratish
 */
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
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
                // SMS sozlanmagan development muhitida kodni qaytarish
                ...(!delivered && process.env.NODE_ENV !== 'production' && { devCode: code }),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * OTP tasdiqlash va tizimga kirish
 * POST /api/auth/verify-otp
 * Body: { phone, code, name? }
 */
const verifyOTP = async (req, res, next) => {
    try {
        const phone = normalizePhone(req.body.phone);
        const code = typeof req.body.code === 'string' ? req.body.code.trim() : String(req.body.code || '');
        const name = optionalString(req.body.name, { max: 100, field: 'Ism' });

        if (!phone || !/^\d{6}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Telefon raqam va 6 xonali OTP kod kiritilishi shart',
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
                let found = existing.rows[0];
                // Ismi bo'lmagan foydalanuvchi ism kiritgan bo'lsa saqlash
                if (!found.name && name) {
                    const upd = await client.query(
                        'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
                        [name, found.id]
                    );
                    found = upd.rows[0];
                }
                return { user: found, isNewUser: false };
            }

            const created = await client.query(
                `INSERT INTO users (id, phone, role, name, is_active)
                 VALUES ($1, $2, 'client', $3, TRUE)
                 RETURNING *`,
                [uuidv4(), phone, name]
            );
            return { user: created.rows[0], isNewUser: true };
        });

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Hisobingiz bloklangan. Qo\'llab-quvvatlash xizmatiga murojaat qiling',
            });
        }

        // JWT token yaratish
        const token = generateToken(user.id);

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

module.exports = { sendOTP, verifyOTP, getMe, updateMe, setRole };
