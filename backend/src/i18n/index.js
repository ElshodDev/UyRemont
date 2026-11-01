// =============================================
// UyRemont - Server matnlarini tarjima qilish (o'zbekcha -> ruscha)
//
// Matnlar kodda o'zbekcha yoziladi; o'zbekcha matnning o'zi kalit, tarjimasi ru.js da.
// Kalitdagi {nom} - o'zgaruvchi joyi. Ikki xil ishlatiladi:
//   1) tr(lang, 'Komissiya yozildi: {amount}', { amount }) - andoza tarjima qilinadi, keyin qiymat qo'yiladi
//      (Telegram matnlarida qiymat escapeHtml qilingan holda beriladi).
//   2) translate(lang, "Ism 100 belgidan oshmasligi kerak") - tayyor matn (API xabari) avval aynan, keyin
//      andozalar bo'yicha tanib olinadi. Topilgan qiymat ham lug'atda bo'lsa tarjima qilinadi
//      (maydon nomlari: 'Ism' -> 'Имя').
// O'zgaruvchi turlari (faqat kalitda):
//   {n:num}  - faqat son (yonma-yon turgan o'zgaruvchilarni ajratish uchun)
//   {x:raw}  - tarjima qilinmaydi (foydalanuvchi matni, URL)
//   {x:list} - ", " bilan ajratilgan ro'yxat, har bir bandi alohida tarjima qilinadi
// =============================================

const ru = require('./ru');

const LANGUAGES = ['uz', 'ru'];
const DEFAULT_LANGUAGE = 'uz';
// Ichma-ich tarjima chuqurligi (xabar -> qiymat -> qiymat ichidagi summa)
const MAX_DEPTH = 3;

const PLACEHOLDER = /\{(\w+)(?::(num|raw|list))?\}/g;
const GROUPS = {
    text: '[\\s\\S]+?',
    raw: '[\\s\\S]+?',
    list: '[\\s\\S]+?',
    num: '-?\\d+(?:[.,]\\d+)?',
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lug'atni tayyorlash: o'zgaruvchili kalitlar boshidan oxirigacha mos keladigan regex ga aylanadi.
 * Ko'proq qat'iy matnli andoza oldin tekshiriladi ("Xabar {n} belgidan..." umumiy "{field} {max} belgidan..." dan oldin).
 */
const compileDictionary = (entries) => {
    const patterns = [];
    for (const [key, value] of Object.entries(entries)) {
        const params = [];
        let source = '';
        let last = 0;
        for (const match of key.matchAll(PLACEHOLDER)) {
            const type = match[2] || 'text';
            source += `${escapeRegex(key.slice(last, match.index))}(${GROUPS[type]})`;
            params.push({ name: match[1], type });
            last = match.index + match[0].length;
        }
        if (params.length === 0) continue;
        source += escapeRegex(key.slice(last));
        patterns.push({
            value,
            params,
            regex: new RegExp(`^${source}$`),
            literalLength: key.replace(PLACEHOLDER, '').length,
        });
    }
    patterns.sort((a, b) => b.literalLength - a.literalLength);
    return { exact: entries, patterns };
};

const DICTIONARIES = { ru: compileDictionary(ru) };

/**
 * {nom} va {nom:tur} o'rniga qiymat qo'yish (berilmagan o'zgaruvchi o'zgarishsiz qoladi)
 */
const format = (template, params = {}) => String(template).replace(
    /\{(\w+)(?::\w+)?\}/g,
    (whole, name) => (hasOwn(params, name) && params[name] !== undefined && params[name] !== null
        ? String(params[name])
        : whole)
);

let lookup;

// "a, b, c": har bir band alohida tarjima qilinadi. Bandning o'zida vergul bo'lsa
// ("..., avval to'lang") tanilgan eng qisqa bo'lak olinadi; tanilmagan band o'zgarishsiz qoladi
const translateList = (dict, value, depth) => {
    const parts = value.split(', ');
    const result = [];
    let i = 0;
    while (i < parts.length) {
        let found = null;
        let j = i;
        for (; j < parts.length && found === null; j += 1) {
            found = lookup(dict, parts.slice(i, j + 1).join(', '), depth);
        }
        if (found === null) {
            result.push(parts[i]);
            i += 1;
        } else {
            result.push(found);
            i = j;
        }
    }
    return result.join(', ');
};

const translateValue = (dict, value, type, depth) => {
    if (type === 'num' || type === 'raw') return value;
    if (type === 'list') return translateList(dict, value, depth);
    const found = lookup(dict, value, depth);
    return found === null ? value : found;
};

/**
 * @returns {string|null} tarjima yoki topilmasa null
 */
lookup = (dict, text, depth) => {
    if (hasOwn(dict.exact, text)) return dict.exact[text];
    if (depth >= MAX_DEPTH) return null;
    for (const pattern of dict.patterns) {
        const match = pattern.regex.exec(text);
        if (!match) continue;
        const values = {};
        pattern.params.forEach(({ name, type }, index) => {
            values[name] = translateValue(dict, match[index + 1], type, depth + 1);
        });
        return format(pattern.value, values);
    }
    return null;
};

const isLanguage = (value) => LANGUAGES.includes(value);
const normalizeLanguage = (value) => (isLanguage(value) ? value : DEFAULT_LANGUAGE);

/**
 * Tayyor o'zbekcha matnni tarjima qilish (aynan, keyin andozalar bo'yicha). Topilmasa matnning o'zi.
 */
const translate = (lang, text) => {
    const dict = DICTIONARIES[lang];
    if (!dict || typeof text !== 'string' || !text) return text;
    const found = lookup(dict, text, 0);
    return found === null ? text : found;
};

/**
 * Faqat aynan mos kalit (foydalanuvchi tanlagan tayyor qiymatlar uchun, masalan bekor qilish sababi)
 */
const phrase = (lang, text) => {
    const dict = DICTIONARIES[lang];
    return dict && typeof text === 'string' && hasOwn(dict.exact, text) ? dict.exact[text] : text;
};

// Kodda chaqirilgan, lekin lug'atda yo'q andozalar (testlar tekshiradi)
const missing = new Set();

/**
 * Andozani tarjima qilib, o'zgaruvchilarni qo'yish: tr('ru', '📷 Rasm: {n} ta', { n: 2 })
 * params berilmasa translate() bilan bir xil.
 */
const tr = (lang, template, params) => {
    const dict = DICTIONARIES[lang];
    if (dict && !hasOwn(dict.exact, template) && missing.size < 500) missing.add(template);
    if (!params) return translate(lang, template);
    return format(dict && hasOwn(dict.exact, template) ? dict.exact[template] : template, params);
};

const hasTranslation = (lang, text) => {
    const dict = DICTIONARIES[lang];
    return Boolean(dict) && typeof text === 'string' && lookup(dict, text, 0) !== null;
};

/**
 * Accept-Language: birinchi teg bo'yicha ("ru", "ru-RU,ru;q=0.9" -> ru; "uz" -> uz).
 * Tanilmagan yoki yo'q bo'lsa null (chaqiruvchi o'zi tanlaydi: foydalanuvchi tili yoki o'zbekcha)
 */
const languageFromHeader = (header) => {
    const first = String(header || '').split(',')[0].split(';')[0].trim().toLowerCase();
    const primary = first.split('-')[0];
    return isLanguage(primary) ? primary : null;
};

/**
 * Telegram ilovasining tili (update.from.language_code): ru* -> ru, qolganlari -> uz
 */
const languageFromTelegram = (code) => (/^ru\b/i.test(String(code || '')) ? 'ru' : DEFAULT_LANGUAGE);

module.exports = {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    isLanguage,
    normalizeLanguage,
    translate,
    phrase,
    tr,
    format,
    hasTranslation,
    languageFromHeader,
    languageFromTelegram,
    missingTranslations: () => [...missing],
    dictionaries: { ru },
};
