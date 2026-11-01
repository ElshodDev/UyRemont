// Shikoyatlar: usta profilidan (buyurtmasiz) va buyurtma bo'yicha, takror shikoyat, admin ogohlantirishi va bloklash
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone, waitFor } = require('./helpers');

describe('shikoyatlar', () => {
    let app;
    let admin;
    let client;
    let otherClient;
    let master;
    let masterChat;
    let orderId;

    const complain = (token, body, headers) => app.api('/support', { method: 'POST', token, body, headers });

    before(async () => {
        app = await startApp();
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
        client = await app.tokenFor(randomPhone(), { name: 'Shikoyatchi Mijoz' });
        otherClient = await app.tokenFor(randomPhone(), { name: 'Ikkinchi Mijoz' });
        const masterPhone = randomPhone();
        master = await app.tokenFor(masterPhone, { name: 'Shikoyatli Usta', role: 'master' });
        await app.db('INSERT INTO master_profiles (user_id, district) VALUES ($1, \'Olmazor\')', [master.id]);
        masterChat = crypto.randomInt(810000000, 819999999);
        await app.db(
            'INSERT INTO telegram_links (telegram_user_id, chat_id, user_id, phone) VALUES ($1, $1, $2, $3)',
            [masterChat, master.id, masterPhone]
        );
        const [order] = await app.db(
            `INSERT INTO orders (client_id, master_id, title, address, status, accepted_at)
             VALUES ($1, $2, 'Kran almashtirish', 'Olmazor 3', 'accepted', NOW()) RETURNING id`,
            [client.id, master.id]
        );
        orderId = order.id;
    });
    after(() => app.close());

    it('mijoz usta profilidan shikoyat qiladi (izohsiz), takror shikoyat 409', async () => {
        const res = await complain(client.token, { category: 'fake_profile', target_user_id: master.id });
        assert.equal(res.status, 201, res.data?.message);
        assert.match(res.data.message, /^Shikoyatingiz qabul qilindi \(#\d+\)\. Usta kim yuborganini bilmaydi$/);
        assert.equal(res.data.data.target_user_id, master.id);
        assert.equal(res.data.data.order_id, null);

        const again = await complain(client.token, { category: 'wrong_info', target_user_id: master.id }, { 'Accept-Language': 'ru' });
        assert.equal(again.status, 409);
        assert.equal(again.data.message, 'Ваша жалоба на этого пользователя уже рассматривается');

        const mine = await app.api('/support/my', { token: client.token });
        const ticket = mine.data.data.find((t) => t.id === res.data.data.id);
        assert.equal(ticket.target_name, 'Shikoyatli Usta');
    });

    it('noto\'g\'ri profil shikoyatlari rad etiladi', async () => {
        // O'ziga, mijozga (usta emas), buyurtma turidagi sabab, "Boshqa" izohsiz
        assert.equal((await complain(master.token, { category: 'fraud', target_user_id: master.id })).status, 400);
        assert.equal((await complain(otherClient.token, { category: 'fraud', target_user_id: client.id })).status, 404);
        assert.equal((await complain(otherClient.token, { category: 'quality', target_user_id: master.id })).status, 400);
        const other = await complain(otherClient.token, { category: 'other', target_user_id: master.id, message: 'qisqa' });
        assert.equal(other.status, 400);
        assert.match(other.data.message, /kamida 10 belgi/);
        // Profil sababi buyurtma ham, usta ham ko'rsatilmasa
        assert.equal((await complain(otherClient.token, { category: 'fake_profile', message: 'Bu soxta profil, rasm boshqa odamniki' })).status, 400);
        // Usta profil shikoyatini yubora olmaydi (faqat mijoz turi)
        assert.equal((await complain(master.token, { category: 'fake_profile', target_user_id: crypto.randomUUID() })).status, 400);
    });

    it('buyurtma bo\'yicha shikoyat ikkinchi tomonga qarshi yoziladi', async () => {
        const byMaster = await complain(master.token, {
            category: 'offsite_payment', order_id: orderId, message: 'Mijoz saytdan tashqari naqd kelishishni so\'radi',
        });
        assert.equal(byMaster.status, 201, byMaster.data?.message);
        assert.equal(byMaster.data.data.target_user_id, client.id);

        const byClient = await complain(otherClient.token, { category: 'quality', order_id: orderId, message: 'Ish sifati juda yomon bo\'ldi' });
        assert.equal(byClient.status, 404, 'boshqa odamning buyurtmasi');

        // Ilovadagi xatolik - hech kimga qarshi emas
        const appProblem = await complain(client.token, { category: 'app_problem', order_id: orderId, message: 'Xarita ochilmayapti, sahifa qotib qoldi' });
        assert.equal(appProblem.status, 201);
        assert.equal(appProblem.data.data.target_user_id, null);
    });

    it('admin shikoyatlarni ko\'radi: kimga qarshi va unga qarshi jami shikoyatlar', async () => {
        await complain(otherClient.token, { category: 'offsite_payment', target_user_id: master.id, message: 'Raqamini berib, to\'g\'ridan-to\'g\'ri chaqiring dedi' });
        const list = await app.api('/admin/support?kind=complaint', { token: admin.token });
        assert.equal(list.status, 200);
        assert.ok(list.data.data.every((t) => t.target_user_id), 'faqat shikoyatlar');
        const row = list.data.data.find((t) => t.target_user_id === master.id && t.user_id === otherClient.id);
        assert.ok(row);
        assert.equal(row.target_name, 'Shikoyatli Usta');
        assert.equal(row.target_role, 'master');
        assert.equal(row.target_complaints, 2);
        assert.equal(row.target_reporters, 2);
        assert.equal(row.target_open, 2);
        assert.equal(row.target_warnings, 0);
        assert.equal(row.target_is_active, true);

        const all = await app.api('/admin/support', { token: admin.token });
        assert.ok(all.data.data.some((t) => !t.target_user_id), 'oddiy murojaatlar ham bor');
    });

    it('admin ogohlantirish yuboradi: Telegram, "Murojaatlarim" va jurnal', async () => {
        const list = await app.api('/admin/support?kind=complaint', { token: admin.token });
        const ticket = list.data.data.find((t) => t.target_user_id === master.id);

        assert.equal((await app.api(`/admin/users/${master.id}/warnings`, { method: 'POST', token: client.token, body: { message: 'Sinov ogohlantirishi matni' } })).status, 403);
        assert.equal((await app.api(`/admin/users/${master.id}/warnings`, { method: 'POST', token: admin.token, body: { message: 'qisqa' } })).status, 400);
        assert.equal((await app.api(`/admin/users/${admin.id}/warnings`, { method: 'POST', token: admin.token, body: { message: 'Administratorga ogohlantirish' } })).status, 400);

        const text = 'Mijozlardan saytdan tashqari to\'lov so\'ramang. Bu qoidalarga zid.';
        const res = await app.api(`/admin/users/${master.id}/warnings`, {
            method: 'POST', token: admin.token, body: { message: text, ticket_id: ticket.id },
        });
        assert.equal(res.status, 201, res.data?.message);

        const telegram = await waitFor(() => app.telegram.sent.find((m) => String(m.chat.id) === String(masterChat) && m.text.includes('ogohlantirishi')));
        assert.ok(telegram.text.includes(text.replace(/'/g, '&#39;')) || telegram.text.includes(text));

        const mine = await app.api('/support/my', { token: master.token });
        assert.equal(mine.data.warnings.length, 1);
        assert.equal(mine.data.warnings[0].message, text);
        // Usta o'ziga qarshi shikoyatlarni va kim yuborganini ko'rmaydi (faqat o'zi yuborganlari)
        assert.ok(mine.data.data.every((t) => t.target_user_id !== master.id));
        assert.equal(JSON.stringify(mine.data).includes('Ikkinchi Mijoz'), false);

        const after = await app.api('/admin/support?kind=complaint', { token: admin.token });
        assert.equal(after.data.data.find((t) => t.target_user_id === master.id).target_warnings, 1);
        const audit = await app.db('SELECT action FROM admin_audit_log WHERE target_user_id = $1 AND action = \'user.warn\'', [master.id]);
        assert.equal(audit.length, 1);
    });

    it('bloklangan usta katalogda ko\'rinmaydi, profili ochilmaydi', async () => {
        const block = await app.api(`/admin/users/${master.id}`, { method: 'PATCH', token: admin.token, body: { is_active: false } });
        assert.equal(block.status, 200, block.data?.message);
        assert.equal((await app.api(`/masters/${master.id}`)).status, 404);
        const list = await app.api('/masters?district=Olmazor&limit=50');
        assert.equal(list.data.data.masters.some((m) => m.id === master.id), false);
        const row = (await app.api('/admin/support?kind=complaint', { token: admin.token })).data.data.find((t) => t.target_user_id === master.id);
        assert.equal(row.target_is_active, false);
    });
});
