// =============================================
// UyRemont - Referal dasturi: shaxsiy havola, statistika, ommaviy taklif sahifasi
// =============================================

const { HttpError } = require('../middleware/errorHandler');
const config = require('../config/referral');
const { sendQr } = require('../utils/qr');
const {
    findReferrer, loadMyReferrals, referralLink, normalizeCode, firstName,
} = require('../services/referral.service');

/**
 * O'z havolasi, bonus shartlari, statistika va taklif qilganlar
 * GET /api/referrals/me
 */
const getMyReferrals = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: await loadMyReferrals(req.user.id) });
    } catch (error) {
        next(error);
    }
};

/**
 * Taklif sahifasi (/r/:code): kim taklif qilgani - faqat ismi
 * GET /api/referrals/:code
 */
const getReferrer = async (req, res, next) => {
    try {
        const referrer = await findReferrer(req.params.code);
        if (!referrer) throw new HttpError(404, 'Taklif havolasi topilmadi');
        res.status(200).json({
            success: true,
            data: {
                code: normalizeCode(req.params.code),
                name: firstName(referrer.name) || null,
                is_master: referrer.role === 'master',
                welcome_bonus: config.WELCOME_BONUS,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Taklif havolasi QR kodi (chop etish, ekranda ko'rsatish)
 * GET /api/referrals/:code/qr (?format=svg)
 */
const getReferralQr = async (req, res, next) => {
    try {
        const referrer = await findReferrer(req.params.code);
        if (!referrer) throw new HttpError(404, 'Taklif havolasi topilmadi');
        const code = normalizeCode(req.params.code);
        await sendQr(res, referralLink(code), { format: req.query.format, filename: `usta24-taklif-${code}` });
    } catch (error) {
        next(error);
    }
};

module.exports = { getMyReferrals, getReferrer, getReferralQr };
