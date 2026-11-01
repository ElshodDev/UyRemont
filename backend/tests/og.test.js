// Havola ko'rinishi: /u/<slug> sahifasidagi meta teglar va kartochka rasmi
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { startApp, randomPhone } = require('./helpers');

// Saytning build qilingan index.html'iga o'xshash shablon
const TEMPLATE = `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="UTF-8" />
    <!-- og:start -->
    <meta name="description" content="Sayt tavsifi" />
    <meta property="og:title" content="Usta24" />
    <!-- og:end -->
    <title>Usta24 — Usta topish endi oson!</title>
    <script type="module" crossorigin src="/assets/index-test.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const page = async (app, pathname) => {
    const res = await fetch(`${app.url}${pathname}`);
    return { status: res.status, headers: res.headers, html: await res.text() };
};

const meta = (html, property) => {
    const match = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`));
    return match ? match[1] : null;
};

describe('havola ko\'rinishi (Open Graph)', () => {
    let app;
    let master;
    const slug = `og-usta-${crypto.randomInt(100000, 999999)}`;
    const NAME = 'Ali "Usta" <script>alert(1)</script> & Co';

    before(async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usta24-og-'));
        process.env.WEB_INDEX_HTML = path.join(dir, 'index.html');
        fs.writeFileSync(process.env.WEB_INDEX_HTML, TEMPLATE);
        app = await startApp();

        master = await app.tokenFor(randomPhone(), { name: NAME, role: 'master' });
        await app.db('UPDATE users SET name = $2 WHERE id = $1', [master.id, NAME]);
        const [profile] = await app.db(
            `INSERT INTO master_profiles (user_id, public_slug, district, city, is_verified, rating, reviews_count, bio)
             VALUES ($1, $2, 'Chilonzor', 'Toshkent', TRUE, 4.86, 23, 'Santexnika ishlari, 10 yillik tajriba')
             RETURNING id`,
            [master.id, slug]
        );
        await app.db(
            `INSERT INTO master_specializations (master_id, specialization_id)
             SELECT $1, id FROM specializations WHERE is_active = TRUE ORDER BY id LIMIT 2`,
            [profile.id]
        );
    });
    after(() => app.close());

    it('usta sahifasida ism, reyting va to\'liq rasm manzili bor', async () => {
        const res = await page(app, `/u/${slug}`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type'), /text\/html/);
        assert.equal(res.headers.get('cache-control'), 'no-cache');

        const title = meta(res.html, 'og:title');
        assert.ok(title.startsWith('Ali &quot;Usta&quot; &lt;script&gt;'), title);
        assert.match(res.html, /<title>Ali &quot;Usta&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Co — /);
        assert.match(meta(res.html, 'og:description'), /⭐ 4\.9 \(23 ta sharh\) · Toshkent, Chilonzor · Tasdiqlangan usta/);
        assert.equal(meta(res.html, 'og:url'), `https://usta24.example.uz/u/${slug}`);
        assert.match(meta(res.html, 'og:image'), new RegExp(`^https://usta24\\.example\\.uz/api/masters/u/${slug}/og\\.png\\?v=[0-9a-f]{10}$`));
        assert.equal(meta(res.html, 'twitter:card'), 'summary_large_image');
        assert.equal(meta(res.html, 'og:type'), 'profile');
    });

    it('shablondagi sayt teglari almashtiriladi, skript va tuzilma saqlanadi', async () => {
        const { html } = await page(app, `/u/${slug}`);
        assert.ok(!html.includes('<script>alert'), 'ism HTML sifatida kirib qolmasligi kerak');
        assert.ok(!html.includes('Sayt tavsifi'));
        assert.equal((html.match(/<meta name="description"/g) || []).length, 1);
        assert.equal((html.match(/<title>/g) || []).length, 1);
        assert.ok(html.includes('<script type="module" crossorigin src="/assets/index-test.js"></script>'));
        assert.ok(html.includes('<div id="root"></div>'));
    });

    it('telefon raqam sahifaga chiqmaydi', async () => {
        const [user] = await app.db('SELECT phone FROM users WHERE id = $1', [master.id]);
        const { html } = await page(app, `/u/${slug}`);
        assert.ok(!html.includes(user.phone.slice(4)));
    });

    it('kartochka rasmi 1200x630 PNG', async () => {
        const res = await fetch(`${app.url}/api/masters/u/${slug}/og.png`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('content-type'), 'image/png');
        assert.match(res.headers.get('cache-control'), /max-age=86400/);
        const info = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
        assert.equal(info.width, 1200);
        assert.equal(info.height, 630);
    });

    it('ma\'lumot o\'zgarsa rasm manzili ham o\'zgaradi', async () => {
        const before = meta((await page(app, `/u/${slug}`)).html, 'og:image');
        await app.db('UPDATE master_profiles SET rating = 4.5, reviews_count = 24 WHERE user_id = $1', [master.id]);
        const after = meta((await page(app, `/u/${slug}`)).html, 'og:image');
        assert.notEqual(before, after);
    });

    it('mavjud bo\'lmagan yoki noto\'g\'ri havola: 404 va saytning umumiy kartochkasi', async () => {
        for (const pathname of ['/u/bunday-usta-yoq-123', '/u/..%2F..%2Fetc', '/u/A']) {
            const res = await page(app, pathname);
            assert.equal(res.status, 404, pathname);
            assert.match(res.html, /<title>Usta topilmadi \| Usta24<\/title>/);
            assert.equal(meta(res.html, 'og:image'), 'https://usta24.example.uz/og.png');
        }
        assert.equal((await fetch(`${app.url}/api/masters/u/bunday-usta-yoq-123/og.png`)).status, 404);
    });

    it('bloklangan usta ko\'rsatilmaydi', async () => {
        await app.db('UPDATE users SET is_active = FALSE WHERE id = $1', [master.id]);
        try {
            assert.equal((await page(app, `/u/${slug}`)).status, 404);
            assert.equal((await fetch(`${app.url}/api/masters/u/${slug}/og.png`)).status, 404);
        } finally {
            await app.db('UPDATE users SET is_active = TRUE WHERE id = $1', [master.id]);
        }
    });
});
