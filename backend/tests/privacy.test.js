// Aloqa ma'lumotlari (raqam buyurtma qabul qilinmaguncha ko'rinmaydi) va mijozning to'lovni tasdiqlashi
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone, waitFor, connectSocket } = require('./helpers');
const { containsContact, maskContacts } = require('../src/utils/contacts');

const POINT = { lat: 41.2101, lng: 69.2101 };
const RU = { 'Accept-Language': 'ru' };

describe('aloqa ma\'lumotlarini aniqlash', () => {
    it('telefon va Telegram topiladi, summa va yillar telefon emas', () => {
        for (const text of ['Tel: +998 (90) 123-45-67', '90 123 45 67 ga yozing', '901234567', '8 90 123 45 67', '@santexnik_ali', 't.me/ali_usta']) {
            assert.equal(containsContact(text), true, text);
        }
        for (const text of ['2015-2023 yillar', 'narxi 1 200 000 so\'m', '150 000 000 so\'mlik', '12-uy 45-xonadon', 'soat 14:30', '12 yil tajriba']) {
            assert.equal(containsContact(text), false, text);
        }
        assert.equal(maskContacts('Qo\'ng\'iroq: 90 123 45 67, narx 100 000'), 'Qo\'ng\'iroq: •••, narx 100 000');
    });
});

// Bitta fayl - bitta ilova (bazaga ulanish havzasi umumiy: ilova yopilganda u ham yopiladi)
let app;
before(async () => {
    app = await startApp();
});
after(() => app.close());

describe('raqamlar buyurtma qabul qilinmaguncha ko\'rinmaydi', () => {
    let client;
    let master;
    let masterPhone;
    let slug;

    before(async () => {
        client = await app.tokenFor(randomPhone(), { name: 'Maxfiy Mijoz' });
        masterPhone = randomPhone();
        master = await app.tokenFor(masterPhone, { name: 'Maxfiy Usta', role: 'master' });
        slug = `maxfiy-${crypto.randomInt(100000, 999999)}`;
        const [profile] = await app.db(
            `INSERT INTO master_profiles (user_id, district, bio, public_slug)
             VALUES ($1, 'Yashnobod', 'Tajriba 10 yil. Tel: 90 123 45 67, telegram @maxfiy_usta', $2) RETURNING id`,
            [master.id, slug]
        );
        await app.db('INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, 1)', [profile.id]);
        await app.db(
            'INSERT INTO portfolio_items (master_id, image_url, description) VALUES ($1, $2, $3)',
            [profile.id, 'https://example.com/a.jpg', 'Vanna xonasi, buyurtma uchun 99 888 77 66']
        );
    });

    it('usta profili, ommaviy havola, katalog va sevimlilar: raqam yo\'q, matndagi raqamlar yashirilgan', async () => {
        const profile = await app.api(`/masters/${master.id}`);
        assert.equal(profile.status, 200);
        assert.equal('phone' in profile.data.data, false);
        assert.equal(profile.data.data.bio, 'Tajriba 10 yil. Tel: •••, telegram •••');
        assert.equal(profile.data.data.portfolio[0].description, 'Vanna xonasi, buyurtma uchun •••');
        assert.equal(JSON.stringify(profile.data).includes(masterPhone.slice(4)), false);

        const bySlug = await app.api(`/masters/u/${slug}`);
        assert.equal('phone' in bySlug.data.data, false);
        assert.equal(bySlug.data.data.bio.includes('123 45 67'), false);

        const list = await app.api('/masters?district=Yashnobod&limit=50');
        const card = list.data.data.masters.find((m) => m.id === master.id);
        assert.ok(card);
        assert.equal(card.bio.includes('123 45 67'), false);

        await app.api(`/favorites/${master.id}`, { method: 'POST', token: client.token });
        const favorites = await app.api('/favorites', { token: client.token });
        assert.equal(favorites.data.data.find((m) => m.id === master.id).bio.includes('123 45 67'), false);
    });

    it('usta profiliga va portfolioga raqam yozib bo\'lmaydi (ruscha xabar bilan)', async () => {
        const bad = await app.api('/masters/profile', { method: 'PUT', token: master.token, body: { bio: 'Qo\'ng\'iroq qiling: +998 90 123 45 67' } });
        assert.equal(bad.status, 400);
        assert.match(bad.data.message, /Telefon raqam yoki Telegram/);
        const ru = await app.api('/masters/profile', { method: 'PUT', token: master.token, headers: RU, body: { bio: 'Пишите @maxfiy_usta' } });
        assert.equal(ru.status, 400);
        assert.match(ru.data.message, /Не указывайте/);

        const ok = await app.api('/masters/profile', { method: 'PUT', token: master.token, body: { bio: '2015-2023 yillar qurilishda ishlaganman' } });
        assert.equal(ok.status, 200, ok.data.message);

        const portfolio = await app.api('/masters/portfolio', {
            method: 'POST', token: master.token, body: { image_url: 'https://example.com/b.jpg', description: 'Murojaat: 901234567' },
        });
        assert.equal(portfolio.status, 400);
    });

    it('buyurtma matniga raqam yozib bo\'lmaydi (oddiy va tezkor)', async () => {
        const order = await app.api('/orders', {
            method: 'POST', token: client.token,
            body: { title: 'Kran oqyapti', address: 'Yashnobod 5', description: 'Kelishdan oldin 90 123 45 67 ga qo\'ng\'iroq qiling', master_id: master.id },
        });
        assert.equal(order.status, 400);
        assert.match(order.data.message, /Telefon raqam yoki Telegram/);

        const call = await app.api('/dispatch/orders', {
            method: 'POST', token: client.token,
            body: { specialization_id: 1, ...POINT, address: 'Yashnobod 5, tel 901234567' },
        });
        assert.equal(call.status, 400);
        assert.match(call.data.message, /Telefon raqam yoki Telegram/);
    });

    it('chat: qabul qilinmagan buyurtmada raqam yashiriladi, qabul qilingach ko\'rinadi', async () => {
        const created = await app.api('/orders', {
            method: 'POST', token: client.token,
            body: { title: 'Rozetka almashtirish', address: 'Yashnobod 7', master_id: master.id },
        });
        assert.equal(created.status, 201, created.data.message);
        const orderId = created.data.data.id;

        // Qabul qilinmagan: buyurtmada ham raqamlar yo'q
        const pending = await app.api(`/orders/${orderId}`, { token: master.token });
        assert.equal(pending.data.data.client_phone, undefined);

        const clientSocket = await connectSocket(app.url, { token: client.token });
        const masterSocket = await connectSocket(app.url, { token: master.token });
        try {
            clientSocket.emit('join_order_chat', { order_id: orderId });
            masterSocket.emit('join_order_chat', { order_id: orderId });
            await clientSocket.waitEvent('chat_history');
            await masterSocket.waitEvent('chat_history');

            clientSocket.emit('send_message', { order_id: orderId, text: 'Raqamim 90 765 43 21, qo\'ng\'iroq qiling' });
            const masked = await masterSocket.waitEvent('new_message', (m) => m.order_id === orderId);
            assert.equal(masked.text, 'Raqamim •••, qo\'ng\'iroq qiling');
            const notice = await clientSocket.waitEvent('chat_error');
            assert.match(notice.message, /Raqam yashirildi/);

            const accepted = await app.api(`/orders/${orderId}/status`, { method: 'PUT', token: master.token, body: { status: 'accepted' } });
            assert.equal(accepted.status, 200, accepted.data.message);
            clientSocket.emit('send_message', { order_id: orderId, text: 'Endi raqam: 90 765 43 21' });
            const plain = await masterSocket.waitEvent('new_message', (m) => m.text.startsWith('Endi'));
            assert.equal(plain.text, 'Endi raqam: 90 765 43 21');

            const after = await app.api(`/orders/${orderId}`, { token: master.token });
            assert.ok(after.data.data.client_phone, 'qabul qilingach mijoz raqami ko\'rinadi');
        } finally {
            clientSocket.close();
            masterSocket.close();
        }
    });
});

describe('mijoz to\'lovni tasdiqlaydi', () => {
    let admin;
    let client;
    let master;
    const clientChat = crypto.randomInt(800000000, 899999999);

    // Ish boshlangan tezkor buyurtma (bazada) va usta uni API orqali yakunlaydi
    const completeInstant = async (laborPrice, materialsPrice = 0) => {
        const [order] = await app.db(
            `INSERT INTO orders (client_id, master_id, title, address, status, mode, specialization_id, lat, lng, call_fee,
                                 accepted_at, arrived_at, started_at)
             VALUES ($1, $2, 'Unitaz o''rnatish', 'Sinov ko''chasi 3', 'in_progress', 'instant', 1, $3, $4, 50000,
                     NOW(), NOW(), NOW())
             RETURNING id`,
            [client.id, master.id, POINT.lat, POINT.lng]
        );
        const res = await app.api(`/orders/${order.id}/status`, {
            method: 'PUT', token: master.token, body: { status: 'completed', labor_price: laborPrice, materials_price: materialsPrice },
        });
        assert.equal(res.status, 200, res.data?.message);
        return order.id;
    };
    const confirm = (orderId, body = {}, token = client.token) => app.api(`/orders/${orderId}/payment`, { method: 'POST', token, body });
    const due = async () => (await app.api('/masters/me/commission', { token: master.token })).data.data.due;

    before(async () => {
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
        const clientPhone = randomPhone();
        client = await app.tokenFor(clientPhone, { name: 'Tolov Mijoz' });
        master = await app.tokenFor(randomPhone(), { name: 'Tolov Usta', role: 'master' });
        await app.db('INSERT INTO master_profiles (user_id, district) VALUES ($1, \'Sergeli\')', [master.id]);
        // Mijozning Telegram'i ulangan (bot orqali ulash boshqa testda tekshirilgan)
        await app.db(
            'INSERT INTO telegram_links (telegram_user_id, chat_id, user_id, phone) VALUES ($1, $1, $2, $3)',
            [clientChat, client.id, clientPhone]
        );
    });

    it('usta to\'g\'ri yozgan: mijoz bir tugma bilan tasdiqlaydi, qayta tasdiqlab bo\'lmaydi', async () => {
        const orderId = await completeInstant(200000, 50000);
        const view = await app.api(`/orders/${orderId}`, { token: client.token });
        assert.equal(view.data.data.can_confirm_payment, true);

        assert.equal((await confirm(orderId, {}, master.token)).status, 403);
        const res = await confirm(orderId);
        assert.equal(res.status, 200, res.data.message);
        assert.equal(res.data.message, 'Rahmat! To\'lov tasdiqlandi');
        assert.equal(res.data.data.client_paid_amount, '250000.00');
        assert.equal(res.data.data.payment_review, null);
        assert.equal(res.data.data.can_confirm_payment, false);
        assert.equal((await confirm(orderId)).status, 409);

        const masterView = await app.api(`/orders/${orderId}`, { token: master.token });
        assert.ok(masterView.data.data.payment_confirmed_at, 'ustaga "tasdiqlandi" belgisi');
        assert.equal('client_paid_amount' in masterView.data.data, false);
    });

    it('kichik farq (yaxlitlash) tekshiruvga tushmaydi', async () => {
        const orderId = await completeInstant(198000);
        const res = await confirm(orderId, { amount: 200000 });
        assert.equal(res.status, 200);
        assert.equal(res.data.data.payment_review, null);
    });

    it('mijoz ko\'p to\'lagan: admin ko\'radi va farqdan komissiya yozadi', async () => {
        await app.resetCommission(master.id);
        const orderId = await completeInstant(100000, 20000);
        assert.equal(await due(), 10000);

        const res = await confirm(orderId, { amount: 300000 }, client.token);
        assert.equal(res.status, 200);
        assert.equal(res.data.message, 'Rahmat! Ma\'lumot administratorga yuborildi');
        assert.equal(res.data.data.payment_review, 'pending');

        // Usta mijoz aytgan summani ham, "tasdiqlandi" belgisini ham ko'rmaydi
        const masterView = await app.api(`/orders/${orderId}`, { token: master.token });
        assert.equal(masterView.data.data.payment_confirmed_at, null);
        assert.equal('payment_review' in masterView.data.data, false);
        const masterList = await app.api('/orders', { token: master.token });
        assert.equal('client_paid_amount' in masterList.data.data.find((o) => o.id === orderId), false);

        const summary = await app.api('/admin/commission', { token: admin.token });
        assert.ok(summary.data.summary.payment_reviews >= 1);
        const list = await app.api('/admin/commission/payment-reviews', { token: admin.token });
        const review = list.data.data.find((r) => r.id === orderId);
        assert.ok(review);
        assert.equal(review.difference, 180000);
        assert.equal(review.commission_percent, 10);
        assert.equal(review.suggested_charge, 18000);
        assert.equal(review.client_name, 'Tolov Mijoz');
        assert.equal((await app.api('/admin/commission/payment-reviews', { token: master.token })).status, 403);

        const charge = await app.api(`/admin/commission/payment-reviews/${orderId}`, {
            method: 'POST', token: admin.token, body: { action: 'charge' },
        });
        assert.equal(charge.status, 200, charge.data.message);
        assert.equal(await due(), 28000);
        const ledger = await app.api('/masters/me/commission', { token: master.token });
        const [entry] = ledger.data.data.entries;
        assert.equal(entry.kind, 'adjustment');
        assert.equal(entry.amount, 18000);
        assert.equal(entry.order_id, orderId);
        assert.match(entry.note, /300 000 so'm to'laganini bildirdi/);

        const again = await app.api(`/admin/commission/payment-reviews/${orderId}`, {
            method: 'POST', token: admin.token, body: { action: 'dismiss' },
        });
        assert.equal(again.status, 409);
        const charged = await app.api('/admin/commission/payment-reviews?status=charged', { token: admin.token });
        assert.ok(charged.data.data.some((r) => r.id === orderId));
        const audit = await app.db('SELECT action FROM admin_audit_log WHERE target_order_id = $1', [orderId]);
        assert.deepEqual(audit.map((row) => row.action), ['commission.review_charge']);
    });

    it('admin farqni yopishi mumkin (komissiya yozilmaydi)', async () => {
        const orderId = await completeInstant(100000);
        await confirm(orderId, { amount: 150000 });
        const before = await due();
        const dismiss = await app.api(`/admin/commission/payment-reviews/${orderId}`, {
            method: 'POST', token: admin.token, body: { action: 'dismiss', note: 'Mijoz choy puli bergan' },
        });
        assert.equal(dismiss.status, 200);
        assert.equal(await due(), before);
    });

    it('noto\'g\'ri holatlar: oddiy buyurtma, noto\'g\'ri summa', async () => {
        const [catalog] = await app.db(
            `INSERT INTO orders (client_id, master_id, title, address, status, completed_at)
             VALUES ($1, $2, 'Oddiy ish', 'Manzil 1', 'completed', NOW()) RETURNING id`,
            [client.id, master.id]
        );
        assert.equal((await confirm(catalog.id)).status, 400);
        const orderId = await completeInstant(100000);
        assert.equal((await confirm(orderId, { amount: -5 })).status, 400);
        assert.equal((await confirm(orderId, { amount: 'abc' })).status, 400);
    });

    it('Telegram: yakunlanganda "Ha, ... to\'ladim" tugmasi, bosilganda tasdiqlanadi', async () => {
        const tg = app.telegram;
        const orderId = await completeInstant(150000);
        const message = await waitFor(() => tg.sent.find((m) => String(m.chat.id) === String(clientChat) && m.text.includes('Ustaga shuncha to\'ladingizmi')
            && JSON.stringify(m.reply_markup).includes(orderId)));
        const [[yes], [other]] = message.reply_markup.inline_keyboard;
        assert.equal(yes.text.replace(/\s/g, ' '), '✅ Ha, 150 000 so\'m to\'ladim');
        assert.equal(yes.callback_data, `p:${orderId}:ok`);
        assert.match(other.url, new RegExp(`/orders/${orderId}#tolov$`));

        tg.push({
            callback_query: {
                id: 'cb-pay', from: { id: clientChat, is_bot: false, first_name: 'Mijoz' }, data: yes.callback_data,
                message: { message_id: message.message_id, chat: { id: clientChat, type: 'private' } },
            },
        });
        const answer = await waitFor(() => tg.answers.find((a) => a.callback_query_id === 'cb-pay'));
        assert.equal(answer.text, '✅ Rahmat! To\'lov tasdiqlandi');
        const edit = await waitFor(() => tg.edits.find((e) => e.message_id === message.message_id && e.reply_markup));
        assert.equal(edit.reply_markup.inline_keyboard.flat().some((b) => b.callback_data), false);
        const [row] = await app.db('SELECT client_paid_amount, payment_review FROM orders WHERE id = $1', [orderId]);
        assert.equal(row.client_paid_amount, '150000.00');
        assert.equal(row.payment_review, null);

        // Boshqa odam (ulanmagan Telegram) tasdiqlay olmaydi
        tg.push({
            callback_query: { id: 'cb-stranger', from: { id: clientChat + 1, is_bot: false, first_name: 'X' }, data: `p:${orderId}:ok`, message: { message_id: 1, chat: { id: clientChat + 1 } } },
        });
        const denied = await waitFor(() => tg.answers.find((a) => a.callback_query_id === 'cb-stranger'));
        assert.equal(denied.show_alert, true);
    });
});
