// =============================================
// UyRemont - Telegram hisoblarini bog'lash va saytdan botga o'tish havolalari
// =============================================

const crypto = require('crypto');
const { query } = require('../../config/database');
const { HttpError } = require('../../middleware/errorHandler');

const REQUEST_TTL_MIN = 10;
// Bitta raqam yoki foydalanuvchi uchun 10 daqiqada yaratiladigan havolalar soni
const MAX_REQUESTS_PER_WINDOW = 5;

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Saytdan botga o'tish havolasi uchun yangi kalit
 * @param {{ purpose: 'login' | 'link', phone?: string, userId?: string }} params
 * @returns {Promise<string>} start parametri (login_... yoki link_...)
 */
const createAuthRequest = async ({ purpose, phone = null, userId = null }) => {
    await query(`DELETE FROM telegram_auth_requests WHERE expires_at < NOW() - INTERVAL '1 day'`);

    const recent = await query(
        `SELECT COUNT(*)::int as total FROM telegram_auth_requests
         WHERE created_at > NOW() - ($3 * INTERVAL '1 minute')
           AND ((phone = $1 AND $1 IS NOT NULL) OR (user_id = $2 AND $2 IS NOT NULL))`,
        [phone, userId, REQUEST_TTL_MIN]
    );
    if (recent.rows[0].total >= MAX_REQUESTS_PER_WINDOW) {
        throw new HttpError(429, 'Juda ko\'p urinish. Birozdan so\'ng qayta urinib ko\'ring');
    }

    const token = crypto.randomBytes(24).toString('base64url');
    await query(
        `INSERT INTO telegram_auth_requests (token_hash, purpose, phone, user_id, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 minute'))`,
        [hashToken(token), purpose, phone, userId, REQUEST_TTL_MIN]
    );
    return `${purpose}_${token}`;
};

/**
 * start parametri bo'yicha amal qiluvchi so'rov
 */
const findAuthRequest = async (startParam) => {
    const match = /^(login|link)_([A-Za-z0-9_-]{20,64})$/.exec(String(startParam || ''));
    if (!match) return null;
    const result = await query(
        `SELECT *, (expires_at < NOW()) as expired FROM telegram_auth_requests
         WHERE token_hash = $1 AND purpose = $2`,
        [hashToken(match[2]), match[1]]
    );
    return result.rows[0] || null;
};

const updateAuthRequest = (tokenHash, { status, telegramUserId }) => query(
    `UPDATE telegram_auth_requests
     SET status = COALESCE($2, status), telegram_user_id = COALESCE($3, telegram_user_id)
     WHERE token_hash = $1`,
    [tokenHash, status || null, telegramUserId || null]
);

/**
 * Raqamni yuborishini kutayotgan oxirgi so'rov (shu Telegram foydalanuvchisi uchun)
 */
const findPendingRequestForTelegramUser = async (telegramUserId) => {
    const result = await query(
        `SELECT * FROM telegram_auth_requests
         WHERE telegram_user_id = $1 AND status = 'pending' AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [telegramUserId]
    );
    return result.rows[0] || null;
};

const getLinkByTelegramId = async (telegramUserId) => {
    const result = await query('SELECT * FROM telegram_links WHERE telegram_user_id = $1', [telegramUserId]);
    return result.rows[0] || null;
};

const getLinkByPhone = async (phone) => {
    const result = await query('SELECT * FROM telegram_links WHERE phone = $1', [phone]);
    return result.rows[0] || null;
};

const getLinkByUser = async (userId) => {
    const result = await query('SELECT * FROM telegram_links WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
};

/**
 * Telegram hisobini tasdiqlangan raqam bilan saqlash.
 * Bitta raqam va bitta foydalanuvchi faqat bitta Telegram hisobiga bog'lanadi: eski bog'lanish o'chiriladi.
 */
const saveLink = async ({ telegramUserId, chatId, phone, username, firstName, lastName }) => {
    const user = await query('SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL', [phone]);
    const userId = user.rows[0]?.id || null;

    await query(
        `DELETE FROM telegram_links
         WHERE telegram_user_id <> $1 AND (phone = $2 OR ($3::uuid IS NOT NULL AND user_id = $3))`,
        [telegramUserId, phone, userId]
    );
    const result = await query(
        `INSERT INTO telegram_links (telegram_user_id, chat_id, user_id, phone, username, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (telegram_user_id) DO UPDATE SET
             chat_id = EXCLUDED.chat_id, user_id = EXCLUDED.user_id, phone = EXCLUDED.phone,
             username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
             notifications = TRUE, updated_at = NOW()
         RETURNING *`,
        [telegramUserId, chatId, userId, phone, username || null, firstName || null, lastName || null]
    );
    return result.rows[0];
};

/**
 * Kod tasdiqlangach (yangi foydalanuvchi yaratilgach) raqam bo'yicha bog'lanishni hisobga biriktirish
 */
const attachLinkToUser = (userId, phone) => query(
    `UPDATE telegram_links SET user_id = $1, updated_at = NOW()
     WHERE phone = $2 AND user_id IS DISTINCT FROM $1`,
    [userId, phone]
);

const setNotifications = (telegramUserId, enabled) => query(
    'UPDATE telegram_links SET notifications = $2, updated_at = NOW() WHERE telegram_user_id = $1',
    [telegramUserId, enabled]
);

const removeLinkForUser = (userId) => query('DELETE FROM telegram_links WHERE user_id = $1 RETURNING *', [userId]);

const publicLink = (link) => (link
    ? { username: link.username, first_name: link.first_name, notifications: link.notifications }
    : null);

module.exports = {
    createAuthRequest,
    findAuthRequest,
    updateAuthRequest,
    findPendingRequestForTelegramUser,
    getLinkByTelegramId,
    getLinkByPhone,
    getLinkByUser,
    saveLink,
    attachLinkToUser,
    setNotifications,
    removeLinkForUser,
    publicLink,
    hashToken,
};
