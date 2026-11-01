// =============================================
// UyRemont - Kirish kodlari (OTP): yaratish va cheklovlar
// Kod SMS yoki Telegram orqali yuboriladi; tekshirish bitta joyda (auth.controller verifyOTP)
// =============================================

const crypto = require('crypto');
const { randomUUID: uuidv4 } = require('crypto');
const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { OTP_DAILY_LIMIT } = require('../config/security');

const OTP_TTL_MS = 5 * 60 * 1000;      // Kod amal qilish muddati: 5 daqiqa
const OTP_RESEND_MS = 60 * 1000;       // Qayta yuborish oralig'i: 1 daqiqa

/**
 * 6 xonali, kriptografik xavfsiz kod
 */
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Raqam uchun yangi kod: sutkalik limit va 60 soniya oralig'i tekshiriladi, eski kodlar bekor qilinadi.
 * @returns {Promise<{ code: string, expiresIn: number }>}
 * @throws {HttpError} 429 - limit yoki oraliq (retryAfter bilan)
 */
const issueOtp = async (phone) => {
    // Sutkalik limit: kodni ko'p marta so'rab taxmin qilishning oldini olish
    const daily = await query(
        `SELECT COUNT(*)::int as total FROM otp_codes
         WHERE phone = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [phone]
    );
    if (daily.rows[0].total >= OTP_DAILY_LIMIT) {
        throw new HttpError(429, 'Bu raqamga bugun juda ko\'p kod so\'raldi. Ertaga qayta urinib ko\'ring');
    }

    // Juda tez-tez so'rov yuborilishining oldini olish
    const recent = await query(
        `SELECT created_at FROM otp_codes
         WHERE phone = $1 AND created_at > NOW() - ($2::int * INTERVAL '1 millisecond')
         ORDER BY created_at DESC LIMIT 1`,
        [phone, OTP_RESEND_MS]
    );
    if (recent.rows.length > 0) {
        const waitSeconds = Math.max(1, Math.ceil(
            (OTP_RESEND_MS - (Date.now() - new Date(recent.rows[0].created_at).getTime())) / 1000
        ));
        const error = new HttpError(429, `Kodni qayta yuborish uchun ${waitSeconds} soniya kuting`);
        error.retryAfter = waitSeconds;
        throw error;
    }

    const code = generateOTP();
    await query('UPDATE otp_codes SET is_used = TRUE WHERE phone = $1 AND is_used = FALSE', [phone]);
    await query(
        'INSERT INTO otp_codes (id, phone, code, expires_at) VALUES ($1, $2, $3, $4)',
        [uuidv4(), phone, code, new Date(Date.now() + OTP_TTL_MS)]
    );
    return { code, expiresIn: OTP_TTL_MS / 1000 };
};

module.exports = { issueOtp, OTP_TTL_MS, OTP_RESEND_MS };
