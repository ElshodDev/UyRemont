// =============================================
// Usta24 - ikki til: o'zbekcha (asosiy) va ruscha
//
// Matnlar kodda o'zbekcha yoziladi va t() ga o'raladi: t('Usta chaqirish').
// O'zbekcha matnning o'zi kalit: ruscha tarjimasi ./ru/*.js lug'atlarida.
// Tarjima topilmasa o'zbekcha ko'rsatiladi (test buni ushlaydi: web/tests/i18n.test.js).
//
// O'zgaruvchilar: t('{n} ta sharh', { n: 5 }).
// Ruscha ko'plik shakllari: '{n, plural, one {# отзыв} few {# отзыва} many {# отзывов}}'.
// Batafsil va atamalar lug'ati: ./README.md
// =============================================

import ru from './ru/index.js';

export const LANGUAGES = [
  ['uz', 'O\'zbekcha', 'UZ'],
  ['ru', 'Русский', 'RU']
];
const SUPPORTED = LANGUAGES.map(([code]) => code);
const STORAGE_KEY = 'usta24_lang';
const DICTIONARIES = { ru };

const readSaved = () => {
  try {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(saved) ? saved : null;
  } catch {
    return null;
  }
};

let current = readSaved() || 'uz';

/** Joriy til: 'uz' | 'ru' */
export const getLang = () => current;

/** Foydalanuvchi tilni o'zi tanlaganmi (aks holda hisobdagi til qo'llanadi) */
export const hasSavedLang = () => readSaved() !== null;

/**
 * Tilni almashtirish (LanguageProvider orqali chaqiriladi - sahifa qayta chiziladi)
 */
export const applyLang = (lang, { save = true } = {}) => {
  if (!SUPPORTED.includes(lang)) return;
  current = lang;
  if (save) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage yopiq: til faqat shu sessiyada saqlanadi
    }
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
};

const pluralRules = {};
const pluralCategory = (lang, n) => {
  pluralRules[lang] = pluralRules[lang] || new Intl.PluralRules(lang);
  return pluralRules[lang].select(n);
};

/**
 * {n} va {n, plural, one {...} few {...} many {...} other {...}} ni qiymatlar bilan almashtirish
 */
export const formatMessage = (template, params = {}, lang = current) => {
  let text = template.replace(
    /\{(\w+),\s*plural,((?:\s*\w+\s*\{[^{}]*\})+)\s*\}/g,
    (match, name, body) => {
      const n = Number(params[name]);
      const forms = {};
      body.replace(/(\w+)\s*\{([^{}]*)\}/g, (m, key, value) => {
        forms[key] = value;
        return m;
      });
      const form = forms[pluralCategory(lang, n)] ?? forms.other ?? forms.many ?? Object.values(forms)[0] ?? '';
      return form.replace(/#/g, String(params[name] ?? ''));
    }
  );
  text = text.replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined || params[name] === null ? match : String(params[name])));
  return text;
};

const warned = new Set();

/**
 * Tarjima: t('O\'zbekcha matn', { o'zgaruvchilar })
 * @param {string} text o'zbekcha matn (kalit)
 * @param {Record<string, string|number>} [params]
 */
export function t(text, params) {
  let out = text;
  if (current !== 'uz') {
    const translated = DICTIONARIES[current]?.[text];
    if (translated !== undefined) {
      out = translated;
    } else if (import.meta.env?.DEV && !warned.has(text)) {
      warned.add(text);
      console.warn(`[i18n] ${current} tarjimasi yo'q: ${text}`);
    }
  }
  return params ? formatMessage(out, params) : out;
}

/**
 * Mutaxassislik nomi joriy tilda (API name_uz va name_ru beradi)
 */
export const specName = (spec) => (current === 'ru' && spec?.name_ru ? spec.name_ru : spec?.name_uz || '');

/**
 * Sana va son formatlari uchun locale
 */
export const locale = () => (current === 'ru' ? 'ru-RU' : 'uz-UZ');
