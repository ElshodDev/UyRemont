// =============================================
// UyRemont - Havola ko'rinishi (Open Graph): usta /u/<slug> havolasini Telegram, WhatsApp va
// boshqa ilovalarda ulashganda ism, reyting va soha yozilgan kartochka chiqadi.
// Bu ilovalar JavaScript ishlatmaydi, shuning uchun sahifa sarlavhalari serverda yoziladi.
// =============================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { query } = require('../config/database');
const { appUrl } = require('../config/app');

const SITE_NAME = 'Usta24';
const DEFAULT_DESCRIPTION = 'Uy, avto va texnika ustalari: eng yaqin ustani bir tugma bilan chaqiring';
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Saytning build qilingan index.html fayli (Docker'da /app/web/dist/index.html)
const WEB_INDEX_HTML = process.env.WEB_INDEX_HTML
    || path.join(__dirname, '..', '..', '..', 'web', 'dist', 'index.html');

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clip = (text, max) => {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
};

const plural = (n, word) => `${n} ta ${word}`;

/**
 * Ommaviy ma'lumotlar (telefon raqam kirmaydi)
 * @returns {Promise<object|null>}
 */
const loadPublicMaster = async (slug) => {
    const result = await query(
        `SELECT u.name, mp.public_slug as slug, mp.bio, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count,
                (SELECT COUNT(*)::int FROM orders o WHERE o.master_id = u.id AND o.status = 'completed') as completed_orders,
                COALESCE((SELECT json_agg(s.name_uz ORDER BY s.id)
                          FROM master_specializations ms JOIN specializations s ON s.id = ms.specialization_id
                          WHERE ms.master_id = mp.id AND s.is_active = TRUE), '[]') as specializations
         FROM master_profiles mp JOIN users u ON u.id = mp.user_id
         WHERE mp.public_slug = $1 AND u.is_active = TRUE AND u.role = 'master' AND u.deleted_at IS NULL`,
        [slug]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
        ...row,
        name: row.name || 'Usta',
        rating: Number(row.rating) || 0,
        reviews_count: Number(row.reviews_count) || 0,
    };
};

const ratingText = (master) => (master.reviews_count > 0
    ? `${master.rating.toFixed(1)} (${plural(master.reviews_count, 'sharh')})`
    : 'Yangi usta');

const locationText = (master) => [master.city, master.district].filter(Boolean).join(', ');

/**
 * Sarlavha va tavsif (meta teglar va kartochka uchun umumiy)
 */
const describeMaster = (master) => {
    const specs = master.specializations.slice(0, 3).join(', ');
    const title = `${master.name}${specs ? ` — ${specs}` : ''} | ${SITE_NAME}`;
    const facts = [
        master.reviews_count > 0 ? `⭐ ${ratingText(master)}` : null,
        master.completed_orders > 0 ? plural(master.completed_orders, 'bajarilgan ish') : null,
        locationText(master) || null,
        master.is_verified ? 'Tasdiqlangan usta' : null,
    ].filter(Boolean).join(' · ');
    const bio = clip(master.bio, 120);
    const description = clip(`${facts ? `${facts}. ` : ''}${bio ? `${bio} ` : ''}${SITE_NAME} orqali bir tugma bilan chaqiring.`, 200);
    return { title: clip(title, 90), description };
};

/**
 * Kartochka rasmi versiyasi: ma'lumot o'zgarsa yangi manzil (keshlar eski rasmni ko'rsatmaydi)
 */
const imageVersion = (master) => crypto.createHash('sha1')
    .update(JSON.stringify([master.name, master.rating, master.reviews_count, master.completed_orders,
        master.specializations, master.city, master.district, master.is_verified]))
    .digest('hex')
    .slice(0, 10);

const masterImageUrl = (master) => appUrl(`/api/masters/u/${master.slug}/og.png?v=${imageVersion(master)}`);

const metaTags = ({ title, description, url, image, type = 'website' }) => [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    '<meta property="og:locale" content="uz_UZ" />',
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    url ? `<meta property="og:url" content="${escapeHtml(url)}" />` : null,
    url ? `<link rel="canonical" href="${escapeHtml(url)}" />` : null,
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : null,
    image ? `<meta property="og:image:width" content="${OG_WIDTH}" />` : null,
    image ? `<meta property="og:image:height" content="${OG_HEIGHT}" />` : null,
    image ? `<meta property="og:image:alt" content="${escapeHtml(title)}" />` : null,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
].filter(Boolean).join('\n    ');

// index.html keshi (fayl o'zgarsa qayta o'qiladi)
let templateCache = { mtimeMs: 0, html: null };

const readTemplate = () => {
    try {
        const stat = fs.statSync(WEB_INDEX_HTML);
        if (stat.mtimeMs !== templateCache.mtimeMs || !templateCache.html) {
            templateCache = { mtimeMs: stat.mtimeMs, html: fs.readFileSync(WEB_INDEX_HTML, 'utf8') };
        }
        return templateCache.html;
    } catch {
        return null;
    }
};

// Sayt build qilinmagan bo'lsa (development): faqat meta teglar va havola
const fallbackTemplate = () => `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${SITE_NAME}</title>
    <!-- og:start --><!-- og:end -->
  </head>
  <body><p><a href="__URL__">${SITE_NAME} da ochish</a></p></body>
</html>`;

const OG_BLOCK = /<!-- og:start -->[\s\S]*?<!-- og:end -->/;

/**
 * index.html ga sahifa sarlavhasi va meta teglarni joylash
 */
const renderPage = ({ title, description, url, image, type }) => {
    let html = readTemplate() || fallbackTemplate().replace('__URL__', escapeHtml(url || appUrl('/')));
    const block = `<!-- og:start -->\n    ${metaTags({ title, description, url, image, type })}\n    <!-- og:end -->`;
    // Sayt tavsifi ham og bloki ichida (web/vite.config.js), shuning uchun butun blok almashtiriladi
    html = OG_BLOCK.test(html) ? html.replace(OG_BLOCK, () => block) : html.replace('</head>', () => `${block}\n  </head>`);
    return html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`);
};

const renderMasterPage = (master) => {
    const { title, description } = describeMaster(master);
    return renderPage({ title, description, url: appUrl(`/u/${master.slug}`), image: masterImageUrl(master), type: 'profile' });
};

// Ustalar uchun qo'llanma (/ustalar): usta jalb qilish uchun Telegram guruhlarda ulashiladi
const GUIDE_CARD = {
    title: 'Ustamisiz? Mijozlar sizni o\'zi topadi',
    lines: ['Yaqin atrofdagi buyurtmalar telefoningizga keladi', 'Ro\'yxatdan o\'tish bepul'],
};

const renderGuidePage = () => renderPage({
    title: `Ustalar uchun: yangi mijozlar toping | ${SITE_NAME}`,
    description: 'Ish rejimini yoqing — eng yaqin mijozlarning chaqiruvlari telefoningizga keladi. '
        + 'Ro\'yxatdan o\'tish bepul, komissiya faqat bajarilgan ishdan. Qanday boshlash va ishlash qoidalari.',
    url: appUrl('/ustalar'),
    image: appUrl('/og-ustalar.png'),
});

const renderNotFoundPage = () => renderPage({
    title: `Usta topilmadi | ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    url: null,
    image: appUrl('/og.png'),
});

// ---------------- Kartochka rasmi (1200x630 PNG) ----------------

const FONT = 'Inter, DejaVu Sans, Arial, sans-serif';

const initials = (name) => String(name || 'U').trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0]).join('').toUpperCase() || 'U';

/**
 * Matn kenglikka sig'ishi uchun shrift o'lchami (taxminiy: o'rtacha harf kengligi ~0.58em)
 */
const fitText = (text, maxWidth, maxSize, minSize, ratio = 0.58) => {
    const value = String(text);
    const size = Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / (value.length * ratio))));
    const maxChars = Math.floor(maxWidth / (size * ratio));
    return { size, text: value.length > maxChars ? `${value.slice(0, maxChars - 1).trimEnd()}…` : value };
};

/**
 * Matnni so'zlar bo'yicha qatorlarga bo'lish (ortig'i oxirgi qatorda "…" bilan)
 */
const wrapWords = (text, maxChars, maxLines) => {
    const lines = [];
    let current = '';
    for (const word of String(text).split(/\s+/)) {
        if (current && `${current} ${word}`.length > maxChars) {
            lines.push(current);
            current = word;
        } else {
            current = current ? `${current} ${word}` : word;
        }
    }
    if (current) lines.push(current);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1).trimEnd()}…`;
    return kept;
};

/**
 * Ro'yxatni bir qatorga sig'dirish: sig'maganlari "+N" bo'ladi
 */
const fitList = (items, maxWidth, size, ratio) => {
    const maxChars = Math.floor(maxWidth / (size * ratio));
    const shown = [];
    for (let i = 0; i < items.length; i += 1) {
        const rest = items.length - i - 1;
        const candidate = [...shown, items[i]].join(' · ') + (rest > 0 ? ` +${rest}` : '');
        if (candidate.length > maxChars && shown.length > 0) break;
        shown.push(items[i]);
    }
    const hidden = items.length - shown.length;
    const text = (shown.join(' · ') || 'Usta') + (hidden > 0 ? ` +${hidden}` : '');
    return { size, text: text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text };
};

const ICON_WRENCH = 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z';
const ICON_STAR = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
const ICON_PIN = 'M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const ICON_CHECK = 'M5 12.5l4.5 4.5L19 7.5';

/**
 * Kartochka SVG'si. master bo'lmasa - saytning umumiy kartochkasi (site: { title, lines } bilan boshqa sahifa uchun)
 */
const buildCardSvg = (master, { host, site } = {}) => {
    const e = escapeHtml;
    const brand = `
      <rect x="80" y="64" width="64" height="64" rx="16" fill="#ffffff" fill-opacity="0.16"/>
      <svg x="92" y="76" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON_WRENCH}"/></svg>
      <text x="164" y="110" font-family="${FONT}" font-size="40" font-weight="800" fill="#ffffff">Usta<tspan fill="#bfdbfe">24</tspan></text>`;
    const background = `
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#4338ca"/>
        </linearGradient>
      </defs>
      <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
      <circle cx="1120" cy="-40" r="260" fill="#ffffff" fill-opacity="0.06"/>
      <circle cx="1180" cy="640" r="200" fill="#ffffff" fill-opacity="0.05"/>`;

    if (!master) {
        const card = site || { title: 'Usta topish endi oson', lines: ['Uy, avto va texnika ustalari', 'Eng yaqin ustani bir tugma bilan chaqiring'] };
        // Sarlavha sig'masa ikki qatorga bo'linadi
        const titleLines = wrapWords(card.title, Math.floor((OG_WIDTH - 160) / (72 * 0.58)), 2);
        const titleSize = titleLines.length > 1 ? 68 : 76;
        const titleTop = titleLines.length > 1 ? 250 : 300;
        const linesTop = titleTop + (titleLines.length - 1) * 80 + 72;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
      ${background}${brand}
      ${titleLines.map((line, i) => `<text x="80" y="${titleTop + i * 80}" font-family="${FONT}" font-size="${titleSize}" font-weight="800" fill="#ffffff">${e(line)}</text>`).join('\n      ')}
      ${card.lines.map((line, i) => `<text x="80" y="${linesTop + i * 48}" font-family="${FONT}" font-size="34" font-weight="500" fill="#ffffff" fill-opacity="0.88">${e(line)}</text>`).join('\n      ')}
      ${host ? `<text x="80" y="566" font-family="${FONT}" font-size="30" font-weight="600" fill="#ffffff" fill-opacity="0.75">${e(host)}</text>` : ''}
    </svg>`;
    }

    const textX = 330;
    const textWidth = OG_WIDTH - textX - 80;
    const name = fitText(master.name, textWidth, 68, 44, 0.64);
    const specs = fitList(master.specializations, textWidth, 32, 0.56);
    const location = locationText(master);
    const rating = master.reviews_count > 0 ? master.rating.toFixed(1) : null;
    const facts = [
        master.reviews_count > 0 ? plural(master.reviews_count, 'sharh') : null,
        master.completed_orders > 0 ? plural(master.completed_orders, 'bajarilgan ish') : null,
    ].filter(Boolean).join(' · ');
    const link = host ? `${host}/u/${master.slug}` : `/u/${master.slug}`;

    let y = 222;
    const lines = [];
    if (master.is_verified) {
        lines.push(`
      <rect x="${textX}" y="${y - 44}" width="292" height="52" rx="26" fill="#ffffff"/>
      <svg x="${textX + 16}" y="${y - 32}" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON_CHECK}"/></svg>
      <text x="${textX + 52}" y="${y - 9}" font-family="${FONT}" font-size="26" font-weight="700" fill="#1e3a8a">Tasdiqlangan usta</text>`);
        y += 76;
    }
    lines.push(`<text x="${textX}" y="${y}" font-family="${FONT}" font-size="${name.size}" font-weight="800" fill="#ffffff">${e(name.text)}</text>`);
    y += 56;
    lines.push(`<text x="${textX}" y="${y}" font-family="${FONT}" font-size="${specs.size}" font-weight="600" fill="#ffffff" fill-opacity="0.9">${e(specs.text)}</text>`);
    y += 66;
    if (rating) {
        lines.push(`
      <svg x="${textX}" y="${y - 34}" width="40" height="40" viewBox="0 0 24 24"><path d="${ICON_STAR}" fill="#fbbf24"/></svg>
      <text x="${textX + 52}" y="${y}" font-family="${FONT}" font-size="38" font-weight="800" fill="#ffffff">${rating}</text>
      <text x="${textX + 52 + rating.length * 24 + 16}" y="${y}" font-family="${FONT}" font-size="30" font-weight="500" fill="#ffffff" fill-opacity="0.85">${e(facts)}</text>`);
    } else {
        lines.push(`<text x="${textX}" y="${y}" font-family="${FONT}" font-size="30" font-weight="600" fill="#ffffff" fill-opacity="0.85">${e(facts ? `Yangi usta · ${facts}` : 'Yangi usta')}</text>`);
    }
    if (location) {
        y += 56;
        const loc = fitText(location, textWidth - 48, 30, 24, 0.55);
        lines.push(`
      <svg x="${textX}" y="${y - 30}" width="36" height="36" viewBox="0 0 24 24"><path d="${ICON_PIN}" fill="#ffffff" fill-opacity="0.85" fill-rule="evenodd"/></svg>
      <text x="${textX + 48}" y="${y}" font-family="${FONT}" font-size="${loc.size}" font-weight="500" fill="#ffffff" fill-opacity="0.85">${e(loc.text)}</text>`);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
      ${background}${brand}
      <circle cx="190" cy="300" r="110" fill="#ffffff" fill-opacity="0.16"/>
      <circle cx="190" cy="300" r="96" fill="#ffffff"/>
      <text x="190" y="300" dy="0.35em" text-anchor="middle" font-family="${FONT}" font-size="76" font-weight="800" fill="#2563eb">${e(initials(master.name))}</text>
      ${lines.join('\n      ')}
      <rect x="0" y="${OG_HEIGHT - 96}" width="${OG_WIDTH}" height="96" fill="#0f172a" fill-opacity="0.22"/>
      <text x="80" y="${OG_HEIGHT - 38}" font-family="${FONT}" font-size="28" font-weight="600" fill="#ffffff" fill-opacity="0.9">${e(fitText(link, 640, 28, 22, 0.55).text)}</text>
      <text x="${OG_WIDTH - 80}" y="${OG_HEIGHT - 38}" text-anchor="end" font-family="${FONT}" font-size="28" font-weight="700" fill="#ffffff">Ustani chaqirish →</text>
    </svg>`;
};

const siteHost = () => {
    try {
        return new URL(appUrl('/')).host;
    } catch {
        return '';
    }
};

// Tayyor rasmlar keshi: bir xil ma'lumot uchun qayta chizilmaydi
const IMAGE_CACHE_LIMIT = 200;
const imageCache = new Map();

/**
 * @returns {Promise<Buffer>} PNG
 */
const renderCardPng = async (master) => {
    const key = master ? `${master.slug}:${imageVersion(master)}` : 'default';
    const cached = imageCache.get(key);
    if (cached) return cached;
    const png = await sharp(Buffer.from(buildCardSvg(master, { host: siteHost() })))
        .png({ compressionLevel: 9, palette: false })
        .toBuffer();
    if (imageCache.size >= IMAGE_CACHE_LIMIT) imageCache.delete(imageCache.keys().next().value);
    imageCache.set(key, png);
    return png;
};

module.exports = {
    loadPublicMaster,
    renderMasterPage,
    renderNotFoundPage,
    renderGuidePage,
    renderCardPng,
    GUIDE_CARD,
    buildCardSvg,
    describeMaster,
    escapeHtml,
    OG_WIDTH,
    OG_HEIGHT,
    DEFAULT_DESCRIPTION,
};
