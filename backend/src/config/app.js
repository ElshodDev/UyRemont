// =============================================
// UyRemont - Sayt manzili (havolalar, QR kod va Telegram xabarlari uchun)
// =============================================

/**
 * PUBLIC_APP_URL yoki CLIENT_URL dagi birinchi manzil + yo'l
 */
const appUrl = (pathname = '/') => {
    const base = (process.env.PUBLIC_APP_URL || (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0])
        .trim().replace(/\/$/, '');
    return `${base}${pathname}`;
};

module.exports = { appUrl };
