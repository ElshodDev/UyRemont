// MVP: murojaatlar, ustalarni tasdiqlash (hujjatlar), statistika va xatolar jurnali
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { startApp, randomPhone, makeTestJpeg, imageForm } = require('./helpers');

describe('MVP', () => {
    let app;
    let jpeg;
    let admin;
    let client;
    let stranger;
    let master;

    before(async () => {
        app = await startApp();
        jpeg = await makeTestJpeg();
        admin = await app.tokenFor('+998900000000', { role: 'admin' });
        client = await app.tokenFor(randomPhone(), { name: 'Murojaat Mijoz' });
        stranger = await app.tokenFor(randomPhone(), { name: 'Begona' });
        master = await app.tokenFor('+998902223344');
        // Doimiy (seed) usta: oldingi ishga tushirishlardan qolgan murojaatlar limitga (5 ochiq / kuniga 10) urilmasin
        await app.db('DELETE FROM support_tickets WHERE user_id = $1', [master.id]);
    });
    after(() => app.close());

    describe('murojaatlar', () => {
        let orderId;
        let ticketId;

        before(async () => {
            const order = await app.api('/orders', {
                method: 'POST', token: client.token, body: { title: 'Rozetka', address: 'Uy 1', master_id: master.id },
            });
            orderId = order.data.data.id;
        });

        it('qo\'llab-quvvatlash kontaktlari ommaviy', async () => {
            process.env.SUPPORT_PHONE = '+998 71 200 00 00';
            process.env.SUPPORT_TELEGRAM = '@usta24_yordam';
            const res = await app.api('/support/contacts');
            assert.deepEqual(res.data.data, { phone: '+998 71 200 00 00', telegram: 'usta24_yordam' });
        });

        it('mijoz buyurtma bo\'yicha murojaat yuboradi', async () => {
            const res = await app.api('/support', {
                method: 'POST', token: client.token,
                body: { order_id: orderId, category: 'master_no_show', message: 'Usta kelishi kerak edi, lekin kelmadi va telefonni olmayapti' },
            });
            assert.equal(res.status, 201, res.data?.message);
            assert.match(res.data.message, /#\d+/);
            ticketId = res.data.data.id;
        });

        it('noto\'g\'ri tur, qisqa matn va begona buyurtma rad etiladi', async () => {
            const wrongRole = await app.api('/support', { method: 'POST', token: client.token, body: { order_id: orderId, category: 'client_no_pay', message: 'Mijoz to\'lamadi, pul bermadi' } });
            assert.equal(wrongRole.status, 400, 'mijoz "mijoz to\'lamadi" deb yoza olmaydi');
            const short = await app.api('/support', { method: 'POST', token: client.token, body: { order_id: orderId, category: 'quality', message: 'yomon' } });
            assert.equal(short.status, 400);
            const foreign = await app.api('/support', { method: 'POST', token: stranger.token, body: { order_id: orderId, category: 'quality', message: 'Bu mening buyurtmam emas lekin' } });
            assert.equal(foreign.status, 404);
            const noOrder = await app.api('/support', { method: 'POST', token: client.token, body: { category: 'quality', message: 'Buyurtmasiz sifat haqida yozyapman' } });
            assert.equal(noOrder.status, 400, 'buyurtmaga oid tur buyurtmasiz yuborilmaydi');
            const appProblem = await app.api('/support', { method: 'POST', token: client.token, body: { category: 'app_problem', message: 'Xaritada joy belgilanmayapti' } });
            assert.equal(appProblem.status, 201);
        });

        it('usta ham o\'z turidagi murojaatni yuboradi', async () => {
            const res = await app.api('/support', {
                method: 'POST', token: master.token, body: { order_id: orderId, category: 'client_no_pay', message: 'Ish qilindi, mijoz to\'lovdan bosh tortdi' },
            });
            assert.equal(res.status, 201);
        });

        it('ochiq murojaatlar soni cheklangan', async () => {
            const user = await app.tokenFor(randomPhone());
            const statuses = [];
            for (let i = 0; i < 6; i += 1) {
                statuses.push((await app.api('/support', { method: 'POST', token: user.token, body: { category: 'other', message: `Murojaat matni raqam ${i}` } })).status);
            }
            assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
        });

        it('admin ro\'yxatni ko\'radi, javob beradi; foydalanuvchi javobni ko\'radi', async () => {
            assert.equal((await app.api('/admin/support', { token: client.token })).status, 403);
            const list = await app.api('/admin/support?status=open', { token: admin.token });
            const ticket = list.data.data.find((t) => t.id === ticketId);
            assert.ok(ticket, 'murojaat admin ro\'yxatida');
            assert.equal(ticket.user_name, 'Murojaat Mijoz');
            assert.equal(ticket.order_title, 'Rozetka');
            assert.ok(list.data.counts.open >= 1);

            const noReply = await app.api(`/admin/support/${ticketId}`, { method: 'PUT', token: admin.token, body: { status: 'resolved' } });
            assert.equal(noReply.status, 400, 'yakunlashda javob majburiy');
            const done = await app.api(`/admin/support/${ticketId}`, {
                method: 'PUT', token: admin.token, body: { status: 'resolved', admin_reply: 'Usta ogohlantirildi, reytingi pasaytirildi' },
            });
            assert.equal(done.status, 200);

            const mine = await app.api('/support/my', { token: client.token });
            const own = mine.data.data.find((t) => t.id === ticketId);
            assert.equal(own.status, 'resolved');
            assert.equal(own.admin_reply, 'Usta ogohlantirildi, reytingi pasaytirildi');
            assert.equal((await app.api('/support/my', { token: stranger.token })).data.data.length, 0);

            const audit = await app.api('/admin/audit', { token: admin.token });
            assert.ok(audit.data.data.some((e) => e.action === 'support.update'));
        });
    });

    describe('ustani tasdiqlash', () => {
        let newMaster;
        let passportId;

        before(async () => {
            newMaster = await app.tokenFor(randomPhone(), { name: 'Yangi Usta', role: 'master' });
            const [profile] = await app.db('INSERT INTO master_profiles (id, user_id) VALUES (gen_random_uuid(), $1) RETURNING id', [newMaster.id]);
            newMaster.profileId = profile.id;
        });

        it('holat: hujjatsiz "none", talablar ko\'rsatiladi', async () => {
            const res = await app.api('/masters/me/verification', { token: newMaster.token });
            assert.equal(res.data.data.status, 'none');
            assert.deepEqual(res.data.data.requirements, { has_name: true, has_specializations: false, has_passport: false });
            assert.equal((await app.api('/masters/me/verification', { token: client.token })).status, 403);
        });

        it('talablarsiz yuborib bo\'lmaydi', async () => {
            const res = await app.api('/masters/me/verification', { method: 'POST', token: newMaster.token });
            assert.equal(res.status, 400);
            assert.match(res.data.message, /mutaxassislik.*pasport/);
        });

        it('hujjat yopiq papkaga EXIF siz saqlanadi; faqat egasi va admin ko\'radi', async () => {
            const bad = await app.api('/masters/me/documents', { method: 'POST', token: newMaster.token, body: imageForm(jpeg, { fields: { kind: 'diplom' } }) });
            assert.equal(bad.status, 400);
            const res = await app.api('/masters/me/documents', { method: 'POST', token: newMaster.token, body: imageForm(jpeg, { fields: { kind: 'passport' } }) });
            assert.equal(res.status, 201, res.data?.message);
            passportId = res.data.data.id;

            const [{ file_name: fileName }] = await app.db('SELECT file_name FROM master_documents WHERE id = $1', [passportId]);
            const dir = process.env.MASTER_DOC_DIR || path.join(__dirname, '..', 'private_uploads', 'documents');
            const meta = await sharp(path.join(dir, fileName)).metadata();
            assert.equal(meta.exif, undefined);
            assert.equal((await fetch(`${app.url}/uploads/${fileName}`)).status, 404);

            const own = await fetch(`${app.url}/api/masters/me/documents/${passportId}`, { headers: { Authorization: `Bearer ${newMaster.token}` } });
            assert.equal(own.status, 200);
            const asAdmin = await fetch(`${app.url}/api/admin/documents/${passportId}`, { headers: { Authorization: `Bearer ${admin.token}` } });
            assert.equal(asAdmin.status, 200);
            const asOtherMaster = await fetch(`${app.url}/api/masters/me/documents/${passportId}`, { headers: { Authorization: `Bearer ${master.token}` } });
            assert.equal(asOtherMaster.status, 404);
            const asClient = await fetch(`${app.url}/api/admin/documents/${passportId}`, { headers: { Authorization: `Bearer ${client.token}` } });
            assert.equal(asClient.status, 403);
        });

        it('yuborilgach admin navbatida chiqadi', async () => {
            await app.db('INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, 1)', [newMaster.profileId]);
            const sent = await app.api('/masters/me/verification', { method: 'POST', token: newMaster.token });
            assert.equal(sent.status, 200, sent.data?.message);
            assert.equal((await app.api('/masters/me/verification', { method: 'POST', token: newMaster.token })).status, 400, 'ikki marta yuborilmaydi');

            const queue = await app.api('/admin/verifications', { token: admin.token });
            const item = queue.data.data.find((m) => m.id === newMaster.id);
            assert.ok(item, 'navbatda');
            assert.equal(item.status, 'pending');
            assert.equal(item.documents[0].id, passportId);
            assert.ok(queue.data.counts.pending >= 1);
        });

        it('rad etish sabab bilan, qayta yuborish, tasdiqlash', async () => {
            const noNote = await app.api(`/admin/verifications/${newMaster.id}/reject`, { method: 'POST', token: admin.token, body: {} });
            assert.equal(noNote.status, 400);
            const rejected = await app.api(`/admin/verifications/${newMaster.id}/reject`, {
                method: 'POST', token: admin.token, body: { note: 'Pasport rasmi xira, qayta yuklang' },
            });
            assert.equal(rejected.status, 200);
            const state = (await app.api('/masters/me/verification', { token: newMaster.token })).data.data;
            assert.equal(state.status, 'rejected');
            assert.equal(state.note, 'Pasport rasmi xira, qayta yuklang');

            assert.equal((await app.api('/masters/me/verification', { method: 'POST', token: newMaster.token })).status, 200);
            assert.equal((await app.api('/masters/me/verification', { token: newMaster.token })).data.data.status, 'pending');

            const approved = await app.api(`/admin/verifications/${newMaster.id}/approve`, { method: 'POST', token: admin.token });
            assert.equal(approved.status, 200);
            assert.equal((await app.api('/masters/me/verification', { token: newMaster.token })).data.data.status, 'verified');
            const [profile] = await app.db('SELECT is_verified FROM master_profiles WHERE user_id = $1', [newMaster.id]);
            assert.equal(profile.is_verified, true);
            const actions = (await app.api('/admin/audit', { token: admin.token })).data.data.map((e) => e.action);
            assert.ok(actions.includes('master.approve') && actions.includes('master.reject'));
        });

        it('hisob o\'chirilganda hujjat fayllari ham o\'chadi', async () => {
            const temp = await app.tokenFor(randomPhone(), { name: 'Vaqtinchalik Usta', role: 'master' });
            await app.db('INSERT INTO master_profiles (id, user_id) VALUES (gen_random_uuid(), $1)', [temp.id]);
            const doc = await app.api('/masters/me/documents', { method: 'POST', token: temp.token, body: imageForm(jpeg, { fields: { kind: 'selfie' } }) });
            const [{ file_name: fileName }] = await app.db('SELECT file_name FROM master_documents WHERE id = $1', [doc.data.data.id]);
            assert.equal((await app.api('/auth/me', { method: 'DELETE', token: temp.token, body: { confirm: true } })).status, 200);
            const dir = process.env.MASTER_DOC_DIR || path.join(__dirname, '..', 'private_uploads', 'documents');
            assert.ok(!fs.existsSync(path.join(dir, fileName)));
        });
    });

    describe('statistika va xatolar', () => {
        it('statistika: kunlik qatorlar va asosiy ko\'rsatkichlar', async () => {
            assert.equal((await app.api('/admin/analytics', { token: client.token })).status, 403);
            const res = await app.api('/admin/analytics?days=7', { token: admin.token });
            assert.equal(res.status, 200, res.data?.message);
            const { data } = res.data;
            assert.equal(data.days, 7);
            assert.equal(data.daily.length, 7);
            assert.equal(data.hourly.length, 24);
            assert.ok('found_rate' in data.kpi && 'median_wait_sec' in data.kpi);
            assert.ok(data.kpi.open_tickets >= 1);
            assert.equal((await app.api('/admin/analytics?days=1000', { token: admin.token })).data.data.days, 90);
        });

        it('sayt xatosi yoziladi, takrori sanaladi, yo\'ldan parametrlar olib tashlanadi', async () => {
            const message = `TypeError: x${Date.now()} is undefined`;
            const body = { message, stack: `${message}\n    at Foo (/assets/index.js:1:200)`, url: 'https://usta24.uz/orders/1?token=SECRET' };
            assert.equal((await app.api('/client-errors', { method: 'POST', body })).status, 204);
            assert.equal((await app.api('/client-errors', { method: 'POST', body })).status, 204);
            assert.equal((await app.api('/client-errors', { method: 'POST', body: { message: 'ResizeObserver loop limit exceeded' } })).status, 204);

            const list = await app.api('/admin/errors', { token: admin.token });
            const entry = list.data.data.find((e) => e.message === message);
            assert.equal(entry.count, 2);
            assert.equal(entry.url, '/orders/1', 'so\'rov parametrlari (token) saqlanmaydi');
            assert.ok(!list.data.data.some((e) => /ResizeObserver/.test(e.message)), 'shovqin yozilmaydi');

            assert.equal((await app.api(`/admin/errors/${entry.id}/resolve`, { method: 'POST', token: admin.token })).status, 200);
            const after = await app.api('/admin/errors', { token: admin.token });
            assert.ok(!after.data.data.some((e) => e.id === entry.id));
            await app.api('/client-errors', { method: 'POST', body });
            const reopened = await app.api('/admin/errors', { token: admin.token });
            assert.ok(reopened.data.data.some((e) => e.id === entry.id), 'qayta takrorlansa yana ochiladi');
        });

        it('bo\'sh xato matni rad etiladi', async () => {
            assert.equal((await app.api('/client-errors', { method: 'POST', body: {} })).status, 400);
        });
    });
});
