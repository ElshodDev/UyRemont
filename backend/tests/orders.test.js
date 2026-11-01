// Buyurtma rasmlari (yopiq saqlash, ruxsatlar, EXIF) va taxminiy narxlar
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { startApp, randomPhone, waitFor, makeTestJpeg, imageForm } = require('./helpers');

describe('buyurtma rasmlari va narxlar', () => {
    let app;
    let jpeg;
    let client;
    let stranger;
    let otherMaster;
    let admin;

    const upload = (token, buffer = jpeg, type = 'image/jpeg') => app.api('/orders/photos', { method: 'POST', token, body: imageForm(buffer, { type }) });
    const getPhoto = (token, orderId, photoId) => fetch(`${app.url}/api/orders/${orderId}/photos/${photoId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    before(async () => {
        app = await startApp();
        jpeg = await makeTestJpeg();
        client = await app.tokenFor(randomPhone(), { name: 'Rasm Mijoz' });
        stranger = await app.tokenFor(randomPhone(), { name: 'Begona' });
        otherMaster = await app.tokenFor('+998902223344');
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
    });
    after(() => app.close());

    describe('rasmlar', () => {
        let photoId;
        let orderId;

        it('rasm yopiq papkaga webp bo\'lib, EXIF/GPS siz saqlanadi', async () => {
            const res = await upload(client.token);
            assert.equal(res.status, 201, res.data?.message);
            photoId = res.data.data.id;
            const [{ file_name: fileName }] = await app.db('SELECT file_name FROM order_photos WHERE id = $1', [photoId]);
            const meta = await sharp(path.join(process.env.ORDER_PHOTO_DIR, fileName)).metadata();
            assert.equal(meta.format, 'webp');
            assert.equal(meta.exif, undefined);
            assert.ok(Math.max(meta.width, meta.height) <= 1600);
            assert.equal((await fetch(`${app.url}/uploads/${fileName}`)).status, 404, 'ochiq /uploads orqali berilmaydi');
        });

        it('rasm qiyofasidagi boshqa fayl rad etiladi', async () => {
            const fake = Buffer.from('<?php system($_GET["c"]); ?>');
            assert.equal((await upload(client.token, fake)).status, 400);
        });

        it('qoralamani faqat egasi o\'chiradi', async () => {
            const draft = await upload(client.token);
            assert.equal((await app.api(`/orders/photos/${draft.data.data.id}`, { method: 'DELETE', token: stranger.token })).status, 404);
            assert.equal((await app.api(`/orders/photos/${draft.data.data.id}`, { method: 'DELETE', token: client.token })).status, 200);
        });

        it('buyurtmaga faqat o\'z qoralamalari biriktiriladi, ko\'pi bilan 3 ta', async () => {
            const strangerDraft = (await upload(stranger.token)).data.data.id;
            const tooMany = await app.api('/orders', {
                method: 'POST', token: client.token,
                body: { title: 'Rozetka', address: 'Uy 2', specialization_id: 2, photo_ids: [photoId, strangerDraft, photoId.replace(/.$/, '0'), photoId.replace(/.$/, '1')] },
            });
            assert.equal(tooMany.status, 400);
            const created = await app.api('/orders', {
                method: 'POST', token: client.token,
                body: { title: 'Rozetka ishlamayapti', address: 'Uy 2', specialization_id: 2, photo_ids: [photoId, strangerDraft] },
            });
            assert.equal(created.status, 201, created.data?.message);
            assert.deepEqual(created.data.data.photos, [photoId]);
            orderId = created.data.data.id;
        });

        it('rasmni mijoz, ochiq buyurtmani ko\'ra oladigan usta va admin ko\'radi', async () => {
            const own = await getPhoto(client.token, orderId, photoId);
            assert.equal(own.status, 200);
            assert.equal(own.headers.get('content-type'), 'image/webp');
            assert.match(own.headers.get('cache-control'), /private/);
            assert.equal((await getPhoto(otherMaster.token, orderId, photoId)).status, 200);
            assert.equal((await getPhoto(admin.token, orderId, photoId)).status, 200);
        });

        it('begona mijoz va kirmagan foydalanuvchi ko\'ra olmaydi', async () => {
            assert.equal((await getPhoto(stranger.token, orderId, photoId)).status, 403);
            assert.equal((await getPhoto(null, orderId, photoId)).status, 401);
            assert.equal((await getPhoto(client.token, '00000000-0000-4000-8000-000000000000', photoId)).status, 404);
        });

        it('buyurtma tafsilotida rasmlar ro\'yxati', async () => {
            const detail = await app.api(`/orders/${orderId}`, { token: client.token });
            assert.deepEqual(detail.data.data.photos, [photoId]);
        });

        it('qoralamalar soni cheklangan, eskilari tozalanadi', async () => {
            await app.db(`INSERT INTO order_photos (uploaded_by, file_name) SELECT $1, 'x' || g || '.webp' FROM generate_series(1, 12) g`, [stranger.id]);
            assert.equal((await upload(stranger.token)).status, 429);
            await app.db(`UPDATE order_photos SET created_at = NOW() - INTERVAL '25 hours' WHERE uploaded_by = $1 AND order_id IS NULL`, [stranger.id]);
            await upload(client.token);
            const left = await waitFor(async () => {
                const [{ total }] = await app.db('SELECT COUNT(*)::int as total FROM order_photos WHERE uploaded_by = $1 AND order_id IS NULL', [stranger.id]);
                return total === 0;
            });
            assert.ok(left, '24 soatdan eski qoralamalar o\'chirildi');
        });

        it('hisob o\'chirilganda rasm fayllari ham o\'chadi', async () => {
            const user = await app.tokenFor(randomPhone(), { name: 'O\'chiriladigan' });
            const photo = (await upload(user.token)).data.data.id;
            const [{ file_name: fileName }] = await app.db('SELECT file_name FROM order_photos WHERE id = $1', [photo]);
            assert.equal((await app.api('/auth/me', { method: 'DELETE', token: user.token, body: { confirm: true } })).status, 200);
            assert.ok(!fs.existsSync(path.join(process.env.ORDER_PHOTO_DIR, fileName)));
        });
    });

    describe('narxlar', () => {
        it('ommaviy ro\'yxat sohalar bo\'yicha guruhlangan', async () => {
            const res = await app.api('/prices');
            assert.equal(res.status, 200);
            const items = res.data.data.reduce((n, group) => n + group.items.length, 0);
            assert.ok(res.data.data.length >= 20 && items >= 70, `${res.data.data.length} soha, ${items} narx`);
            assert.equal(typeof res.data.data[0].call_fee, 'number');
        });

        it('admin narx qo\'shadi, yashiradi, o\'chiradi; jurnalga yoziladi', async () => {
            const spec = (await app.api('/prices')).data.data[0];
            assert.equal((await app.api('/admin/prices', { token: client.token })).status, 403);

            const created = await app.api('/admin/prices', {
                method: 'POST', token: admin.token,
                body: { specialization_id: spec.id, name: 'Sinov ishi', price_min: 10000, price_max: 20000, unit: 'dona' },
            });
            assert.equal(created.status, 201);
            const id = created.data.data.id;

            const invalid = await app.api(`/admin/prices/${id}`, { method: 'PUT', token: admin.token, body: { name: 'Sinov ishi', price_min: 50000, price_max: 20000 } });
            assert.equal(invalid.status, 400);

            await app.api(`/admin/prices/${id}`, { method: 'PUT', token: admin.token, body: { name: 'Sinov ishi', price_min: 15000, price_max: 25000, is_active: false } });
            const publicGroup = (await app.api('/prices')).data.data.find((g) => g.id === spec.id);
            assert.ok(!publicGroup.items.some((item) => item.id === id), 'yashirilgan narx ommaviy ro\'yxatda yo\'q');

            const fee = await app.api(`/admin/specializations/${spec.id}/call-fee`, { method: 'PUT', token: admin.token, body: { call_fee: 55000 } });
            assert.equal(fee.status, 200);
            assert.equal((await app.api('/prices')).data.data.find((g) => g.id === spec.id).call_fee, 55000);
            await app.api(`/admin/specializations/${spec.id}/call-fee`, { method: 'PUT', token: admin.token, body: { call_fee: spec.call_fee } });

            assert.equal((await app.api(`/admin/prices/${id}`, { method: 'DELETE', token: admin.token })).status, 200);
            const actions = (await app.api('/admin/audit', { token: admin.token })).data.data.slice(0, 10).map((e) => e.action);
            for (const action of ['price.create', 'price.update', 'price.call_fee', 'price.delete']) {
                assert.ok(actions.includes(action), `${action} jurnalda`);
            }
        });
    });
});
