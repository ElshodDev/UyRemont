// Katalog: filtrlar (reyting, tasdiqlangan, sharhi bor, tajriba, narx, bo'sh) va "tavsiya etilgan" saralash
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone } = require('./helpers');

describe('ustalar katalogi: filtrlar', () => {
    let app;
    // Faqat shu testning ustalari chiqishi uchun noyob tuman nomi
    const district = `Testtuman-${crypto.randomInt(100000, 999999)}`;
    const ids = {};

    const MASTERS = {
        A: { name: 'A Tajribali', verified: true, rating: 4.9, reviews: 50, exp: 12, rate: 100000, available: true },
        B: { name: 'B Yangi Besh', verified: true, rating: 5.0, reviews: 1, exp: 2, rate: 50000, available: true },
        C: { name: 'C Band', verified: false, rating: 4.2, reviews: 10, exp: 6, rate: 200000, available: false },
        D: { name: 'D Sharhsiz', verified: false, rating: 0, reviews: 0, exp: 0, rate: null, available: true },
    };

    const list = async (params = {}) => {
        const query = new URLSearchParams({ district, limit: '50', ...params });
        const res = await app.api(`/masters?${query}`);
        assert.equal(res.status, 200, res.data?.message);
        const byId = Object.fromEntries(Object.entries(ids).map(([key, id]) => [id, key]));
        return { keys: res.data.data.masters.map((m) => byId[m.id]), total: res.data.data.pagination.total };
    };

    before(async () => {
        app = await startApp();
        for (const [key, m] of Object.entries(MASTERS)) {
            const user = await app.tokenFor(randomPhone(), { name: m.name, role: 'master' });
            ids[key] = user.id;
            const [profile] = await app.db(
                `INSERT INTO master_profiles (user_id, district, is_verified, rating, reviews_count, experience_years, hourly_rate, is_available)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [user.id, district, m.verified, m.rating, m.reviews, m.exp, m.rate, m.available]
            );
            await app.db('INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, 1)', [profile.id]);
        }
    });
    after(() => app.close());

    it('tavsiya etilgan tartib: bo\'shlar, tasdiqlanganlar, sharhlar soni bilan tortilgan reyting', async () => {
        // A (4.9, 50 sharh) B (5.0, 1 sharh) dan oldin; band C oxirida
        assert.deepEqual((await list()).keys, ['A', 'B', 'D', 'C']);
        assert.deepEqual((await list({ sort_by: 'recommended' })).keys, ['A', 'B', 'D', 'C']);
    });

    it('reyting bo\'yicha: oddiy reyting tartibi', async () => {
        assert.deepEqual((await list({ sort_by: 'rating' })).keys, ['B', 'A', 'D', 'C']);
    });

    it('reyting, tasdiqlangan, sharhi bor, tajriba filtrlari', async () => {
        assert.deepEqual((await list({ min_rating: '4.5' })).keys, ['A', 'B']);
        assert.deepEqual((await list({ verified: 'true' })).keys, ['A', 'B']);
        assert.deepEqual((await list({ has_reviews: 'true' })).keys, ['A', 'B', 'C']);
        assert.deepEqual((await list({ min_experience: '5' })).keys, ['A', 'C']);
    });

    it('narx oralig\'i va "hozir bo\'sh"', async () => {
        assert.deepEqual((await list({ min_rate: '60000', max_rate: '150000' })).keys, ['A']);
        assert.deepEqual((await list({ available: 'true' })).keys, ['A', 'B', 'D']);
    });

    it('filtrlar birga ishlaydi, umumiy son to\'g\'ri', async () => {
        const result = await list({ verified: 'true', min_experience: '5' });
        assert.deepEqual(result.keys, ['A']);
        assert.equal(result.total, 1);
    });

    it('noto\'g\'ri qiymatlar e\'tiborsiz qoldiriladi', async () => {
        const result = await list({ min_rating: 'abc', min_experience: '-1', sort_by: 'DROP TABLE', verified: 'yes' });
        assert.deepEqual(result.keys, ['A', 'B', 'D', 'C']);
        assert.equal(result.total, 4);
    });
});
