// =============================================
// UyRemont - Ustaning ommaviy sahifasi havola ko'rinishi bilan (Open Graph)
// =============================================

const { HttpError } = require('../middleware/errorHandler');
const { isValidSlug } = require('../utils/slug');
const { loadPublicMaster, renderMasterPage, renderNotFoundPage, renderGuidePage, renderCardPng } = require('../services/og.service');
const { appUrl } = require('../config/app');
const { sendQr } = require('../utils/qr');

// Chop etiladigan varaqalardagi QR kodlar faqat shu sahifalarga olib boradi
const QR_PAGES = {
    ustalar: '/ustalar',
    sayt: '/',
};

const findMaster = async (slug) => (isValidSlug(String(slug || '')) ? loadPublicMaster(slug) : null);

const sendHtml = (res, status, html) => {
    // Sahifaning xavfsizlik siyosati (CSP) proksi-serverda (deploy/Caddyfile) beriladi:
    // helmet'ning API uchun mo'ljallangan siyosati saytni (shrift, xarita) buzadi
    res.removeHeader('Content-Security-Policy');
    res.set('Cache-Control', 'no-cache');
    res.status(status).type('html').send(html);
};

/**
 * Sayt sahifasi + usta haqidagi meta teglar
 * GET /u/:slug
 */
const getPublicMasterPage = async (req, res, next) => {
    try {
        const master = await findMaster(req.params.slug);
        if (!master) return sendHtml(res, 404, renderNotFoundPage());
        sendHtml(res, 200, renderMasterPage(master));
    } catch (error) {
        next(error);
    }
};

/**
 * Havola kartochkasi rasmi (1200x630)
 * GET /api/masters/u/:slug/og.png
 */
const getMasterOgImage = async (req, res, next) => {
    try {
        const master = await findMaster(req.params.slug);
        if (!master) throw new HttpError(404, 'Usta topilmadi');
        const png = await renderCardPng(master);
        res.set('Cache-Control', 'public, max-age=86400');
        res.type('image/png').send(png);
    } catch (error) {
        next(error);
    }
};

/**
 * Ustalar uchun qo'llanma + havola ko'rinishi
 * GET /ustalar
 */
const getGuidePage = (req, res) => sendHtml(res, 200, renderGuidePage());

/**
 * Sayt sahifasiga olib boruvchi QR kod (usta jalb qilish varaqasi uchun)
 * GET /api/qr/:page  (?format=svg)
 */
const getPageQr = async (req, res, next) => {
    try {
        const pathname = Object.prototype.hasOwnProperty.call(QR_PAGES, req.params.page) ? QR_PAGES[req.params.page] : null;
        if (!pathname) throw new HttpError(404, 'Sahifa topilmadi');
        await sendQr(res, appUrl(pathname), { format: req.query.format, filename: `usta24-${req.params.page}` });
    } catch (error) {
        next(error);
    }
};

module.exports = { getPublicMasterPage, getMasterOgImage, getGuidePage, getPageQr };
