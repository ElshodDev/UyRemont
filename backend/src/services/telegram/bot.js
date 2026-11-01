// =============================================
// UyRemont - Telegram bot: buyruqlar, raqamni tasdiqlash, taklif tugmalari
// Development: long polling (ommaviy manzil shart emas). Production: TELEGRAM_WEBHOOK_URL bilan webhook.
// =============================================

const crypto = require('crypto');
const { query } = require('../../config/database');
const { normalizePhone } = require('../../utils/validators');
const { issueOtp } = require('../otp.service');
const offersService = require('../offers.service');
const links = require('./links');
const { syncOfferMessage } = require('./notify');
const { resolveLanguage } = require('../language.service');
const {
    tr, translate, normalizeLanguage, languageFromTelegram,
} = require('../../i18n');
const {
    isTelegramConfigured, callTelegram, sendMessage, escapeHtml, urlButton, keyboard,
    webhookSecret, maskPhone, setBotUsername, getBotUsername,
} = require('./client');

const REMOVE_KEYBOARD = { remove_keyboard: true };
const POLL_TIMEOUT_SEC = 25;

let polling = false;
let pollController = null;

const contactKeyboard = (lang) => ({
    keyboard: [[{ text: tr(lang, '📱 Raqamni yuborish'), request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
});

const siteKeyboard = (lang) => keyboard([[urlButton(tr(lang, '🌐 Usta24 ni ochish'), '/')]]);

// Bot buyruqlari menyusi (o'zbekcha - sukut bo'yicha, ruscha - Telegram ilovasi ruscha bo'lganlarga)
const botCommands = (lang) => [
    { command: 'start', description: tr(lang, 'Boshlash va xabarlarni yoqish') },
    { command: 'stop', description: tr(lang, 'Xabarlarni o\'chirish') },
];

// Yozgan odamning tili: ulangan hisobi (yoki shu raqamli hisob) tili, bo'lmasa Telegram ilovasi tili
const languageOf = (from, extra = {}) => resolveLanguage({
    telegramUserId: from?.id, telegramLanguage: from?.language_code, ...extra,
});

/**
 * Kirish kodini Telegram'ga yuborish. Yetib bormasa kod o'chiriladi (60 soniyalik oraliqni band qilmasligi uchun).
 * @param {string} [lang] - berilmasa shu raqamli foydalanuvchining tili
 */
const sendLoginCode = async (chatId, phone, lang) => {
    const language = lang || await resolveLanguage({ phone });
    const { code, expiresIn } = await issueOtp(phone);
    try {
        await sendMessage(
            chatId,
            tr(
                language,
                '🔐 <b>Usta24</b> kirish kodi: <code>{code}</code>\n\nKod {minutes} daqiqa amal qiladi. Uni hech kimga bermang — Usta24 xodimlari kodni hech qachon so\'ramaydi.',
                { code, minutes: Math.round(expiresIn / 60) }
            ),
            { replyMarkup: REMOVE_KEYBOARD }
        );
    } catch (error) {
        await query('DELETE FROM otp_codes WHERE phone = $1 AND code = $2 AND is_used = FALSE', [phone, code]);
        throw error;
    }
};

/**
 * Kod yuborish; 60 soniyalik oraliq yoki kunlik limit bo'lsa foydalanuvchiga tushuntiriladi
 */
const deliverLoginCode = async (chatId, phone, lang) => {
    try {
        await sendLoginCode(chatId, phone, lang);
        return true;
    } catch (error) {
        if (error.statusCode === 429) {
            await sendMessage(
                chatId,
                tr(lang, '⏳ {error}. Keyin saytda «Qayta yuborish» ni bosing.', { error: escapeHtml(translate(lang, error.message)) }),
                { replyMarkup: REMOVE_KEYBOARD }
            );
            return false;
        }
        throw error;
    }
};

const profileFrom = (from) => ({
    telegramUserId: from.id,
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
});

const linkedText = (lang) => tr(lang, '✅ Telegram hisobingizga ulandi. Buyurtmalar haqidagi xabarlar shu yerga keladi.');

// ---------- /start ----------

const sendWelcome = async (chatId, from) => {
    const lang = await languageOf(from);
    const link = await links.getLinkByTelegramId(from.id);
    if (link) {
        await links.setNotifications(from.id, true);
        return sendMessage(
            chatId,
            tr(
                lang,
                '👋 Salom, {name}!\n\nUsta24 boti ulangan: <b>{phone}</b>\n• buyurtmalar va takliflar haqidagi xabarlar shu yerga keladi;\n• saytga kirishda «Telegram orqali» ni tanlasangiz, kod shu yerga keladi.\n\nXabarlarni o\'chirish: /stop',
                { name: escapeHtml(from.first_name || ''), phone: maskPhone(link.phone) }
            ),
            { replyMarkup: siteKeyboard(lang) }
        );
    }
    return sendMessage(
        chatId,
        tr(lang, '👋 <b>Usta24</b> botiga xush kelibsiz!\n\nBu yerda:\n• saytga kirish kodini olasiz (SMS shart emas);\n• usta bo\'lsangiz, yangi buyurtmalarni ilova yopiq bo\'lsa ham olasiz va shu yerda qabul qilasiz;\n• mijoz bo\'lsangiz, usta yo\'lga chiqqani va yetib kelgani haqida xabar olasiz.\n\nBoshlash uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing.'),
        { replyMarkup: contactKeyboard(lang) }
    );
};

const sendExpired = (chatId, lang) => sendMessage(
    chatId,
    tr(lang, '⌛ Bu havola eskirgan yoki allaqachon ishlatilgan. Saytda «Telegram orqali» tugmasini qaytadan bosing.'),
    { replyMarkup: siteKeyboard(lang) }
);

const handleStart = async (message, payload) => {
    const { from, chat } = message;
    if (!payload) return sendWelcome(chat.id, from);

    const request = await links.findAuthRequest(payload);
    if (!request || request.expired || request.status !== 'pending') return sendExpired(chat.id, await languageOf(from));

    const link = await links.getLinkByTelegramId(from.id);

    if (request.purpose === 'login') {
        // Kirish: shu raqamli hisob bo'lsa uning tili, yangi foydalanuvchi bo'lsa Telegram ilovasi tili
        const lang = await resolveLanguage({ phone: request.phone, telegramLanguage: from.language_code });
        // Shu Telegram hisobi bu raqam bilan avval tasdiqlangan: kod darhol yuboriladi
        if (link && link.phone === request.phone) {
            await links.saveLink({ ...profileFrom(from), chatId: chat.id, phone: link.phone });
            await links.updateAuthRequest(request.token_hash, { status: 'sent', telegramUserId: from.id });
            return deliverLoginCode(chat.id, request.phone, lang);
        }
        await links.updateAuthRequest(request.token_hash, { telegramUserId: from.id });
        return sendMessage(
            chat.id,
            tr(
                lang,
                '👋 <b>Usta24</b> ga kirish\n\nSaytda kiritilgan raqam: <b>{phone}</b>\nBu sizning raqamingiz ekanini tasdiqlash uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing. Kod shu yerga keladi.',
                { phone: maskPhone(request.phone) }
            ),
            { replyMarkup: contactKeyboard(lang) }
        );
    }

    // Profil sahifasidan Telegram'ni ulash
    const user = (await query('SELECT id, phone, language FROM users WHERE id = $1 AND deleted_at IS NULL', [request.user_id])).rows[0];
    if (!user) return sendExpired(chat.id, await languageOf(from));
    const lang = normalizeLanguage(user.language);
    if (link && link.phone === user.phone) {
        await links.saveLink({ ...profileFrom(from), chatId: chat.id, phone: user.phone });
        await links.updateAuthRequest(request.token_hash, { status: 'linked', telegramUserId: from.id });
        return sendMessage(chat.id, linkedText(lang), { replyMarkup: REMOVE_KEYBOARD });
    }
    await links.updateAuthRequest(request.token_hash, { telegramUserId: from.id });
    return sendMessage(
        chat.id,
        tr(
            lang,
            '🔗 Usta24 hisobini ulash: <b>{phone}</b>\nTasdiqlash uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing.',
            { phone: maskPhone(user.phone) }
        ),
        { replyMarkup: contactKeyboard(lang) }
    );
};

// ---------- Raqam (kontakt) ----------

const handleContact = async (message) => {
    const { contact, from, chat } = message;
    // Faqat o'z raqami: boshqa odamning kontaktini yuborish orqali uning hisobiga kirib bo'lmaydi
    const ownContact = Boolean(contact) && contact.user_id === from.id;
    const raw = ownContact ? String(contact.phone_number || '') : '';
    const phone = ownContact ? normalizePhone(raw.startsWith('+') ? raw : `+${raw}`) : null;
    const request = await links.findPendingRequestForTelegramUser(from.id);
    const lang = await languageOf(from, {
        userId: request?.purpose === 'link' ? request.user_id : null,
        phone: request?.purpose === 'login' ? request.phone : phone,
    });

    if (!ownContact) {
        return sendMessage(
            chat.id,
            tr(lang, '⚠️ Faqat o\'zingizning raqamingizni yuboring: pastdagi «📱 Raqamni yuborish» tugmasini bosing.'),
            { replyMarkup: contactKeyboard(lang) }
        );
    }
    if (!phone) {
        return sendMessage(chat.id, tr(lang, 'Hozircha faqat O\'zbekiston (+998) raqamlari qo\'llab-quvvatlanadi.'), { replyMarkup: REMOVE_KEYBOARD });
    }

    const expected = request?.purpose === 'link'
        ? (await query('SELECT phone FROM users WHERE id = $1 AND deleted_at IS NULL', [request.user_id])).rows[0]?.phone
        : request?.phone;

    if (request && phone !== expected) {
        await links.updateAuthRequest(request.token_hash, { status: 'mismatch' });
        return sendMessage(
            chat.id,
            tr(
                lang,
                '❌ Telegram raqamingiz ({phone}) saytdagi raqamga ({expected}) mos kelmadi.\nSaytda Telegram\'dagi raqamingizni kiriting yoki SMS orqali kiring.',
                { phone: maskPhone(phone), expected: maskPhone(expected) }
            ),
            { replyMarkup: REMOVE_KEYBOARD }
        );
    }

    await links.saveLink({ ...profileFrom(from), chatId: chat.id, phone });

    if (request?.purpose === 'login') {
        await links.updateAuthRequest(request.token_hash, { status: 'sent' });
        return deliverLoginCode(chat.id, phone, lang);
    }
    if (request?.purpose === 'link') {
        await links.updateAuthRequest(request.token_hash, { status: 'linked' });
        return sendMessage(chat.id, linkedText(lang), { replyMarkup: REMOVE_KEYBOARD });
    }
    await sendMessage(
        chat.id,
        tr(
            lang,
            '✅ Raqamingiz ulandi: <b>{phone}</b>\n\nEndi saytga kirishda «Telegram orqali» ni tanlang — kod shu yerga keladi. Buyurtmalar haqidagi xabarlar ham shu yerga keladi.',
            { phone: maskPhone(phone) }
        ),
        { replyMarkup: REMOVE_KEYBOARD }
    );
    const site = siteKeyboard(lang);
    return site ? sendMessage(chat.id, tr(lang, 'Saytni ochish:'), { replyMarkup: site }) : null;
};

// ---------- Taklif tugmalari ----------

const answerCallback = (id, text, showAlert = false) => callTelegram('answerCallbackQuery', {
    callback_query_id: id,
    ...(text && { text, show_alert: showAlert }),
}).catch(() => {});

const handleCallback = async (callback) => {
    const match = /^o:([0-9a-f-]{36}):(a|d)$/.exec(callback.data || '');
    if (!match) return answerCallback(callback.id);
    const [, offerId, action] = match;

    const link = await links.getLinkByTelegramId(callback.from.id);
    const user = link?.user_id
        ? (await query('SELECT id, role, is_active, deleted_at, language FROM users WHERE id = $1', [link.user_id])).rows[0]
        : null;
    const lang = user ? normalizeLanguage(user.language) : languageFromTelegram(callback.from.language_code);
    if (!user || user.role !== 'master' || !user.is_active || user.deleted_at) {
        return answerCallback(callback.id, tr(lang, 'Usta hisobi topilmadi. Saytda kiring.'), true);
    }

    try {
        if (action === 'a') {
            await offersService.acceptOffer(offerId, user.id);
            return answerCallback(callback.id, tr(lang, '✅ Qabul qilindi. Mijoz manziliga yo\'l oling'));
        }
        await offersService.declineOffer(offerId, user.id);
        return answerCallback(callback.id, tr(lang, 'Rad etildi'));
    } catch (error) {
        syncOfferMessage(offerId);
        return answerCallback(callback.id, error.expose ? translate(lang, error.message) : tr(lang, 'Xatolik yuz berdi'), true);
    }
};

// ---------- Yangilanishlarni qayta ishlash ----------

const handleUpdate = async (update) => {
    try {
        if (update.callback_query) return await handleCallback(update.callback_query);
        const message = update.message;
        // Faqat shaxsiy chat (guruhlarda bot ishlamaydi)
        if (!message || message.chat?.type !== 'private' || !message.from || message.from.is_bot) return null;

        if (message.contact) return await handleContact(message);
        const text = (message.text || '').trim();
        const start = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(text);
        if (start) return await handleStart(message, start[1]);
        if (/^\/stop(?:@\w+)?$/.test(text)) {
            await links.setNotifications(message.from.id, false);
            const lang = await languageOf(message.from);
            return await sendMessage(message.chat.id, tr(lang, '🔕 Xabarlar o\'chirildi. Kirish kodlari baribir keladi.\nQayta yoqish: /start'));
        }
        return await sendWelcome(message.chat.id, message.from);
    } catch (error) {
        console.error('⚠️ Telegram yangilanishini qayta ishlashda xato:', error.message);
        return null;
    }
};

// ---------- Transport: long polling yoki webhook ----------

const pollLoop = async () => {
    let offset = 0;
    let failures = 0;
    while (polling) {
        try {
            pollController = new AbortController();
            const updates = await callTelegram(
                'getUpdates',
                { offset, timeout: POLL_TIMEOUT_SEC, allowed_updates: ['message', 'callback_query'] },
                { signal: pollController.signal }
            );
            failures = 0;
            for (const update of updates) {
                offset = update.update_id + 1;
                await handleUpdate(update);
            }
        } catch (error) {
            if (!polling) break;
            failures += 1;
            // 409: boshqa nusxa ham so'rayapti (bir vaqtda faqat bitta server polling qila oladi)
            if (failures === 1 || failures % 20 === 0) {
                console.error(`⚠️ Telegram polling xatosi: ${error.message}${error.telegramCode === 409 ? ' (boshqa server nusxasi ishlayapti)' : ''}`);
            }
            await new Promise((resolve) => setTimeout(resolve, Math.min(30000, 2000 * failures)));
        }
    }
};

/**
 * Botni ishga tushirish (server.js dan). Token bo'lmasa hech narsa qilmaydi.
 */
const startTelegramBot = async () => {
    if (!isTelegramConfigured()) {
        if (process.env.TELEGRAM_BOT_TOKEN) console.warn('⚠️ Telegram: TELEGRAM_BOT_TOKEN formati noto\'g\'ri (@BotFather bergan tokenni to\'liq nusxalang)');
        return false;
    }
    try {
        const me = await callTelegram('getMe');
        setBotUsername(me.username);
        await callTelegram('setMyCommands', { commands: botCommands('uz') }).catch(() => {});
        await callTelegram('setMyCommands', { commands: botCommands('ru'), language_code: 'ru' }).catch(() => {});

        const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
        if (webhookUrl) {
            await callTelegram('setWebhook', {
                url: webhookUrl,
                secret_token: webhookSecret(),
                allowed_updates: ['message', 'callback_query'],
            });
            console.log(`🤖 Telegram bot @${me.username} ishlayapti (webhook)`);
        } else {
            await callTelegram('deleteWebhook', { drop_pending_updates: false });
            polling = true;
            pollLoop();
            console.log(`🤖 Telegram bot @${me.username} ishlayapti (polling)`);
        }
        return true;
    } catch (error) {
        console.error(`❌ Telegram botni ishga tushirib bo'lmadi: ${error.message}`);
        return false;
    }
};

const stopTelegramBot = () => {
    polling = false;
    pollController?.abort();
};

/**
 * Webhook: POST /api/telegram/webhook (Telegram yuborgan maxfiy sarlavha tekshiriladi)
 */
const telegramWebhook = (req, res) => {
    const secret = req.get('x-telegram-bot-api-secret-token') || '';
    const expected = webhookSecret();
    const valid = isTelegramConfigured() && secret.length === expected.length
        && crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
    if (!valid) return res.status(401).json({ success: false });
    res.status(200).json({ ok: true });
    handleUpdate(req.body || {});
    return undefined;
};

module.exports = {
    startTelegramBot,
    stopTelegramBot,
    telegramWebhook,
    handleUpdate,
    sendLoginCode,
    getBotUsername,
};
