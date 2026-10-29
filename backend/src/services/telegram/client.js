// =============================================
// UyRemont - Telegram Bot API mijozi (tashqi kutubxonasiz, fetch orqali)
// TELEGRAM_BOT_TOKEN @BotFather dan olinadi va faqat serverda saqlanadi
// =============================================

const crypto = require('crypto');

const TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
let botUsername = process.env.TELEGRAM_BOT_USERNAME || null;

const getToken = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const isTelegramConfigured = () => TOKEN_PATTERN.test(getToken());
const apiBase = () => (process.env.TELEGRAM_API_URL || 'https://api.telegram.org').replace(/\/$/, '');

const getBotUsername = () => botUsername;
const setBotUsername = (username) => {
    botUsername = username || botUsername;
};

/**
 * Bot API metodini chaqirish. Xato matnida token hech qachon ko'rsatilmaydi.
 * 429 (juda ko'p so'rov) bo'lsa bir marta kutib qayta urinadi.
 */
const callTelegram = async (method, params = {}, { signal, retried = false } = {}) => {
    const response = await fetch(`${apiBase()}/bot${getToken()}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal,
    });
    const data = await response.json().catch(() => null);
    if (data?.ok) return data.result;

    const retryAfter = data?.parameters?.retry_after;
    if (response.status === 429 && retryAfter && !retried && retryAfter <= 30) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return callTelegram(method, params, { signal, retried: true });
    }

    const error = new Error(`Telegram ${method}: ${data?.description || `HTTP ${response.status}`}`);
    error.telegramCode = data?.error_code || response.status;
    error.description = data?.description || '';
    throw error;
};

/**
 * HTML rejimidagi xabar uchun matnni xavfsiz qilish
 */
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Sayt manzili (xabardagi havolalar uchun): PUBLIC_APP_URL yoki CLIENT_URL dagi birinchi manzil
 */
const appUrl = (pathname = '/') => {
    const base = (process.env.PUBLIC_APP_URL || (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0])
        .trim().replace(/\/$/, '');
    return `${base}${pathname}`;
};

// Telegram tugmalarida localhost va ichki tarmoq manzillari qabul qilinmaydi
const isPublicUrl = (url) => {
    try {
        const { protocol, hostname } = new URL(url);
        return /^https?:$/.test(protocol)
            && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
            && hostname.includes('.');
    } catch {
        return false;
    }
};

/**
 * Havola tugmasi; manzil ommaviy bo'lmasa (development) null
 */
const urlButton = (text, pathname) => {
    const url = /^https?:\/\//.test(pathname) ? pathname : appUrl(pathname);
    return isPublicUrl(url) ? { text, url } : null;
};

/**
 * Tugmalar qatorlaridan bo'sh (null) tugmalarni olib tashlash
 */
const keyboard = (rows) => {
    const cleaned = rows.map((row) => row.filter(Boolean)).filter((row) => row.length > 0);
    return cleaned.length ? { inline_keyboard: cleaned } : undefined;
};

// PostgreSQL BIGINT ustunlari matn bo'lib keladi; Telegram ID lari sonda (52 bitgacha, xavfsiz)
const asId = (value) => (typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value);

/**
 * Xabar yuborish (HTML). Tugma xatosi bo'lsa tugmasiz qayta yuboriladi.
 */
const sendMessage = async (chatId, text, { replyMarkup, disablePreview = true } = {}) => {
    const params = {
        chat_id: asId(chatId),
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: disablePreview },
        ...(replyMarkup && { reply_markup: replyMarkup }),
    };
    try {
        return await callTelegram('sendMessage', params);
    } catch (error) {
        if (replyMarkup && error.telegramCode === 400 && /button|url|keyboard/i.test(error.description)) {
            const { reply_markup: ignored, ...withoutMarkup } = params;
            return callTelegram('sendMessage', withoutMarkup);
        }
        throw error;
    }
};

/**
 * Xabarni tahrirlash ("message is not modified" xatosi e'tiborsiz qoldiriladi)
 */
const editMessage = async (chatId, messageId, text, { replyMarkup } = {}) => {
    try {
        return await callTelegram('editMessageText', {
            chat_id: asId(chatId),
            message_id: asId(messageId),
            text,
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: replyMarkup || { inline_keyboard: [] },
        });
    } catch (error) {
        if (/not modified/i.test(error.description)) return null;
        throw error;
    }
};

/**
 * Webhook so'rovlarini tekshirish uchun maxfiy kalit (tokendan hosil qilinadi)
 */
const webhookSecret = () => crypto
    .createHash('sha256')
    .update(`usta24-telegram-webhook:${getToken()}`)
    .digest('hex')
    .slice(0, 48);

/**
 * +998901234567 -> +998 90 *** ** 67
 */
const maskPhone = (phone) => {
    const m = String(phone || '').match(/^\+998(\d{2})\d{5}(\d{2})$/);
    return m ? `+998 ${m[1]} *** ** ${m[2]}` : phone;
};

module.exports = {
    isTelegramConfigured,
    callTelegram,
    sendMessage,
    editMessage,
    escapeHtml,
    appUrl,
    urlButton,
    keyboard,
    webhookSecret,
    maskPhone,
    getBotUsername,
    setBotUsername,
};
