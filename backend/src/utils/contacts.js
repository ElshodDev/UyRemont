// =============================================
// Matndagi aloqa ma'lumotlari (telefon raqam, Telegram manzili).
// Usta va mijoz raqamlari bir-biriga faqat buyurtma qabul qilingach ko'rsatiladi, shu sababli
// ommaviy matnlarda (profil, portfolio, buyurtma tavsifi, qabul qilinmagan buyurtma chati) ular yashiriladi.
// =============================================

const MASK = '•••';

// Raqamlar orasida bo'shliq, chiziqcha, nuqta yoki qavs bo'lishi mumkin: +998 (90) 123-45-67, 90 123 45 67
const PHONE_CANDIDATE = /\+?\d(?:[\s\-().]{0,3}\d){6,}/g;
// Minglik guruhlar (150 000 000, 1.500.000) - bu summa, telefon emas
const THOUSANDS = /^\d{1,3}(?:[ .]\d{3})+$/;
// Telefon: 9 raqam (90 123 45 67), 10 (8 90 ...), 12-13 (998 90 ...). Yillar oralig'i (2015-2023) 8 raqam - telefon emas
const isPhoneLike = (candidate) => {
    const digits = candidate.replace(/\D/g, '').length;
    return digits >= 9 && digits <= 13 && !THOUSANDS.test(candidate.trim());
};

// t.me/username, telegram.me/username va @username (Telegram'da kamida 5 belgi)
const TELEGRAM = /(?:https?:\/\/)?(?:t|telegram)\.me\/[\w+]+|@[a-z]\w{4,31}\b/gi;

/**
 * Matnda telefon raqam yoki Telegram manzili bormi
 * @param {string|null|undefined} text
 */
const containsContact = (text) => {
    if (!text) return false;
    const value = String(text);
    if ((value.match(PHONE_CANDIDATE) || []).some(isPhoneLike)) return true;
    return new RegExp(TELEGRAM.source, TELEGRAM.flags).test(value);
};

/**
 * Telefon raqam va Telegram manzillarini ••• bilan almashtirish (boshqa raqamlar - narx, yil - o'zgarmaydi)
 * @param {string|null|undefined} text
 * @returns {string|null|undefined}
 */
const maskContacts = (text) => {
    if (!text) return text;
    return String(text)
        .replace(PHONE_CANDIDATE, (match) => (isPhoneLike(match) ? MASK : match))
        .replace(TELEGRAM, MASK);
};

const CONTACT_IN_TEXT_MESSAGE = 'Telefon raqam yoki Telegram manzilini yozmang: raqamlar buyurtma qabul qilingach ikki tomonga ham ko\'rinadi';

module.exports = { containsContact, maskContacts, CONTACT_IN_TEXT_MESSAGE, MASK };
