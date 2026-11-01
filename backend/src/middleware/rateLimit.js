// =============================================
// UyRemont - So'rovlar chastotasini cheklash
// =============================================

const rateLimit = require('express-rate-limit');

const limitMessage = (message) => ({ success: false, message });

// Umumiy API cheklovi (IP bo'yicha)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: limitMessage('Juda ko\'p so\'rov yuborildi. Birozdan so\'ng urinib ko\'ring'),
});

// OTP yuborish/tasdiqlash uchun cheklov (IP bo'yicha; mobil operatorlar NAT ortida ko'p foydalanuvchini birlashtiradi,
// shuning uchun asosiy himoya raqam bo'yicha: 60 soniya oralig'i va 5 ta urinish)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: limitMessage('Juda ko\'p urinish. 15 daqiqadan so\'ng qayta urinib ko\'ring'),
});

// Saytdan xato hisobotlari (bitta qurilma xatolar oqimi bilan jurnalni to'ldirmasligi uchun)
const clientErrorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: limitMessage('Juda ko\'p xato hisoboti'),
});

// Havola ko'rinishi (Telegram, WhatsApp va boshqalar sahifani va kartochka rasmini oladi)
const previewLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: limitMessage('Juda ko\'p so\'rov yuborildi. Birozdan so\'ng urinib ko\'ring'),
});

module.exports = { apiLimiter, otpLimiter, clientErrorLimiter, previewLimiter };
