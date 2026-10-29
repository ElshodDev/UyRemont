// =============================================
// UyRemont - JWT Autentifikatsiya Middleware
// =============================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { ADMIN_REQUIRE_2FA } = require('../config/security');

/**
 * Token va foydalanuvchi holatini tekshirish (HTTP va Socket.io uchun umumiy)
 * @returns {Promise<{ user?: object, status?: number, message?: string }>}
 */
const resolveUserFromToken = async (token) => {
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return {
            status: 401,
            message: error.name === 'TokenExpiredError' ? 'Token muddati tugagan' : 'Noto\'g\'ri token',
        };
    }

    // 2FA bosqichidagi vaqtinchalik token bilan tizimga kirib bo'lmaydi
    if (decoded.purpose) return { status: 401, message: 'Noto\'g\'ri token' };

    const result = await query(
        `SELECT id, phone, role, name, avatar_url, is_active, token_version, deleted_at, totp_enabled
         FROM users WHERE id = $1`,
        [decoded.userId]
    );
    const user = result.rows[0];

    if (!user || user.deleted_at) return { status: 401, message: 'Foydalanuvchi topilmadi' };
    // "Barcha qurilmalardan chiqish" yoki bloklashdan keyin eski tokenlar ishlamaydi
    if ((decoded.tv ?? 0) !== user.token_version) {
        return { status: 401, message: 'Sessiya tugagan. Qaytadan kiring' };
    }
    if (!user.is_active) return { status: 403, message: 'Hisobingiz bloklangan' };

    return { user };
};

/**
 * JWT tokenni tekshiruvchi middleware
 * Token Authorization headerdan olinadi: Bearer <token>
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Avtorizatsiya tokeni topilmadi',
            });
        }

        const { user, status, message } = await resolveUserFromToken(authHeader.split(' ')[1]);
        if (!user) return res.status(status).json({ success: false, message });

        // 2FA majburiy bo'lsa, uni yoqmagan administrator faqat hisob sozlamalariga kira oladi
        if (user.role === 'admin' && ADMIN_REQUIRE_2FA && !user.totp_enabled
            && !req.originalUrl.startsWith('/api/auth')) {
            return res.status(403).json({
                success: false,
                code: '2FA_REQUIRED',
                message: 'Administrator uchun ikki bosqichli kirishni (2FA) yoqing: Profil → Xavfsizlik',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Rol tekshiruvchi middleware
 * @param {...string} roles - Ruxsat etilgan rollar
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Avval tizimga kiring',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Bu amalni bajarishga ruxsatingiz yo\'q',
            });
        }

        next();
    };
};

module.exports = { authenticate, authorize, resolveUserFromToken };
