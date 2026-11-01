// =============================================
// UyRemont - Telegram orqali kirish va hisobni ulash (sayt tomoni)
// Kirish: sayt botga havola beradi -> foydalanuvchi botda o'z raqamini yuboradi -> kod Telegram'ga keladi
// -> kod odatdagidek /api/auth/verify-otp orqali tasdiqlanadi (SMS bilan bir xil qoidalar).
// =============================================

const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { normalizePhone } = require('../utils/validators');
const links = require('../services/telegram/links');
const { sendLoginCode } = require('../services/telegram/bot');
const { isTelegramConfigured, getBotUsername } = require('../services/telegram/client');
const { isSmsConfigured } = require('../services/sms.service');
const { OTP_DEV_MODE } = require('../config/security');

const isEnabled = () => isTelegramConfigured() && Boolean(getBotUsername());
const botUrl = (startParam) => `https://t.me/${getBotUsername()}?start=${startParam}`;

const assertEnabled = () => {
    if (!isEnabled()) throw new HttpError(503, 'Telegram orqali kirish hozircha yoqilmagan');
};

/**
 * Kirish usullari (kirish oynasi qaysi tugmalarni ko'rsatishi uchun)
 * GET /api/auth/telegram/config
 */
const getConfig = (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            enabled: isEnabled(),
            bot_username: isEnabled() ? getBotUsername() : null,
            sms_enabled: isSmsConfigured() || OTP_DEV_MODE,
        },
    });
};

/**
 * Kodni Telegram orqali olish
 * POST /api/auth/telegram/start
 * Body: { phone }
 * - Raqam Telegram'ga avval ulangan bo'lsa kod darhol yuboriladi: { status: 'sent' }
 * - Aks holda botga havola: { status: 'link', bot_url, request }
 */
const startLogin = async (req, res, next) => {
    try {
        assertEnabled();
        const phone = normalizePhone(req.body.phone);
        if (!phone) throw new HttpError(400, 'Noto\'g\'ri telefon raqam formati. +998XXXXXXXXX formatida kiriting');

        const link = await links.getLinkByPhone(phone);
        if (link) {
            try {
                await sendLoginCode(link.chat_id, phone);
                return res.status(200).json({ success: true, data: { status: 'sent', channel: 'telegram', phone } });
            } catch (error) {
                // 429 (oraliq/limit) foydalanuvchiga qaytariladi; bot bloklangan bo'lsa havola orqali qayta ulanadi
                if (error.statusCode === 429) throw error;
            }
        }

        const startParam = await links.createAuthRequest({ purpose: 'login', phone });
        res.status(200).json({
            success: true,
            data: { status: 'link', channel: 'telegram', phone, bot_url: botUrl(startParam), request: startParam },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Bot havolasi holati (sayt kutish ekrani uchun)
 * GET /api/auth/telegram/requests/:request
 */
const getRequestStatus = async (req, res, next) => {
    try {
        const request = await links.findAuthRequest(req.params.request);
        if (!request) throw new HttpError(404, 'So\'rov topilmadi');

        let status = request.expired ? 'expired' : request.status;
        if (status === 'pending' && request.telegram_user_id) status = 'waiting_contact';

        // Yangi foydalanuvchi uchun ism maydonini Telegram'dagi ism bilan oldindan to'ldirish
        let nameHint = null;
        if (status === 'sent' && request.purpose === 'login') {
            const row = await query(
                `SELECT t.first_name, t.last_name, u.name
                 FROM telegram_links t LEFT JOIN users u ON u.phone = t.phone
                 WHERE t.phone = $1`,
                [request.phone]
            );
            const info = row.rows[0];
            if (info && !info.name) nameHint = [info.first_name, info.last_name].filter(Boolean).join(' ').slice(0, 100) || null;
        }

        res.status(200).json({ success: true, data: { status, purpose: request.purpose, name_hint: nameHint } });
    } catch (error) {
        next(error);
    }
};

/**
 * Joriy hisobning Telegram holati
 * GET /api/auth/telegram
 */
const getMyTelegram = async (req, res, next) => {
    try {
        const link = await links.getLinkByUser(req.user.id);
        res.status(200).json({
            success: true,
            data: { enabled: isEnabled(), bot_username: isEnabled() ? getBotUsername() : null, link: links.publicLink(link) },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Profildan Telegram'ni ulash
 * POST /api/auth/telegram/link
 */
const startLink = async (req, res, next) => {
    try {
        assertEnabled();
        const startParam = await links.createAuthRequest({ purpose: 'link', userId: req.user.id });
        res.status(200).json({ success: true, data: { bot_url: botUrl(startParam), request: startParam } });
    } catch (error) {
        next(error);
    }
};

/**
 * Bildirishnomalarni yoqish/o'chirish
 * PUT /api/auth/telegram
 * Body: { notifications: boolean }
 */
const updateMyTelegram = async (req, res, next) => {
    try {
        if (typeof req.body.notifications !== 'boolean') throw new HttpError(400, 'notifications true yoki false bo\'lishi kerak');
        const link = await links.getLinkByUser(req.user.id);
        if (!link) throw new HttpError(404, 'Telegram ulanmagan');
        await links.setNotifications(link.telegram_user_id, req.body.notifications);
        res.status(200).json({
            success: true,
            message: req.body.notifications ? 'Telegram xabarlari yoqildi' : 'Telegram xabarlari o\'chirildi',
            data: links.publicLink({ ...link, notifications: req.body.notifications }),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Telegram'ni uzish
 * DELETE /api/auth/telegram
 */
const unlinkMyTelegram = async (req, res, next) => {
    try {
        const removed = await links.removeLinkForUser(req.user.id);
        if (!removed.rows[0]) throw new HttpError(404, 'Telegram ulanmagan');
        res.status(200).json({ success: true, message: 'Telegram uzildi' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getConfig,
    startLogin,
    getRequestStatus,
    getMyTelegram,
    startLink,
    updateMyTelegram,
    unlinkMyTelegram,
};
