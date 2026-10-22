// =============================================
// UyRemont - Global Xato Handler Middleware
// =============================================

/**
 * 404 - Topilmadi xatosi
 */
const notFound = (req, res, next) => {
    const error = new Error(`Yo'l topilmadi - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

/**
 * Global xato handler
 * Barcha xatolarni ushlab, standart formatda qaytaradi
 */
const errorHandler = (err, req, res, next) => {
    // Status kodini aniqlash
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
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

    // JWT xatolari
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Noto\'g\'ri token';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token muddati tugagan';
    }

    // Validation xatolari
    if (err.name === 'ValidationError') {
        statusCode = 400;
    }

    // Xatoni loglash (production da minimal)
    if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Xato:', {
            message: err.message,
            stack: err.stack,
            url: req.originalUrl,
            method: req.method,
        });
    } else {
        console.error(`❌ ${statusCode} - ${message} - ${req.originalUrl}`);
    }

    res.status(statusCode).json({
        success: false,
        message,
        // Development rejimida stack traceni ko'rsatish
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
};

module.exports = { notFound, errorHandler };
