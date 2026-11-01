// Telegram bot (soxta Telegram API bilan): kirish kodi, hisobni ulash, takliflar, xabarlar, webhook
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone, waitFor, TEST_BOT_TOKEN } = require('./helpers');

const MASTER_PHONE = '+998901112233';
const POINT = { lat: 41.2995, lng: 69.2401 };

describe('Telegram bot', () => {
    let app;
    let tg;
    const tgId = () => crypto.randomInt(700000000, 799999999);
    const from = (id) => ({ id, is_bot: false, first_name: 'Nodira', last_name: 'Usmonova', username: `u${id}` });
    const text = (id, value) => tg.push({ message: { message_id: 1, from: from(id), chat: { id, type: 'private' }, date: 0, text: value } });
    const contact = (id, phone, ownerId = id) => tg.push({
        message: { message_id: 1, from: from(id), chat: { id, type: 'private' }, date: 0, contact: { phone_number: phone.slice(1), first_name: 'N', user_id: ownerId } },
    });
    const press = (id, data) => tg.push({ callback_query: { id: String(Date.now()), from: from(id), data, message: { message_id: 1, chat: { id, type: 'private' } } } });
    const messagesTo = (chatId) => tg.sent.filter((m) => String(m.chat.id) === String(chatId));
    const waitMessage = (chatId, pattern, count = 1) => waitFor(() => {
        const found = messagesTo(chatId).filter((m) => pattern.test(m.text));
        return found.length >= count ? found[found.length - 1] : null;
    });
    const codeFrom = (message) => /<code>(\d{6})<\/code>/.exec(message?.text || '')?.[1];

    // Profildan Telegram'ni ulash (bot orqali raqamni tasdiqlab)
    const linkTelegram = async (token, phone, chatId) => {
        const res = await app.api('/auth/telegram/link', { method: 'POST', token });
        text(chatId, `/start ${res.data.data.request}`);
        await waitMessage(chatId, /Raqamni yuborish/);
        contact(chatId, phone);
        await waitMessage(chatId, /hisobingizga ulandi/);
    };

    before(async () => {
        app = await startApp();
        tg = app.telegram;
        await app.db(`UPDATE dispatch_offers SET status = 'cancelled' WHERE status = 'pending'`);
        await app.db(`UPDATE orders SET status = 'cancelled' WHERE mode = 'instant' AND status IN ('searching', 'accepted', 'arrived', 'in_progress')`);
        await app.db('UPDATE master_profiles SET is_online = FALSE, missed_offers_streak = 0');
        await app.db('DELETE FROM telegram_links WHERE phone = $1', [MASTER_PHONE]);
    });
    after(() => app.close());

    describe('Telegram orqali kirish', () => {
        const phone = randomPhone();
        const chatId = tgId();
        let request;

        it('sayt botga havola beradi, kalitning faqat xeshi saqlanadi', async () => {
            const config = await app.api('/auth/telegram/config');
            assert.equal(config.data.data.enabled, true);
            assert.equal(config.data.data.bot_username, 'usta24_test_bot');

            const start = await app.api('/auth/telegram/start', { method: 'POST', body: { phone } });
            assert.equal(start.data.data.status, 'link');
            assert.match(start.data.data.bot_url, /^https:\/\/t\.me\/usta24_test_bot\?start=login_/);
            request = start.data.data.request;
            const hash = crypto.createHash('sha256').update(request.replace('login_', '')).digest('hex');
            const rows = await app.db('SELECT 1 FROM telegram_auth_requests WHERE token_hash = $1', [hash]);
            assert.equal(rows.length, 1);
        });

        it('bot raqam so\'raydi; boshqa odamning kontakti rad etiladi', async () => {
            text(chatId, `/start ${request}`);
            const ask = await waitMessage(chatId, /Raqamni yuborish/);
            assert.equal(ask.reply_markup.keyboard[0][0].request_contact, true);
            assert.ok(ask.text.includes(`+998 ${phone.slice(4, 6)} *** **`), 'raqam yashirilgan');
            assert.equal((await app.api(`/auth/telegram/requests/${request}`)).data.data.status, 'waiting_contact');

            contact(chatId, phone, chatId + 1);
            assert.ok(await waitMessage(chatId, /Faqat o'zingizning raqamingizni/));
        });

        it('o\'z raqami yuborilgach kod keladi va sayt odatdagidek tasdiqlaydi', async () => {
            contact(chatId, phone);
            const codeMessage = await waitMessage(chatId, /kirish kodi/);
            const code = codeFrom(codeMessage);
            assert.match(code, /^\d{6}$/);
            const status = (await app.api(`/auth/telegram/requests/${request}`)).data.data;
            assert.equal(status.status, 'sent');
            assert.equal(status.name_hint, 'Nodira Usmonova');

            const login = await app.api('/auth/verify-otp', { method: 'POST', body: { phone, code, accept_terms: true } });
            assert.equal(login.status, 200);
            const me = await app.api('/auth/me', { token: login.data.data.token });
            assert.equal(me.data.data.telegram.username, `u${chatId}`);
        });

        it('keyingi safar kod darhol Telegram\'ga keladi', async () => {
            await app.db(`UPDATE otp_codes SET created_at = created_at - INTERVAL '2 minutes' WHERE phone = $1`, [phone]);
            const again = await app.api('/auth/telegram/start', { method: 'POST', body: { phone } });
            assert.equal(again.data.data.status, 'sent');
            assert.ok(await waitMessage(chatId, /kirish kodi/, 2));
        });

        it('boshqa raqam yuborilsa kod berilmaydi', async () => {
            const other = randomPhone();
            const other2 = tgId();
            const start = await app.api('/auth/telegram/start', { method: 'POST', body: { phone: other } });
            text(other2, `/start ${start.data.data.request}`);
            await waitMessage(other2, /Raqamni yuborish/);
            contact(other2, randomPhone());
            assert.ok(await waitMessage(other2, /mos kelmadi/));
            assert.equal((await app.api(`/auth/telegram/requests/${start.data.data.request}`)).data.data.status, 'mismatch');
            assert.equal((await app.db('SELECT 1 FROM otp_codes WHERE phone = $1', [other])).length, 0);
        });

        it('eskirgan yoki soxta havola rad etiladi', async () => {
            const chat = tgId();
            text(chat, '/start login_bu-soxta-kalit-1234567890');
            assert.ok(await waitMessage(chat, /eskirgan/));
        });
    });

    describe('usta takliflari va xabarlar', () => {
        const masterChat = tgId();
        const clientChat = tgId();
        let master;
        let client;

        before(async () => {
            master = await app.tokenFor(MASTER_PHONE);
            await app.db('UPDATE master_profiles SET is_verified = TRUE WHERE user_id = $1', [master.id]);
            const clientPhone = randomPhone();
            client = await app.tokenFor(clientPhone, { name: 'Telegram Mijoz' });
            await linkTelegram(master.token, MASTER_PHONE, masterChat);
            await linkTelegram(client.token, clientPhone, clientChat);
            await app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: true, ...POINT } });
        });

        it('taklif tugmalar bilan keladi va Telegram\'da qabul qilinadi', async () => {
            const order = await app.api('/dispatch/orders', {
                method: 'POST', token: client.token, body: { specialization_id: 1, ...POINT, address: 'Amir Temur <b>15</b>' },
            });
            const offerMessage = await waitMessage(masterChat, /Yangi buyurtma/);
            assert.ok(offerMessage.text.includes('Amir Temur &lt;b&gt;15&lt;/b&gt;'), 'HTML xavfsiz');
            const [acceptButton, declineButton] = offerMessage.reply_markup.inline_keyboard[0];
            assert.match(acceptButton.callback_data, /^o:[0-9a-f-]{36}:a$/);
            assert.match(declineButton.callback_data, /:d$/);

            press(clientChat, acceptButton.callback_data);
            assert.ok(await waitFor(() => tg.answers.find((a) => /Usta hisobi topilmadi/.test(a.text || ''))), 'mijoz qabul qila olmaydi');

            press(masterChat, acceptButton.callback_data);
            assert.ok(await waitFor(() => tg.answers.find((a) => /Qabul qilindi/.test(a.text || ''))));
            const [row] = await app.db('SELECT status FROM orders WHERE id = $1', [order.data.data.id]);
            assert.equal(row.status, 'accepted');
            const edited = await waitFor(() => tg.edits.find((e) => String(e.message_id) === String(offerMessage.message_id) && /Qabul qildingiz/.test(e.text)));
            assert.ok(edited.reply_markup.inline_keyboard[0].some((b) => /yandex\.uz\/maps/.test(b.url)));
            assert.ok(await waitMessage(clientChat, /Usta topildi/));

            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: master.token, body: { status: 'arrived' } });
            assert.ok(await waitMessage(clientChat, /Usta yetib keldi/));
            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: master.token, body: { status: 'in_progress' } });
            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: master.token, body: { status: 'completed', final_price: 180000 } });
            const done = await waitMessage(clientChat, /Ish yakunlandi/);
            assert.ok(done.text.replace(/ /g, ' ').includes('180 000'));
        });

        it('muddati tugagan taklif xabari yangilanadi', async () => {
            const order = await app.api('/dispatch/orders', { method: 'POST', token: client.token, body: { specialization_id: 1, ...POINT, address: 'Ikkinchi manzil' } });
            const offerMessage = await waitMessage(masterChat, /Ikkinchi manzil/);
            await app.db(`UPDATE dispatch_offers SET expires_at = NOW() - INTERVAL '1 second' WHERE order_id = $1 AND status = 'pending'`, [order.data.data.id]);
            const edited = await waitFor(() => tg.edits.find((e) => String(e.message_id) === String(offerMessage.message_id) && /muddati tugadi/.test(e.text)), { timeout: 10000 });
            assert.ok(edited);
            assert.equal(edited.reply_markup.inline_keyboard.length, 0, 'tugmalar olib tashlandi');
            await app.api(`/dispatch/orders/${order.data.data.id}/cancel`, { method: 'POST', token: client.token, body: { reason: 'Rejalar o\'zgardi' } });
        });

        it('/stop dan keyin xabar yuborilmaydi, /start bilan qayta yoqiladi', async () => {
            text(clientChat, '/stop');
            await waitMessage(clientChat, /Xabarlar o'chirildi/);
            const before = messagesTo(clientChat).length;
            const order = await app.api('/orders', { method: 'POST', token: client.token, body: { title: 'Rozetka', address: 'Uy 3', specialization_id: 2 } });
            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: client.token, body: { status: 'cancelled' } });
            await new Promise((resolve) => setTimeout(resolve, 500));
            assert.equal(messagesTo(clientChat).length, before);
            text(clientChat, '/start');
            assert.ok(await waitMessage(clientChat, /boti ulangan/));
        });

        it('ustaga to\'g\'ridan-to\'g\'ri buyurtma va bekor qilish xabari', async () => {
            const order = await app.api('/orders', {
                method: 'POST', token: client.token, body: { title: 'Unitaz <script>', address: 'Uy 5', master_id: master.id, budget: 250000 },
            });
            const message = await waitMessage(masterChat, /Sizga yangi buyurtma/);
            assert.ok(message.text.includes('Unitaz &lt;script&gt;'));
            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: client.token, body: { status: 'cancelled' } });
            assert.ok(await waitMessage(masterChat, /Buyurtma bekor qilindi: <b>Unitaz/));
        });

        it('Telegram ishlamasa ham buyurtma yaratiladi', async () => {
            tg.fail('sendMessage', 500, 'Internal Server Error', 3);
            const order = await app.api('/orders', { method: 'POST', token: client.token, body: { title: 'Telegram ishlamaganda', address: 'Uy 6', master_id: master.id } });
            assert.equal(order.status, 201);
            tg.clearFailures();
            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token: client.token, body: { status: 'cancelled' } });
        });

        after(async () => {
            await app.api('/dispatch/online', { method: 'PUT', token: master.token, body: { online: false } });
        });
    });

    describe('webhook', () => {
        it('maxfiy kalitsiz so\'rov rad etiladi, to\'g\'ri kalit bilan qabul qilinadi', async () => {
            const bad = await fetch(`${app.url}/api/telegram/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(bad.status, 401);
            const secret = crypto.createHash('sha256').update(`usta24-telegram-webhook:${TEST_BOT_TOKEN}`).digest('hex').slice(0, 48);
            const chat = tgId();
            const good = await fetch(`${app.url}/api/telegram/webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
                body: JSON.stringify({ update_id: 1, message: { message_id: 1, from: from(chat), chat: { id: chat, type: 'private' }, text: '/start' } }),
            });
            assert.equal(good.status, 200);
            assert.ok(await waitMessage(chat, /xush kelibsiz/));
        });
    });
});
