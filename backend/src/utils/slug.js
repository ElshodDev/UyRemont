// =============================================
// UyRemont - Ustaning ommaviy havolasi uchun qisqa nom (slug)
// "Jamshid Karimov" -> "jamshid-karimov", "Шерзод" -> "sherzod"
// =============================================

const CYRILLIC = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k',
    л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

// 3-40 belgi: kichik lotin harflari, raqamlar va chiziqcha (boshida/oxirida emas)
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

const slugify = (text) => String(text || '')
    .toLowerCase()
    .split('')
    .map((ch) => (CYRILLIC[ch] !== undefined ? CYRILLIC[ch] : ch))
    .join('')
    .replace(/[ʻʼ'`‘’]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '');

const isValidSlug = (slug) => SLUG_PATTERN.test(slug) && !slug.includes('--');

module.exports = { slugify, isValidSlug, SLUG_PATTERN };
