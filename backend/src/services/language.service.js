// =============================================
// UyRemont - Foydalanuvchi tilini aniqlash (Telegram bot va boshqa server xabarlari uchun)
// Bildirishnomalarda til Telegram chatini olgan so'rovning o'zida o'qiladi (telegram/notify.js),
// shuning uchun alohida kesh yo'q: til almashsa keyingi xabar darhol yangi tilda keladi.
// =============================================

const { query } = require('../config/database');
const { normalizeLanguage, languageFromTelegram } = require('../i18n');

/**
 * Bitta so'rov bilan til: avval userId, keyin shu raqamli foydalanuvchi, keyin shu Telegram hisobiga
 * ulangan foydalanuvchi. Hech biri topilmasa - Telegram ilovasining tili (language_code), aks holda o'zbekcha.
 * @param {{ userId?: string|null, phone?: string|null, telegramUserId?: number|null, telegramLanguage?: string }} who
 * @returns {Promise<'uz'|'ru'>}
 */
const resolveLanguage = async ({ userId = null, phone = null, telegramUserId = null, telegramLanguage } = {}) => {
    if (userId || phone || telegramUserId) {
        const result = await query(
            `SELECT language FROM users
             WHERE deleted_at IS NULL
               AND (id = $1::uuid OR phone = $2::text
                    OR id = (SELECT user_id FROM telegram_links WHERE telegram_user_id = $3::bigint))
             ORDER BY CASE WHEN id = $1::uuid THEN 0 WHEN phone = $2::text THEN 1 ELSE 2 END
             LIMIT 1`,
            [userId, phone, telegramUserId]
        );
        if (result.rows[0]) return normalizeLanguage(result.rows[0].language);
    }
    return languageFromTelegram(telegramLanguage);
};

module.exports = { resolveLanguage };
