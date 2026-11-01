// Tezkor chaqiruv: eng yaqin ustaga taklif, sevimli usta ustunligi, bosqichlar va bekor qilish
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, randomPhone, waitFor } = require('./helpers');

const NEAR_MASTER = '+998901112233';   // santexnik
const FAR_MASTER = '+998908889900';    // santexnik
const ORDER_POINT = { lat: 41.3111, lng: 69.2797 };
// ~0.5 km va ~2 km uzoqlikdagi nuqtalar
const NEAR_POINT = { lat: 41.3156, lng: 69.2797 };
const FAR_POINT = { lat: 41.3291, lng: 69.2797 };

describe('tezkor chaqiruv', () => {
    let app;
    let near;
    let far;

    const goOnline = async (master, point) => {
        const res = await app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: true, ...point } });
        assert.equal(res.status, 200, res.data?.message);
    };
    const pendingOffer = (master) => waitFor(async () => (await app.api('/dispatch/me', { token: master.token })).data.data.pending_offer);
    const call = (client, extra = {}) => app.api('/dispatch/orders', {
        method: 'POST', token: client.token, body: { specialization_id: 1, ...ORDER_POINT, address: 'Amir Temur 15', ...extra },
    });

    before(async () => {
        app = await startApp();
        near = await app.tokenFor(NEAR_MASTER);
        far = await app.tokenFor(FAR_MASTER);
        // Ish rejimiga chiqish uchun ikkala usta ham tasdiqlangan bo'lishi kerak
        await app.db('UPDATE master_profiles SET is_verified = TRUE WHERE user_id = ANY($1::uuid[])', [[near.id, far.id]]);
    });
    after(() => app.close());

    beforeEach(async () => {
        // Boshqa testlardan qolgan holatni tozalash
        await app.db(`UPDATE dispatch_offers SET status = 'cancelled' WHERE status = 'pending'`);
        await app.db(`UPDATE orders SET status = 'cancelled' WHERE mode = 'instant' AND status IN ('searching', 'accepted', 'arrived', 'in_progress')`);
        await app.db('UPDATE master_profiles SET is_online = FALSE, missed_offers_streak = 0');
    });

    it('taklif eng yaqin ustaga boradi va to\'liq bosqichlar o\'tadi', async () => {
        const client = await app.tokenFor(randomPhone(), { name: 'Chaqiruvchi' });
        await goOnline(near, NEAR_POINT);
        await goOnline(far, FAR_POINT);

        const order = await call(client, { description: 'Kran oqyapti' });
        assert.equal(order.status, 201, order.data?.message);
        const orderId = order.data.data.id;
        assert.equal((await call(client)).status, 409, 'bir vaqtda bitta faol chaqiruv');

        const offer = await pendingOffer(near);
        assert.ok(offer, 'yaqin ustaga taklif keldi');
        assert.equal(offer.order_id, orderId);
        assert.equal(offer.client_name, 'Chaqiruvchi');

        const accepted = await app.api(`/dispatch/offers/${offer.offer_id}/accept`, { method: 'POST', token: near.token });
        assert.equal(accepted.status, 200, accepted.data?.message);
        assert.equal((await app.api(`/dispatch/offers/${offer.offer_id}/accept`, { method: 'POST', token: near.token })).status, 409);

        const detail = await app.api(`/orders/${orderId}`, { token: client.token });
        assert.equal(detail.data.data.status, 'accepted');
        assert.ok(detail.data.data.master_phone, 'qabuldan keyin telefon ko\'rinadi');

        assert.equal((await app.api(`/orders/${orderId}/status`, { method: 'PUT', token: client.token, body: { status: 'arrived' } })).status, 400, 'bosqichni faqat usta o\'tkazadi');
        for (const status of ['arrived', 'in_progress']) {
            assert.equal((await app.api(`/orders/${orderId}/status`, { method: 'PUT', token: near.token, body: { status } })).status, 200);
        }
        const noPrice = await app.api(`/orders/${orderId}/status`, { method: 'PUT', token: near.token, body: { status: 'completed' } });
        assert.equal(noPrice.status, 400, 'yakuniy narxsiz yakunlanmaydi');
        const done = await app.api(`/orders/${orderId}/status`, { method: 'PUT', token: near.token, body: { status: 'completed', final_price: 150000 } });
        assert.equal(done.status, 200);

        const rate = await app.api(`/dispatch/orders/${orderId}/rate-client`, { method: 'POST', token: near.token, body: { rating: 5 } });
        assert.equal(rate.status, 200);
    });

    it('sevimli usta radius ichida bo\'lsa taklif birinchi unga boradi', async () => {
        const client = await app.tokenFor(randomPhone(), { name: 'Sevimli Mijoz' });
        await app.api(`/favorites/${far.id}`, { method: 'POST', token: client.token });
        await goOnline(near, NEAR_POINT);
        await goOnline(far, FAR_POINT);

        const order = await call(client);
        const offer = await pendingOffer(far);
        assert.ok(offer, 'uzoqroqdagi sevimli ustaga taklif keldi');
        assert.equal(offer.order_id, order.data.data.id);
        assert.equal((await app.api('/dispatch/me', { token: near.token })).data.data.pending_offer, null);

        // Sevimli usta rad etsa, keyingi eng yaqin ustaga o'tadi
        await app.api(`/dispatch/offers/${offer.offer_id}/decline`, { method: 'POST', token: far.token });
        const next = await pendingOffer(near);
        assert.equal(next?.order_id, order.data.data.id);
    });

    it('mijoz bekor qilsa taklif yopiladi; usta voz kechsa qidiruv davom etadi', async () => {
        const client = await app.tokenFor(randomPhone(), { name: 'Bekor Mijoz' });
        await goOnline(near, NEAR_POINT);
        await goOnline(far, FAR_POINT);

        const first = await call(client);
        const offer = await pendingOffer(near);
        const cancel = await app.api(`/dispatch/orders/${first.data.data.id}/cancel`, { method: 'POST', token: client.token, body: { reason: 'Rejalar o\'zgardi' } });
        assert.equal(cancel.status, 200);
        assert.equal((await app.api(`/dispatch/offers/${offer.offer_id}/accept`, { method: 'POST', token: near.token })).status, 409);

        const second = await call(client);
        const offer2 = await pendingOffer(near);
        await app.api(`/dispatch/offers/${offer2.offer_id}/accept`, { method: 'POST', token: near.token });
        const giveUp = await app.api(`/dispatch/orders/${second.data.data.id}/cancel`, { method: 'POST', token: near.token, body: { reason: 'Boshqa sabab' } });
        assert.equal(giveUp.status, 200);
        const [order] = await app.db('SELECT status, master_id FROM orders WHERE id = $1', [second.data.data.id]);
        assert.equal(order.status, 'searching');
        assert.equal(order.master_id, null);
        const reoffer = await pendingOffer(far);
        assert.equal(reoffer?.order_id, second.data.data.id, 'voz kechgan ustaga qayta taklif qilinmaydi');
    });
});
