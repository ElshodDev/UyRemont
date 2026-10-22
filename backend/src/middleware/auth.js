// =============================================
// UyRemont - JWT Autentifikatsiya Middleware
// =============================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * JWT tokenni tekshiruvchi middleware
 * Token Authorization headerdan olinadi: Bearer <token>
 */
const authenticate = async (req, res, next) => {
    try {
        // Tokenni headerdan olish
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Avtorizatsiya tokeni topilmadi',
            });
        }

        const token = authHeader.split(' ')[1];

        // Tokenni tekshirish
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Foydalanuvchini bazadan olish
        const result = await query(
            'SELECT id, phone, role, name, avatar_url, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Foydalanuvchi topilmadi',
            });
        }

        const user = result.rows[0];

        // Faollik tekshirish
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Hisobingiz bloklangan',
            });
        }

        // req.user ga foydalanuvchi ma\'lumotlarini qo\'yish
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Noto\'g\'ri token',
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token muddati tugagan',
            });
        }
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

module.exports = { authenticate, authorize };
