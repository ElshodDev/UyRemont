// =============================================
// UyRemont - Global Xato Handler Middleware
// =============================================

const multer = require('multer');

/**
 * Controllerlarda tashlanadigan, foydalanuvchiga ko'rsatsa bo'ladigan xato
 */
class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.expose = true;
    }
}

/**
 * 404 - Topilmadi xatosi
 */
const notFound = (req, res, next) => {
    next(new HttpError(404, `Yo'l topilmadi - ${req.originalUrl}`));
};

/**
 * Global xato handler
 * Barcha xatolarni ushlab, standart formatda qaytaradi
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    let statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
    let message = err.message;

    // PostgreSQL xatolari
    if (err.code === '23505') {
        // Unique constraint violation
        statusCode = 409;
        message = 'Bu ma\'lumot allaqachon mavjud';
    } else if (err.code === '23503') {
        // Foreign key violation
        statusCode = 400;
        message = 'Bog\'liq ma\'lumot topilmadi';
    } else if (err.code === '22P02') {
        // Invalid UUID
        statusCode = 400;
        message = 'Noto\'g\'ri ID format';
    }

    // Noto'g'ri JSON body
    if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'So\'rov formati noto\'g\'ri (JSON)';
    }

    // Fayl yuklash xatolari
    if (err instanceof multer.MulterError) {
        statusCode = 400;
        message = err.code === 'LIMIT_FILE_SIZE'
            ? 'Rasm hajmi 5 MB dan oshmasligi kerak'
            : 'Faylni yuklashda xatolik';
    }

    // JWT xatolari
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Noto\'g\'ri token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token muddati tugagan';
    }

    // Kutilmagan xatolar tafsilotini production da yashirish
    if (statusCode >= 500 && isProduction) {
        message = 'Serverda xatolik yuz berdi. Keyinroq urinib ko\'ring';
    }

    if (statusCode >= 500) {
        console.error('❌ Xato:', {
            message: err.message,
            stack: isProduction ? undefined : err.stack,
            url: req.originalUrl,
            method: req.method,
        });
    }

    res.status(statusCode).json({
        success: false,
        message,
    });
};

module.exports = { notFound, errorHandler, HttpError };
