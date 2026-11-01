// Qulayliklar: saqlangan manzillar, sevimli ustalar, ustaning ommaviy havolasi va QR kodi
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, randomPhone } = require('./helpers');

const MASTER_PHONE = '+998901112233';
const OTHER_MASTER_PHONE = '+998902223344';

describe('qulayliklar', () => {
    let app;
    let client;
    let stranger;
    let master;

    before(async () => {
        app = await startApp();
        client = await app.tokenFor(randomPhone(), { name: 'Manzil Mijoz' });
        stranger = await app.tokenFor(randomPhone(), { name: 'Begona Mijoz' });
        master = await app.tokenFor(MASTER_PHONE);
    });
    after(() => app.close());

    describe('saqlangan manzillar', () => {
        let homeId;

        it('manzil qo\'shiladi va ro\'yxatda chiqadi', async () => {
            const created = await app.api('/addresses', {
                method: 'POST',
                token: client.token,
                body: { label: 'Uy', address: 'Chilonzor 9-kvartal, 12-uy', district: 'Chilonzor', lat: 41.28, lng: 69.21 },
            });
            assert.equal(created.status, 201, created.data?.message);
            homeId = created.data.data.id;
            assert.equal(created.data.data.lat, 41.28);

            const list = await app.api('/addresses', { token: client.token });
            assert.deepEqual(list.data.data.map((a) => a.label), ['Uy']);
        });

        it('noto\'g\'ri ma\'lumot rad etiladi', async () => {
            const noLabel = await app.api('/addresses', { method: 'POST', token: client.token, body: { address: 'Biror joy' } });
            assert.equal(noLabel.status, 400);
            const badLat = await app.api('/addresses', { method: 'POST', token: client.token, body: { label: 'Ish', address: 'Biror joy', lat: 200, lng: 69 } });
            assert.equal(badLat.status, 400);
        });

        it('faqat yarim koordinata berilsa joylashuv saqlanmaydi', async () => {
            const res = await app.api('/addresses', { method: 'POST', token: client.token, body: { label: 'Ish', address: 'Amir Temur 1', lat: 41.3 } });
            assert.equal(res.status, 201);
            assert.equal(res.data.data.lat, null);
            await app.api(`/addresses/${res.data.data.id}`, { method: 'DELETE', token: client.token });
        });

        it('boshqa foydalanuvchi ko\'ra, o\'zgartira va o\'chira olmaydi', async () => {
            const list = await app.api('/addresses', { token: stranger.token });
            assert.equal(list.data.data.length, 0);
            const edit = await app.api(`/addresses/${homeId}`, { method: 'PUT', token: stranger.token, body: { label: 'Meniki' } });
            assert.equal(edit.status, 404);
            const del = await app.api(`/addresses/${homeId}`, { method: 'DELETE', token: stranger.token });
            assert.equal(del.status, 404);
        });

        it('nomi va manzili tahrirlanadi', async () => {
            const res = await app.api(`/addresses/${homeId}`, { method: 'PUT', token: client.token, body: { label: 'Uyim' } });
            assert.equal(res.status, 200);
            assert.equal(res.data.data.label, 'Uyim');
            assert.equal(res.data.data.address, 'Chilonzor 9-kvartal, 12-uy');
        });

        it('ko\'pi bilan 10 ta manzil', async () => {
            for (let i = 0; i < 9; i += 1) {
                await app.api('/addresses', { method: 'POST', token: client.token, body: { label: `Joy ${i}`, address: `Manzil ${i}` } });
            }
            const extra = await app.api('/addresses', { method: 'POST', token: client.token, body: { label: 'Ortiqcha', address: 'Manzil 11' } });
            assert.equal(extra.status, 400);
            assert.match(extra.data.message, /10 ta/);
        });

        it('kirmagan foydalanuvchi uchun yopiq', async () => {
            assert.equal((await app.api('/addresses')).status, 401);
        });
    });

    describe('sevimli ustalar', () => {
        let masterId;

        before(async () => {
            [{ id: masterId }] = await app.db('SELECT id FROM users WHERE phone = $1', [MASTER_PHONE]);
        });

        it('usta sevimlilarga qo\'shiladi (takroriy qo\'shish xato emas)', async () => {
            assert.equal((await app.api(`/favorites/${masterId}`, { method: 'POST', token: client.token })).status, 201);
            assert.equal((await app.api(`/favorites/${masterId}`, { method: 'POST', token: client.token })).status, 201);
            const ids = await app.api('/favorites/ids', { token: client.token });
            assert.deepEqual(ids.data.data, [masterId]);
        });

        it('ro\'yxat katalog kartochkasi formatida', async () => {
            const list = await app.api('/favorites', { token: client.token });
            assert.equal(list.data.data.length, 1);
            const card = list.data.data[0];
            assert.equal(card.id, masterId);
            assert.ok(Array.isArray(card.specializations) && card.specializations.length > 0);
            assert.ok(card.public_slug);
        });

        it('mijoz, admin yoki mavjud bo\'lmagan foydalanuvchini qo\'shib bo\'lmaydi', async () => {
            assert.equal((await app.api(`/favorites/${stranger.id}`, { method: 'POST', token: client.token })).status, 404);
            assert.equal((await app.api('/favorites/00000000-0000-4000-8000-000000000000', { method: 'POST', token: client.token })).status, 404);
            assert.equal((await app.api('/favorites/bu-uuid-emas', { method: 'POST', token: client.token })).status, 400);
        });

        it('usta o\'zini qo\'sha olmaydi', async () => {
            assert.equal((await app.api(`/favorites/${masterId}`, { method: 'POST', token: master.token })).status, 400);
        });

        it('olib tashlanadi', async () => {
            assert.equal((await app.api(`/favorites/${masterId}`, { method: 'DELETE', token: client.token })).status, 200);
            assert.deepEqual((await app.api('/favorites/ids', { token: client.token })).data.data, []);
        });
    });

    describe('ustaning ommaviy havolasi', () => {
        it('usta o\'z havolasini oladi', async () => {
            const res = await app.api('/masters/me/link', { token: master.token });
            assert.equal(res.status, 200);
            assert.equal(res.data.data.slug, 'jamshid-karimov');
            assert.equal(res.data.data.url, 'https://usta24.example.uz/u/jamshid-karimov');
        });

        it('mijoz uchun bu yo\'l yopiq', async () => {
            assert.equal((await app.api('/masters/me/link', { token: client.token })).status, 403);
        });

        it('havola bo\'yicha profil ochiladi (kirmasdan ham)', async () => {
            const res = await app.api('/masters/u/jamshid-karimov');
            assert.equal(res.status, 200);
            assert.equal(res.data.data.name, 'Jamshid Karimov');
            assert.ok(Array.isArray(res.data.data.portfolio));
            assert.equal((await app.api('/masters/u/bunday-usta-yoq')).status, 404);
            assert.equal((await app.api('/masters/u/..%2F..%2Fetc')).status, 404);
        });

        it('QR kod PNG sifatida qaytadi', async () => {
            const res = await fetch(`${app.url}/api/masters/u/jamshid-karimov/qr`);
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'image/png');
            const png = Buffer.from(await res.arrayBuffer());
            assert.equal(png.subarray(1, 4).toString(), 'PNG');
        });

        it('havola nomini o\'zgartirish: tekshiruv va bandlik', async () => {
            const bad = await app.api('/masters/me/link', { method: 'PUT', token: master.token, body: { slug: 'Ab' } });
            assert.equal(bad.status, 400);
            const otherMaster = await app.tokenFor(OTHER_MASTER_PHONE);
            const otherSlug = (await app.api('/masters/me/link', { token: otherMaster.token })).data.data.slug;
            const taken = await app.api('/masters/me/link', { method: 'PUT', token: master.token, body: { slug: otherSlug } });
            assert.equal(taken.status, 409);

            const ok = await app.api('/masters/me/link', { method: 'PUT', token: master.token, body: { slug: 'Jamshid-Santexnik' } });
            assert.equal(ok.status, 200);
            assert.equal(ok.data.data.slug, 'jamshid-santexnik');
            assert.equal((await app.api('/masters/u/jamshid-santexnik')).status, 200);
            assert.equal((await app.api('/masters/u/jamshid-karimov')).status, 404);

            await app.api('/masters/me/link', { method: 'PUT', token: master.token, body: { slug: 'jamshid-karimov' } });
        });

        it('yangi ustaga havola ismidan yaratiladi, band bo\'lsa raqam qo\'shiladi', async () => {
            const twin = await app.tokenFor(randomPhone(), { name: 'Jamshid Karimov', role: 'master' });
            await app.db('INSERT INTO master_profiles (id, user_id) VALUES (gen_random_uuid(), $1)', [twin.id]);
            const res = await app.api('/masters/me/link', { token: twin.token });
            assert.equal(res.status, 200);
            assert.match(res.data.data.slug, /^jamshid-karimov-\d+$/);
        });
    });

    describe('hisob o\'chirilganda', () => {
        it('manzillar va sevimlilar ham o\'chadi', async () => {
            const user = await app.tokenFor(randomPhone(), { name: 'O\'chiriladigan' });
            const [{ id: masterId }] = await app.db('SELECT id FROM users WHERE phone = $1', [MASTER_PHONE]);
            await app.api('/addresses', { method: 'POST', token: user.token, body: { label: 'Uy', address: 'Yunusobod 4' } });
            await app.api(`/favorites/${masterId}`, { method: 'POST', token: user.token });

            const res = await app.api('/auth/me', { method: 'DELETE', token: user.token, body: { confirm: true } });
            assert.equal(res.status, 200, res.data?.message);
            const [{ addresses, favorites }] = await app.db(
                `SELECT (SELECT COUNT(*)::int FROM saved_addresses WHERE user_id = $1) as addresses,
                        (SELECT COUNT(*)::int FROM favorite_masters WHERE user_id = $1) as favorites`,
                [user.id]
            );
            assert.equal(addresses, 0);
            assert.equal(favorites, 0);
        });
    });
});
