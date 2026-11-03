// Usta ro'yxatdan o'tishi bilan ishga chiqadi: admin tasdiqlashini kutmaydi, faqat pasport ma'lumotlari kerak.
// Admin pasportni rad etsa - qayta yubormaguncha ishga chiqa olmaydi.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, randomPhone, waitFor, makeTestJpeg, imageForm } = require('./helpers');

// Boshqa testlardagi ustalardan uzoqroq nuqta (Sergeli)
const POINT = { lat: 41.2270, lng: 69.2190 };
const ORDER_POINT = { lat: 41.2280, lng: 69.2190 };

describe('admin tasdiqlashisiz ishga chiqish', () => {
    let app;
    let admin;
    let master;

    const online = (body = POINT) => app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: true, ...body } });
    const state = async () => (await app.api('/dispatch/me', { token: master.token })).data.data;
    const submitPassport = async () => {
        const upload = await app.api('/masters/me/documents', { method: 'POST', token: master.token, body: imageForm(await makeTestJpeg(), { fields: { kind: 'passport' } }) });
        assert.equal(upload.status, 201, upload.data?.message);
        const sent = await app.api('/masters/me/verification', { method: 'POST', token: master.token });
        assert.equal(sent.status, 200, sent.data?.message);
    };

    before(async () => {
        app = await startApp();
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
        // Boshqa testlardan qolgan holat: hech kim ish rejimida emas, faol chaqiruvlar yo'q
        await app.db(`UPDATE dispatch_offers SET status = 'cancelled' WHERE status = 'pending'`);
        await app.db(`UPDATE orders SET status = 'cancelled' WHERE mode = 'instant' AND status IN ('searching', 'accepted', 'arrived', 'in_progress')`);
        await app.db('UPDATE master_profiles SET is_online = FALSE');

        master = await app.tokenFor(randomPhone(), { name: 'Yangi Usta' });
        const quick = await app.api('/masters/quick-start', { method: 'POST', token: master.token, body: { specialization_ids: [1], district: 'Sergeli' } });
        assert.equal(quick.status, 201, quick.data?.message);
    });
    after(async () => {
        await app.db('UPDATE master_profiles SET is_online = FALSE WHERE user_id = $1', [master.id]);
        await app.close();
    });

    it('pasport ma\'lumotlarisiz ishga chiqib bo\'lmaydi', async () => {
        const s = await state();
        assert.equal(s.requirements.identity_ok, false);
        assert.equal(s.requirements.can_go_online, false);
        const res = await online();
        assert.equal(res.status, 403);
        assert.match(res.data.message, /pasport ma'lumotlari kiritilmagan/);
    });

    it('pasport kiritilgach darhol ishga chiqadi va chaqiruv oladi (tasdiqlanmagan bo\'lsa ham)', async () => {
        const saved = await app.api('/masters/me/identity', {
            method: 'PUT', token: master.token, body: { first_name: 'Yangi', last_name: 'Ustayev', passport: `AD${Math.floor(1000000 + Math.random() * 8999999)}` },
        });
        assert.equal(saved.status, 200, saved.data?.message);
        await submitPassport();

        const s = await state();
        assert.equal(s.requirements.identity_ok, true);
        assert.equal(s.requirements.verified, false);
        assert.equal(s.requirements.can_go_online, true);
        const res = await online();
        assert.equal(res.status, 200, res.data?.message);

        const client = await app.tokenFor(randomPhone(), { name: 'Sergeli Mijoz' });
        const order = await app.api('/dispatch/orders', {
            method: 'POST', token: client.token, body: { specialization_id: 1, ...ORDER_POINT, address: 'Sergeli 5' },
        });
        assert.equal(order.status, 201, order.data?.message);
        const offer = await waitFor(async () => (await state()).pending_offer);
        assert.ok(offer, 'tasdiqlanmagan, lekin pasportli ustaga taklif keldi');
        assert.equal(offer.order_id, order.data.data.id);
        await app.api(`/dispatch/offers/${offer.offer_id}/decline`, { method: 'POST', token: master.token });
        await app.api(`/dispatch/orders/${order.data.data.id}/cancel`, { method: 'POST', token: client.token, body: { reason: 'Rejalar o\'zgardi' } });
    });

    it('admin rad etsa ish rejimi o\'chadi; qayta yuborgach yana ishga chiqadi', async () => {
        await online();
        const rejected = await app.api(`/admin/verifications/${master.id}/reject`, {
            method: 'POST', token: admin.token, body: { note: 'Rasm xira, raqam o\'qilmaydi' },
        });
        assert.equal(rejected.status, 200, rejected.data?.message);

        const s = await state();
        assert.equal(s.is_online, false, 'ish rejimi o\'chirildi');
        assert.equal(s.requirements.rejected, true);
        assert.equal(s.requirements.can_go_online, false);
        const blocked = await online();
        assert.equal(blocked.status, 403);
        assert.match(blocked.data.message, /pasportingiz tasdiqlanmadi/);
        const notice = await waitFor(() => app.telegram.sent.find((m) => m.text.includes('Qayta yubormaguningizcha')), { timeout: 1500 }).catch(() => null);
        // Telegram ulanmagan bo'lsa xabar yuborilmaydi - bu holat ham to'g'ri
        if (notice) assert.match(notice.text, /Rasm xira/);

        await submitPassport();
        const again = await state();
        assert.equal(again.requirements.rejected, false);
        assert.equal(again.requirements.can_go_online, true);
        assert.equal((await online()).status, 200);
    });
});
