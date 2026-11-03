// Usta shaxsi: ism, familiya, pasport (shifrlangan, bitta pasport - bitta hisob), tekshiruvga yuborish va admin
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, randomPhone, makeTestJpeg, imageForm } = require('./helpers');

describe('usta shaxsi va pasport', () => {
    let app;
    let admin;
    let client;
    let passport;

    const randomPassport = () => `AB${String(Math.floor(1000000 + Math.random() * 8999999))}`;
    const save = (token, body, headers) => app.api('/masters/me/identity', { method: 'PUT', token, body, headers });

    before(async () => {
        app = await startApp();
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
        client = await app.tokenFor(randomPhone(), { name: 'Eski Ism' });
        passport = randomPassport();
    });
    after(() => app.close());

    it('mijoz hisobidan saqlanadi: ism-familiya profilga, pasport yashirilgan va bazada shifrlangan', async () => {
        const res = await save(client.token, { first_name: ' Alisher ', last_name: 'Valiyev', passport: `${passport.slice(0, 2)} ${passport.slice(2)}`.toLowerCase() });
        assert.equal(res.status, 200, res.data?.message);
        assert.deepEqual(res.data.data, { first_name: 'Alisher', last_name: 'Valiyev', passport_masked: `${passport.slice(0, 2)}*****${passport.slice(-2)}` });
        assert.equal((await app.api('/auth/me', { token: client.token })).data.data.name, 'Alisher Valiyev');

        const [row] = await app.db('SELECT passport_encrypted, passport_hash FROM master_identity WHERE user_id = $1', [client.id]);
        assert.equal(row.passport_encrypted.includes(passport), false, 'ochiq holda saqlanmaydi');
        assert.equal(row.passport_hash.length, 64);
        assert.equal((await app.api('/masters/me/identity', { token: client.token })).data.data.passport_masked.includes(passport.slice(2, 7)), false);
    });

    it('noto\'g\'ri pasport va ism rad etiladi; bitta pasport - bitta hisob', async () => {
        for (const bad of ['A1234567', 'AA123456', 'AA12345678', '1234567AA', '']) {
            const res = await save(client.token, { first_name: 'Ali', last_name: 'Valiyev', passport: bad });
            assert.equal(res.status, 400, bad);
        }
        const digits = await save(client.token, { first_name: 'Ali123', last_name: 'Valiyev', passport });
        assert.equal(digits.status, 400);
        assert.equal(digits.data.message, 'Ismni to\'g\'ri yozing (faqat harflar)');
        assert.equal((await save(client.token, { first_name: 'Ali', last_name: 'V', passport })).status, 400);
        // O'zbekcha tutuq belgisi va kirill harflari mumkin
        assert.equal((await save(client.token, { first_name: 'Gʻayrat', last_name: 'Каримов', passport })).status, 200);

        const other = await app.tokenFor(randomPhone());
        const taken = await save(other.token, { first_name: 'Boshqa', last_name: 'Odam', passport }, { 'Accept-Language': 'ru' });
        assert.equal(taken.status, 409);
        assert.equal(taken.data.message, 'Этот паспорт привязан к другому аккаунту. Обратитесь в службу поддержки');
        assert.equal((await save(admin.token, { first_name: 'Admin', last_name: 'Adminov', passport: randomPassport() })).status, 400);
    });

    it('tekshiruvga yuborish pasport raqamisiz bo\'lmaydi; admin to\'liq raqamni ko\'radi', async () => {
        const master = await app.tokenFor(randomPhone(), { name: 'Usta Pasportsiz' });
        assert.equal((await app.api('/masters/quick-start', { method: 'POST', token: master.token, body: { specialization_ids: [1], district: 'Olmazor' } })).status, 201);
        const upload = await app.api('/masters/me/documents', { method: 'POST', token: master.token, body: imageForm(await makeTestJpeg(), { fields: { kind: 'passport' } }) });
        assert.equal(upload.status, 201, upload.data?.message);

        const noIdentity = await app.api('/masters/me/verification', { method: 'POST', token: master.token });
        assert.equal(noIdentity.status, 400);
        assert.match(noIdentity.data.message, /pasport seriya va raqami/);
        const state = await app.api('/masters/me/verification', { token: master.token });
        assert.equal(state.data.data.requirements.has_identity, false);

        const own = randomPassport();
        assert.equal((await save(master.token, { first_name: 'Rustam', last_name: 'Usmonov', passport: own })).status, 200);
        const sent = await app.api('/masters/me/verification', { method: 'POST', token: master.token });
        assert.equal(sent.status, 200, sent.data?.message);

        const queue = await app.api('/admin/verifications?status=pending', { token: admin.token });
        const row = queue.data.data.find((r) => r.id === master.id);
        assert.ok(row);
        assert.equal(row.passport_number, own);
        assert.equal(row.identity_first_name, 'Rustam');
        assert.equal(row.identity_last_name, 'Usmonov');
        assert.equal('passport_encrypted' in row, false);

        // Tasdiqlangandan keyin pasportni almashtirib bo'lmaydi (ismni - mumkin)
        assert.equal((await app.api(`/admin/verifications/${master.id}/approve`, { method: 'POST', token: admin.token })).status, 200);
        assert.equal((await save(master.token, { first_name: 'Rustam', last_name: 'Usmonov', passport: randomPassport() })).status, 400);
        assert.equal((await save(master.token, { first_name: 'Rustamjon', last_name: 'Usmonov', passport: own })).status, 200);
    });

    it('hisob o\'chirilsa pasport ma\'lumotlari ham o\'chadi', async () => {
        const user = await app.tokenFor(randomPhone(), { name: 'Ketadigan' });
        await save(user.token, { first_name: 'Ketadigan', last_name: 'Odam', passport: randomPassport() });
        const del = await app.api('/auth/me', { method: 'DELETE', token: user.token, body: { confirm: true } });
        assert.ok([200, 204].includes(del.status), JSON.stringify(del.data));
        assert.equal((await app.db('SELECT 1 FROM master_identity WHERE user_id = $1', [user.id])).length, 0);
    });
});
