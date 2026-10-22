// =============================================
// UyRemont - Autentifikatsiya Controller
// OTP orqali kirish tizimi
// =============================================

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

/**
 * OTP kodni generatsiya qilish (6 xonali)
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

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
 * OTP yuborish
 * POST /api/auth/send-otp
 * Body: { phone }
 */
const sendOTP = async (req, res, next) => {
    try {
        const { phone } = req.body;

        // Telefon raqamini tekshirish
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Telefon raqam kiritilmagan',
            });
        }

        // Telefon format tekshirish (+998XXXXXXXXX)
        const phoneRegex = /^\+998[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri telefon raqam formati. +998XXXXXXXXX formatida kiriting',
            });
        }

        // OTP generatsiya
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 daqiqa

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

        // TODO: Eskiz SMS API orqali yuborish
        // Hozircha console ga chiqarish (development uchun)
        console.log(`📱 OTP kodi [${phone}]: ${code}`);

        /*
        // Eskiz integratsiyasi (keyinroq):
        const eskizResponse = await axios.post('https://notify.eskiz.uz/api/message/sms/send', {
            mobile_phone: phone.replace('+', ''),
            message: `UyRemont: Tasdiqlash kodingiz: ${code}. Kod 5 daqiqa amal qiladi.`,
            from: '4546',
            callback_url: ''
        }, {
            headers: { Authorization: `Bearer ${eskizToken}` }
        });
        */

        res.status(200).json({
            success: true,
            message: 'OTP kod yuborildi',
            // Development uchun (production da o\'chirish kerak)
            ...(process.env.NODE_ENV !== 'production' && { code }),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * OTP tasdiqlash va tizimga kirish
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 */
const verifyOTP = async (req, res, next) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                message: 'Telefon raqam va OTP kod kiritilishi shart',
            });
        }

        // OTP ni bazadan tekshirish
        const otpResult = await query(
            `SELECT * FROM otp_codes 
             WHERE phone = $1 AND code = $2 AND is_used = FALSE AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [phone, code]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri yoki muddati o\'tgan OTP kod',
            });
        }

        // OTP ni ishlatilgan deb belgilash
        await query(
            'UPDATE otp_codes SET is_used = TRUE WHERE id = $1',
            [otpResult.rows[0].id]
        );

        // Foydalanuvchini topish yoki yaratish
        let userResult = await query(
            'SELECT * FROM users WHERE phone = $1',
            [phone]
        );

        let user;
        let isNewUser = false;

        if (userResult.rows.length === 0) {
            // Yangi foydalanuvchi yaratish
            const newUserResult = await query(
                `INSERT INTO users (id, phone, role, is_active) 
                 VALUES ($1, $2, 'client', TRUE) 
                 RETURNING *`,
                [uuidv4(), phone]
            );
            user = newUserResult.rows[0];
            isNewUser = true;
            console.log(`✅ Yangi foydalanuvchi yaratildi: ${phone}`);
        } else {
            user = userResult.rows[0];
        }

        // JWT token yaratish
        const token = generateToken(user.id);

        res.status(200).json({
            success: true,
            message: isNewUser ? 'Ro\'yxatdan o\'tdingiz' : 'Tizimga kirdingiz',
            data: {
                token,
                user: {
                    id: user.id,
                    phone: user.phone,
                    role: user.role,
                    name: user.name,
                    avatar_url: user.avatar_url,
                },
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
        const userId = req.user.id;

        // Foydalanuvchi va usta profili ma'lumotlari
        const result = await query(
            `SELECT 
                u.id, u.phone, u.role, u.name, u.avatar_url, u.created_at,
                mp.id as master_profile_id, mp.bio, mp.experience_years, 
                mp.hourly_rate, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count, mp.is_available
             FROM users u
             LEFT JOIN master_profiles mp ON mp.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Foydalanuvchi topilmadi',
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Rolni yangilash (client -> master)
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

        await query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

        // Agar master bo'lsa, profil yaratish
        if (role === 'master') {
            const existingProfile = await query(
                'SELECT id FROM master_profiles WHERE user_id = $1',
                [userId]
            );

            if (existingProfile.rows.length === 0) {
                await query(
                    'INSERT INTO master_profiles (id, user_id) VALUES ($1, $2)',
                    [uuidv4(), userId]
                );
            }
        }

        res.status(200).json({
            success: true,
            message: 'Rol yangilandi',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { sendOTP, verifyOTP, getMe, setRole };
