// =============================================
// UyRemont - Xatolar jurnali (Sentry siz): server va saytdagi xatolar admin panelda ko'rinadi.
// Bir xil xato bitta qatorda sanaladi (fingerprint), shaxsiy ma'lumot (token, so'rov parametrlari) saqlanmaydi.
// =============================================

const crypto = require('crypto');
const { query } = require('../config/database');

const clip = (value, max) => (value === undefined || value === null ? null : String(value).slice(0, max));

// URL dan faqat yo'l (so'rov parametrlari, tokenlar saqlanmaydi)
const safePath = (url) => {
    if (!url) return null;
    try {
        return new URL(url, 'http://local').pathname.slice(0, 300);
    } catch {
        return null;
    }
};

/**
 * @param {{ source: 'server'|'client', message: string, stack?: string, url?: string, userAgent?: string }} error
 */
const recordError = async ({ source, message, stack, url, userAgent }) => {
    const text = clip(message, 1000) || 'Noma\'lum xato';
    const stackText = clip(stack, 4000);
    const firstFrame = (stackText || '').split('\n').map((line) => line.trim()).find((line) => /^at |@/.test(line)) || '';
    const fingerprint = crypto.createHash('sha1').update(`${source}|${text}|${firstFrame}`).digest('hex');
    await query(
        `INSERT INTO error_logs (fingerprint, source, message, stack, url, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (fingerprint) DO UPDATE SET
             count = error_logs.count + 1, last_seen = NOW(), resolved = FALSE,
             url = COALESCE(EXCLUDED.url, error_logs.url), user_agent = COALESCE(EXCLUDED.user_agent, error_logs.user_agent)`,
        [fingerprint, source, text, stackText, safePath(url), clip(userAgent, 300)]
    );
};

/**
 * Xatoni yozishda xato bo'lsa (masalan, baza ishlamasa) asosiy javob buzilmasligi kerak
 */
const recordErrorSafely = (error) => {
    recordError(error).catch(() => {});
};

module.exports = { recordError, recordErrorSafely };
