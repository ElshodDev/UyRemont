// =============================================
// UyRemont - So'rov tili va javobdagi xabar tarjimasi
// Til: Accept-Language ning birinchi tegi (uz | ru); bo'lmasa yoki tanilmasa - kirgan foydalanuvchining
// saqlangan tili (users.language), aks holda o'zbekcha.
// res.json o'raladi: javobdagi `message` (faqat shu maydon) tanlangan tilga tarjima qilinadi. errorHandler,
// auth va so'rovlar cheklovi (express-rate-limit res.send -> res.json) ham res.json orqali javob beradi.
// =============================================

const { DEFAULT_LANGUAGE, languageFromHeader, normalizeLanguage, translate } = require('../i18n');

/**
 * So'rov tili (req.user authenticate dan keyin paydo bo'ladi, shuning uchun har safar hisoblanadi)
 */
const requestLanguage = (req) => req.headerLanguage
    || (req.user?.language ? normalizeLanguage(req.user.language) : DEFAULT_LANGUAGE);

const languageMiddleware = (req, res, next) => {
    req.headerLanguage = languageFromHeader(req.get('accept-language'));
    Object.defineProperty(req, 'lang', { configurable: true, enumerable: true, get: () => requestLanguage(req) });

    const json = res.json.bind(res);
    res.json = (body) => {
        // Javob tilga bog'liq: keshlovchi proksi turli tillardagi javoblarni aralashtirmasligi uchun
        res.vary('Accept-Language');
        const lang = req.lang;
        if (lang !== DEFAULT_LANGUAGE && body && typeof body === 'object' && typeof body.message === 'string') {
            return json({ ...body, message: translate(lang, body.message) });
        }
        return json(body);
    };
    next();
};

module.exports = { languageMiddleware, requestLanguage };
