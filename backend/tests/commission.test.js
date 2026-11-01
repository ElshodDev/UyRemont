// Komissiya hisobi: yozilishi, qarz limiti (ish rejimi va takliflar), admin to'lovi va tuzatishlar
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, randomPhone, waitFor } = require('./helpers');

const LIMIT = 50000;
const PAYMENT_INFO = 'Uzcard 8600 0000 0000 0000 (Usta24). Izohga telefon raqamingizni yozing';
const POINT = { lat: 41.2001, lng: 69.1001 };

describe('komissiya hisobi', () => {
    let app;
    let admin;
    let client;
    let master;

    // Ish boshlangan tezkor buyurtma (to'g'ridan-to'g'ri bazada) va uni usta API orqali yakunlaydi
    const completeInstant = async (finalPrice, body) => {
        const [order] = await app.db(
            `INSERT INTO orders (client_id, master_id, title, address, status, mode, specialization_id, lat, lng, call_fee,
                                 accepted_at, arrived_at, started_at)
             VALUES ($1, $2, 'Kran almashtirish', 'Sinov ko''chasi 1', 'in_progress', 'instant', 1, $3, $4, 50000,
                     NOW(), NOW(), NOW())
             RETURNING id`,
            [client.id, master.id, POINT.lat, POINT.lng]
        );
        const res = await app.api(`/orders/${order.id}/status`, {
            method: 'PUT', token: master.token, body: { status: 'completed', ...(body || { final_price: finalPrice }) },
        });
        assert.equal(res.status, 200, res.data?.message);
        return order.id;
    };
    const ledger = () => app.api('/masters/me/commission', { token: master.token });
    const goOnline = () => app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: true, ...POINT } });

    before(async () => {
        process.env.COMMISSION_DEBT_LIMIT = String(LIMIT);
        process.env.COMMISSION_PAYMENT_INFO = PAYMENT_INFO;
        app = await startApp();
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
        client = await app.tokenFor(randomPhone(), { name: 'Komissiya Mijoz' });
        master = await app.tokenFor(randomPhone(), { name: 'Komissiya Usta', role: 'master' });
        const [profile] = await app.db(
            `INSERT INTO master_profiles (user_id, is_verified, district, city) VALUES ($1, TRUE, 'Sergeli', 'Toshkent')
             RETURNING id`,
            [master.id]
        );
        await app.db('INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, 1)', [profile.id]);
        // Boshqa testlardan qolgan ish rejimidagi ustalar va qidiruvdagi chaqiruvlar xalaqit bermasin
        await app.db('UPDATE master_profiles SET is_online = FALSE');
        await app.db(`UPDATE orders SET status = 'cancelled' WHERE mode = 'instant' AND status IN ('searching', 'accepted', 'arrived', 'in_progress')`);
    });
    after(() => app.close());

    it('sozlamalar ommaviy: foiz va qarz limiti', async () => {
        const res = await app.api('/dispatch/config');
        assert.equal(res.data.data.commission_debt_limit, LIMIT);
        assert.equal(res.data.data.commission_percent, 10);
    });

    it('tezkor ish yakunlanganda komissiya yoziladi (yozilgan foiz va summa bilan)', async () => {
        const orderId = await completeInstant(300000);
        const res = await ledger();
        assert.equal(res.status, 200);
        assert.equal(res.data.data.due, 30000);
        assert.equal(res.data.data.limit, LIMIT);
        assert.equal(res.data.data.payment_info, PAYMENT_INFO);
        const [entry] = res.data.data.entries;
        assert.equal(entry.kind, 'commission');
        assert.equal(entry.amount, 30000);
        assert.equal(entry.percent, 10);
        assert.equal(entry.base_amount, 300000);
        assert.equal(entry.order_id, orderId);
        assert.equal(entry.order_title, 'Kran almashtirish');

        const state = await app.api('/dispatch/me', { token: master.token });
        assert.equal(state.data.data.today.commission, 30000);
        assert.deepEqual(state.data.data.commission, { due: 30000, limit: LIMIT, blocked: false });
    });

    it('bitta buyurtma uchun komissiya ikki marta yozilmaydi', async () => {
        const { accrueCommission } = require('../src/services/commission.service');
        const { withTransaction } = require('../src/config/database');
        const [order] = await app.db(`SELECT * FROM orders WHERE master_id = $1 AND status = 'completed' LIMIT 1`, [master.id]);
        const again = await withTransaction((tx) => accrueCommission(tx, order));
        assert.equal(again, null);
        assert.equal((await ledger()).data.data.due, 30000);
    });

    it('oddiy (katalog) buyurtmadan komissiya olinmaydi', async () => {
        const order = await app.api('/orders', {
            method: 'POST', token: client.token, body: { title: 'Rozetka o\'rnatish', address: 'Uy 5', master_id: master.id, budget: 100000 },
        });
        assert.equal(order.status, 201, order.data?.message);
        for (const status of ['accepted', 'in_progress', 'completed']) {
            const res = await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: master.token, body: { status } });
            assert.equal(res.status, 200, `${status}: ${res.data?.message}`);
        }
        const res = await ledger();
        assert.equal(res.data.data.due, 30000);
        assert.equal(res.data.data.entries.filter((e) => e.kind === 'commission').length, 1);
    });

    it('qarz limitdan oshsa ish rejimi o\'chadi va qayta yoqib bo\'lmaydi', async () => {
        assert.equal((await goOnline()).status, 200, 'limitgacha ishga chiqa oladi');
        await completeInstant(300000);

        const [profile] = await app.db('SELECT is_online, commission_due FROM master_profiles WHERE user_id = $1', [master.id]);
        assert.equal(profile.is_online, false, 'ish rejimi avtomatik o\'chdi');
        assert.equal(Number(profile.commission_due), 60000);

        const online = await goOnline();
        assert.equal(online.status, 403);
        assert.match(online.data.message, /komissiya qarzingiz 60 000 so'm — limitdan \(50 000 so'm\) oshgan/);

        const state = await app.api('/dispatch/me', { token: master.token });
        assert.equal(state.data.data.requirements.commission_ok, false);
        assert.equal(state.data.data.requirements.can_go_online, false);
        assert.equal(state.data.data.commission.blocked, true);
    });

    it('limitdan oshgan ustaga taklif yuborilmaydi', async () => {
        await app.db(
            `UPDATE master_profiles SET is_online = TRUE, is_available = TRUE, lat = $2, lng = $3, location_updated_at = NOW()
             WHERE user_id = $1`,
            [master.id, POINT.lat, POINT.lng]
        );
        const caller = await app.tokenFor(randomPhone(), { name: 'Chaqiruvchi' });
        const order = await app.api('/dispatch/orders', {
            method: 'POST', token: caller.token, body: { specialization_id: 1, ...POINT, address: 'Sergeli 1' },
        });
        assert.equal(order.status, 201, order.data?.message);
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const offers = await app.db('SELECT id FROM dispatch_offers WHERE order_id = $1 AND master_id = $2', [order.data.data.id, master.id]);
        assert.equal(offers.length, 0);
        await app.api(`/dispatch/orders/${order.data.data.id}/cancel`, { method: 'POST', token: caller.token, body: { reason: 'Xato buyurtma berdim' } });
        await app.db('UPDATE master_profiles SET is_online = FALSE WHERE user_id = $1', [master.id]);
    });

    it('admin panelida qarzdorlar, limitdan oshganlar va navbat belgisi', async () => {
        const list = await app.api('/admin/commission?filter=over_limit', { token: admin.token });
        assert.equal(list.status, 200);
        const row = list.data.data.find((m) => m.id === master.id);
        assert.ok(row, 'limitdan oshganlar ro\'yxatida');
        assert.equal(row.commission_due, 60000);
        assert.equal(row.over_limit, true);
        assert.ok(list.data.summary.over_limit >= 1);
        assert.ok(list.data.summary.total_due >= 60000);

        const [user] = await app.db('SELECT phone FROM users WHERE id = $1', [master.id]);
        const search = await app.api(`/admin/commission?filter=all&q=${encodeURIComponent(user.phone.slice(-7))}`, { token: admin.token });
        assert.deepEqual(search.data.data.map((m) => m.id), [master.id]);

        const queues = await app.api('/admin/queues', { token: admin.token });
        assert.ok(queues.data.data.commission >= 1);
    });

    it('noto\'g\'ri to\'lov rad etiladi, usta va mijoz admin amalini bajara olmaydi', async () => {
        const pay = (body, token = admin.token, id = master.id) => app.api(`/admin/commission/${id}/payments`, { method: 'POST', token, body });
        assert.equal((await pay({ amount: 0, method: 'card' })).status, 400);
        assert.equal((await pay({ amount: -100, method: 'card' })).status, 400);
        assert.equal((await pay({ amount: 1000 })).status, 400, 'usul tanlanmagan');
        assert.equal((await pay({ amount: 1000, method: 'bitcoin' })).status, 400);
        assert.equal((await pay({ amount: 1000, method: 'card' }, master.token)).status, 403);
        assert.equal((await pay({ amount: 1000, method: 'card' }, client.token)).status, 403);
        assert.equal((await pay({ amount: 1000, method: 'card' }, admin.token, client.id)).status, 404, 'mijozga to\'lov yozilmaydi');
        assert.equal((await pay({ amount: 1000, method: 'card' }, admin.token, 'bu-uuid-emas')).status, 400);
        assert.equal((await ledger()).data.data.due, 60000, 'qarz o\'zgarmadi');
    });

    it('admin to\'lovni qabul qiladi: qarz kamayadi, jurnalga yoziladi, usta yana ishga chiqadi', async () => {
        const res = await app.api(`/admin/commission/${master.id}/payments`, {
            method: 'POST', token: admin.token, body: { amount: 60000, method: 'card', note: 'Uzcard, 01.11' },
        });
        assert.equal(res.status, 201, res.data?.message);
        assert.equal(res.data.data.due, 0);
        assert.match(res.data.message, /Qarzingiz yo'q/);

        const mine = await ledger();
        assert.equal(mine.data.data.due, 0);
        assert.equal(mine.data.data.totals.paid, 60000);
        assert.equal(mine.data.data.totals.commission, 60000);
        assert.equal(mine.data.data.entries[0].kind, 'payment');
        assert.equal(mine.data.data.entries[0].amount, -60000);
        assert.equal(mine.data.data.entries[0].method, 'card');

        const [audit] = await app.db(
            `SELECT details FROM admin_audit_log WHERE action = 'commission.payment' AND target_user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [master.id]
        );
        assert.equal(audit.details.amount, 60000);
        assert.equal(audit.details.due_after, 0);

        assert.equal((await goOnline()).status, 200);
        const debtors = await app.api('/admin/commission', { token: admin.token });
        assert.ok(!debtors.data.data.some((m) => m.id === master.id), 'qarzdorlar ro\'yxatidan chiqdi');
    });

    it('qarz to\'langan usta yana taklif oladi', async () => {
        const caller = await app.tokenFor(randomPhone(), { name: 'Ikkinchi Chaqiruvchi' });
        const order = await app.api('/dispatch/orders', {
            method: 'POST', token: caller.token, body: { specialization_id: 1, ...POINT, address: 'Sergeli 2' },
        });
        assert.equal(order.status, 201, order.data?.message);
        const offer = await waitFor(async () => (await app.api('/dispatch/me', { token: master.token })).data.data.pending_offer);
        assert.ok(offer, 'taklif keldi');
        assert.equal(offer.order_id, order.data.data.id);
        await app.api(`/dispatch/orders/${order.data.data.id}/cancel`, { method: 'POST', token: caller.token, body: { reason: 'Xato buyurtma berdim' } });
        await app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: false } });
    });

    it('tuzatish: sabab majburiy, qarzni kamaytirish yoki oshirish mumkin', async () => {
        const adjust = (body) => app.api(`/admin/commission/${master.id}/adjustments`, { method: 'POST', token: admin.token, body });
        assert.equal((await adjust({ amount: -5000 })).status, 400, 'sababsiz');
        assert.equal((await adjust({ amount: -5000, note: 'ok' })).status, 400, 'sabab juda qisqa');
        assert.equal((await adjust({ amount: 0, note: 'Nol summa' })).status, 400);

        const discount = await adjust({ amount: -5000, note: 'Birinchi oy chegirmasi' });
        assert.equal(discount.status, 201, discount.data?.message);
        assert.equal(discount.data.data.due, -5000);
        assert.match(discount.data.message, /Oldindan to'langan: 5 000 so'm/);

        const fine = await adjust({ amount: 5000, note: 'Xato yozuvni qaytarish' });
        assert.equal(fine.data.data.due, 0);

        const [{ total }] = await app.db('SELECT COALESCE(SUM(amount), 0) as total FROM master_ledger WHERE master_id = $1', [master.id]);
        assert.equal(Number(total), 0, 'tezkor nusxa yozuvlar yig\'indisiga teng');
    });

    it('admin ustaning to\'liq hisobini ko\'radi; statistikada yig\'ilgan komissiya', async () => {
        const res = await app.api(`/admin/commission/${master.id}`, { token: admin.token });
        assert.equal(res.status, 200);
        assert.equal(res.data.data.master.name, 'Komissiya Usta');
        assert.deepEqual(res.data.data.entries.map((e) => e.kind).sort(), ['adjustment', 'adjustment', 'commission', 'commission', 'payment']);

        const analytics = await app.api('/admin/analytics?days=7', { token: admin.token });
        assert.ok(analytics.data.data.kpi.commission >= 60000);
        assert.ok(analytics.data.data.kpi.commission_paid >= 60000);
    });

    it('material summasiga komissiya olinmaydi: yakuniy summa = ish haqi + material', async () => {
        const before = (await ledger()).data.data.due;
        const orderId = await completeInstant(null, { labor_price: 200000, materials_price: 500000 });

        const [order] = await app.db('SELECT final_price, labor_price, materials_price FROM orders WHERE id = $1', [orderId]);
        assert.equal(Number(order.final_price), 700000);
        assert.equal(Number(order.labor_price), 200000);
        assert.equal(Number(order.materials_price), 500000);

        const detail = await app.api(`/orders/${orderId}`, { token: client.token });
        assert.equal(Number(detail.data.data.materials_price), 500000, 'mijoz tafsilotni ko\'radi');

        const mine = await ledger();
        const [entry] = mine.data.data.entries;
        assert.equal(entry.amount, 20000, '10% faqat ish haqidan');
        assert.equal(entry.base_amount, 200000);
        assert.equal(entry.materials_price, 500000);
        assert.equal(mine.data.data.due, before + 20000);
    });

    it('ish haqisiz yoki manfiy material bilan yakunlanmaydi', async () => {
        const [order] = await app.db(
            `INSERT INTO orders (client_id, master_id, title, address, status, mode, specialization_id, call_fee, accepted_at, started_at)
             VALUES ($1, $2, 'Tekshiruv', 'Sinov 2', 'in_progress', 'instant', 1, 50000, NOW(), NOW()) RETURNING id`,
            [client.id, master.id]
        );
        const finish = (body) => app.api(`/orders/${order.id}/status`, { method: 'PUT', token: master.token, body: { status: 'completed', ...body } });
        const noLabor = await finish({ materials_price: 100000 });
        assert.equal(noLabor.status, 400);
        assert.match(noLabor.data.message, /Ish haqini kiriting/);
        assert.equal((await finish({ labor_price: 100000, materials_price: -1 })).status, 400);
        const [still] = await app.db('SELECT status FROM orders WHERE id = $1', [order.id]);
        assert.equal(still.status, 'in_progress');
    });
});
