// 1 daqiqada usta bo'lish: soha + tuman (+ ism) bilan bitta so'rovda usta profili
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone } = require('./helpers');

describe('1 daqiqada usta bo\'lish', () => {
    let app;
    const district = `Tezkortuman-${crypto.randomInt(100000, 999999)}`;
    const quick = (token, body, headers) => app.api('/masters/quick-start', { method: 'POST', token, body, headers });

    before(async () => {
        app = await startApp();
    });
    after(() => app.close());

    it('mijoz soha va tumanni tanlab darhol usta bo\'ladi va katalogda chiqadi', async () => {
        const client = await app.tokenFor(randomPhone(), { name: 'Tezkor Usta' });
        const res = await quick(client.token, { specialization_ids: [1, 2], district });
        assert.equal(res.status, 201, res.data?.message);
        assert.equal(res.data.message, 'Tabriklaymiz! Siz endi Usta24 ustasisiz');

        const me = await app.api('/auth/me', { token: client.token });
        assert.equal(me.data.data.role, 'master');
        assert.deepEqual(me.data.data.specialization_ids, [1, 2]);
        assert.equal(me.data.data.district, district);
        assert.equal(me.data.data.hourly_rate, null, 'narx keyin to\'ldiriladi ("Narx kelishiladi")');
        assert.equal(me.data.data.experience_years, 0);
        assert.equal(me.data.data.is_available, true);

        const list = await app.api(`/masters?district=${encodeURIComponent(district)}`);
        assert.deepEqual(list.data.data.masters.map((m) => m.id), [client.id]);
        assert.deepEqual(list.data.data.masters[0].specializations.map((s) => s.id), [1, 2]);
    });

    it('ismsiz yangi foydalanuvchidan ism so\'raladi', async () => {
        const fresh = await app.tokenFor(randomPhone(), { name: null });
        const noName = await quick(fresh.token, { specialization_ids: [3], district });
        assert.equal(noName.status, 400);
        assert.equal(noName.data.message, 'Ismingizni kiriting');
        const short = await quick(fresh.token, { specialization_ids: [3], district, name: 'A' });
        assert.equal(short.status, 400);
        const ok = await quick(fresh.token, { specialization_ids: [3], district, name: 'Botir Karimov' });
        assert.equal(ok.status, 201);
        assert.equal((await app.api('/auth/me', { token: fresh.token })).data.data.name, 'Botir Karimov');
    });

    it('noto\'g\'ri soha, tuman, ism yoki rol rad etiladi; xabar ruscha ham', async () => {
        const client = await app.tokenFor(randomPhone());
        for (const ids of [[], [0], ['1'], 'santexnik', Array.from({ length: 11 }, (_, i) => i + 1)]) {
            const res = await quick(client.token, { specialization_ids: ids, district });
            assert.equal(res.status, 400, JSON.stringify(ids));
        }
        assert.equal((await quick(client.token, { specialization_ids: [999999], district })).status, 400);
        assert.equal((await quick(client.token, { specialization_ids: [1] })).status, 400);
        const phoneName = await quick(client.token, { specialization_ids: [1], district, name: 'Ali 90 123 45 67' });
        assert.equal(phoneName.status, 400);
        assert.match(phoneName.data.message, /Telefon raqam yoki Telegram/);
        const ru = await quick(client.token, { specialization_ids: [] , district }, { 'Accept-Language': 'ru' });
        assert.equal(ru.data.message, 'Выберите хотя бы одну специализацию (не более 10)');
        // Hech narsa o'zgarmagan: hali mijoz
        assert.equal((await app.api('/auth/me', { token: client.token })).data.data.role, 'client');

        const admin = await app.tokenFor('+998900000000', { role: 'admin' });
        assert.equal((await quick(admin.token, { specialization_ids: [1], district })).status, 400);
        assert.equal((await quick(null, { specialization_ids: [1], district })).status, 401);
    });

    it('usta qayta chaqirsa soha va tuman yangilanadi, qolgan ma\'lumotlar saqlanadi', async () => {
        const master = await app.tokenFor(randomPhone(), { name: 'Eski Usta' });
        assert.equal((await quick(master.token, { specialization_ids: [1], district })).status, 201);
        const saved = await app.api('/masters/profile', {
            method: 'PUT', token: master.token, body: { bio: 'Tajribali santexnik', hourly_rate: 90000, experience_years: 7 },
        });
        assert.equal(saved.status, 200, saved.data?.message);

        const again = await quick(master.token, { specialization_ids: [4, 5], district: 'Sergeli' });
        assert.equal(again.status, 200);
        const me = (await app.api('/auth/me', { token: master.token })).data.data;
        assert.deepEqual(me.specialization_ids, [4, 5]);
        assert.equal(me.district, 'Sergeli');
        assert.equal(me.bio, 'Tajribali santexnik');
        assert.equal(Number(me.hourly_rate), 90000);
        assert.equal(me.experience_years, 7);
    });
});
