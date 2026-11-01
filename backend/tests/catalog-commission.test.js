// Oddiy (katalog) buyurtma komissiyasi: usta yakuniy summa bilan yakunlaydi; mijoz yakunlasa usta summani
// muddatida kiritadi (aks holda yangi buyurtma ololmaydi va ishga chiqa olmaydi); mijoz to'lovni tasdiqlaydi
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone, waitFor } = require('./helpers');

const POINT = { lat: 41.2401, lng: 69.2401 };

describe('oddiy buyurtma komissiyasi', () => {
    let app;
    let client;
    let master;
    let clientChat;
    let masterChat;

    const createOrder = async (title = 'Rozetka o\'rnatish') => {
        const res = await app.api('/orders', {
            method: 'POST', token: client.token, body: { title, address: 'Chilonzor 7', master_id: master.id, budget: 150000 },
        });
        assert.equal(res.status, 201, res.data?.message);
        return res.data.data.id;
    };
    const setStatus = (orderId, status, token = master.token, extra = {}) => app.api(`/orders/${orderId}/status`, {
        method: 'PUT', token, body: { status, ...extra },
    });
    const startWork = async (orderId) => {
        assert.equal((await setStatus(orderId, 'accepted')).status, 200);
        assert.equal((await setStatus(orderId, 'in_progress')).status, 200);
    };
    const ledger = async () => (await app.api('/masters/me/commission', { token: master.token })).data.data;

    before(async () => {
        process.env.CATALOG_COMMISSION_PERCENT = '5';
        process.env.PRICE_ENTRY_HOURS = '24';
        app = await startApp();
        const clientPhone = randomPhone();
        const masterPhone = randomPhone();
        client = await app.tokenFor(clientPhone, { name: 'Katalog Mijoz' });
        master = await app.tokenFor(masterPhone, { name: 'Katalog Usta', role: 'master' });
        const [profile] = await app.db(
            'INSERT INTO master_profiles (user_id, district, is_verified) VALUES ($1, \'Chilonzor\', TRUE) RETURNING id',
            [master.id]
        );
        await app.db('INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, 1)', [profile.id]);
        clientChat = crypto.randomInt(820000000, 829999999);
        masterChat = clientChat + 1;
        await app.db(
            `INSERT INTO telegram_links (telegram_user_id, chat_id, user_id, phone)
             VALUES ($1, $1, $2, $3), ($4, $4, $5, $6)`,
            [clientChat, client.id, clientPhone, masterChat, master.id, masterPhone]
        );
    });
    after(() => app.close());

    it('sozlama: oddiy buyurtma foizi alohida', async () => {
        const res = await app.api('/dispatch/config');
        assert.equal(res.data.data.catalog_commission_percent, 5);
        assert.equal(res.data.data.commission_percent, 10);
        assert.equal(res.data.data.price_entry_hours, 24);
    });

    it('usta yakuniy summa bilan yakunlaydi: komissiya ish haqidan (5%), mijozdan tasdiq so\'raladi', async () => {
        const orderId = await createOrder();
        await startWork(orderId);
        const res = await setStatus(orderId, 'completed', master.token, { labor_price: 200000, materials_price: 80000 });
        assert.equal(res.status, 200, res.data?.message);
        assert.equal(Number(res.data.data.final_price), 280000);

        const book = await ledger();
        assert.equal(book.due, 10000);
        const [entry] = book.entries;
        assert.equal(entry.kind, 'commission');
        assert.equal(entry.percent, 5);
        assert.equal(entry.base_amount, 200000);
        assert.equal(entry.order_id, orderId);

        // Mijozga Telegram'da "Ha, ... to'ladim" tugmasi, saytda tasdiqlash
        const message = await waitFor(() => app.telegram.sent.find((m) => String(m.chat.id) === String(clientChat)
            && JSON.stringify(m.reply_markup || {}).includes(`p:${orderId}:ok`)));
        assert.ok(message);
        const view = await app.api(`/orders/${orderId}`, { token: client.token });
        assert.equal(view.data.data.can_confirm_payment, true);
        const confirmed = await app.api(`/orders/${orderId}/payment`, { method: 'POST', token: client.token, body: {} });
        assert.equal(confirmed.status, 200);
    });

    it('mijoz yakunlasa: komissiya yo\'q, usta summani muddatida kiritadi', async () => {
        const orderId = await createOrder('Kran almashtirish');
        await startWork(orderId);
        const before = (await ledger()).due;
        const done = await setStatus(orderId, 'completed', client.token);
        assert.equal(done.status, 200, done.data?.message);
        assert.equal(done.data.data.final_price, null);
        assert.ok(done.data.data.price_due_at, 'muddat belgilandi');
        const hours = (new Date(done.data.data.price_due_at) - Date.now()) / 3600000;
        assert.ok(hours > 23.9 && hours <= 24, `muddat ~24 soat: ${hours}`);
        assert.equal((await ledger()).due, before);

        // Ustaga Telegram: summani kiritish
        const notice = await waitFor(() => app.telegram.sent.find((m) => String(m.chat.id) === String(masterChat)
            && m.text.includes('Mijoz ishni yakunlandi deb belgiladi')));
        assert.match(JSON.stringify(notice.reply_markup), new RegExp(`/orders/${orderId}#summa`));

        // Faqat usta, faqat bir marta
        assert.equal((await app.api(`/orders/${orderId}/final-price`, { method: 'PUT', token: client.token, body: { labor_price: 1 } })).status, 403);
        const noLabor = await app.api(`/orders/${orderId}/final-price`, { method: 'PUT', token: master.token, body: {} });
        assert.equal(noLabor.status, 400);
        const saved = await app.api(`/orders/${orderId}/final-price`, { method: 'PUT', token: master.token, body: { labor_price: 120000 } });
        assert.equal(saved.status, 200, saved.data?.message);
        assert.equal(saved.data.message, 'Yakuniy summa saqlandi');
        assert.equal(saved.data.data.price_due_at, null);
        assert.equal((await ledger()).due, before + 6000);
        const again = await app.api(`/orders/${orderId}/final-price`, { method: 'PUT', token: master.token, body: { labor_price: 1000 } });
        assert.equal(again.status, 409);

        // Mijozdan to'lovni tasdiqlash so'raladi
        const ask = await waitFor(() => app.telegram.sent.find((m) => String(m.chat.id) === String(clientChat)
            && m.text.includes('Usta yakuniy summani kiritdi') && JSON.stringify(m.reply_markup).includes(`p:${orderId}:ok`)));
        assert.ok(ask);
    });

    it('summa muddatida kiritilmasa: yangi buyurtma ham, ishga chiqish ham yo\'q', async () => {
        const orderId = await createOrder('Lyustra osish');
        await startWork(orderId);
        assert.equal((await setStatus(orderId, 'completed', client.token)).status, 200);
        await app.db('UPDATE orders SET price_due_at = NOW() - INTERVAL \'1 minute\' WHERE id = $1', [orderId]);

        const next = await createOrder('Yana rozetka');
        const accept = await setStatus(next, 'accepted');
        assert.equal(accept.status, 400);
        assert.equal(accept.data.message, 'Avval yakunlangan buyurtmalarning summasini kiriting (Buyurtmalarim)');
        const ru = await app.api(`/orders/${next}/status`, { method: 'PUT', token: master.token, body: { status: 'accepted' }, headers: { 'Accept-Language': 'ru' } });
        assert.equal(ru.data.message, 'Сначала укажите итоговую сумму по завершённым заказам (Мои заказы)');

        const me = await app.api('/dispatch/me', { token: master.token });
        assert.equal(me.data.data.requirements.prices_ok, false);
        const online = await app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: true, ...POINT } });
        assert.equal(online.status, 403);
        assert.match(online.data.message, /yakunlangan buyurtmalarning summasi kiritilmagan/);

        // Summani kiritgach - yana mumkin
        assert.equal((await app.api(`/orders/${orderId}/final-price`, { method: 'PUT', token: master.token, body: { labor_price: 50000 } })).status, 200);
        assert.equal((await setStatus(next, 'accepted')).status, 200);
        assert.equal((await app.api('/dispatch/me', { token: master.token })).data.data.requirements.prices_ok, true);
    });

    it('qarz limitdan oshgan usta yangi oddiy buyurtmani qabul qila olmaydi', async () => {
        await app.db('UPDATE master_profiles SET commission_due = 999999 WHERE user_id = $1', [master.id]);
        const orderId = await createOrder('Quvur almashtirish');
        const accept = await setStatus(orderId, 'accepted');
        assert.equal(accept.status, 400);
        assert.match(accept.data.message, /^Komissiya qarzingiz 999 999 so'm — limitdan \(200 000 so'm\) oshgan/);
        await app.resetCommission(master.id);
    });

    it('eski (muddatsiz) summasiz buyurtmalar ustani to\'xtatmaydi', async () => {
        await app.db(
            `INSERT INTO orders (client_id, master_id, title, address, status, completed_at)
             VALUES ($1, $2, 'Eski ish', 'Manzil', 'completed', NOW() - INTERVAL '30 days')`,
            [client.id, master.id]
        );
        assert.equal((await app.api('/dispatch/me', { token: master.token })).data.data.requirements.prices_ok, true);
    });
});
