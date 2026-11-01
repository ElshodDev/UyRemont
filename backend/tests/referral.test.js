// Referal dasturi: shaxsiy havola, ro'yxatdan o'tishda bog'lash, bonuslar (bir marta, minimal summa, o'zaro buyurtmasiz)
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startApp, randomPhone, waitFor } = require('./helpers');

describe('referal dasturi', () => {
    let app;
    let referrer; // taklif qiluvchi usta
    let referrerChat;
    let code;
    let newMaster;
    let newClient;
    let outsider; // boshqa mijoz

    // Haqiqiy kirish: kod olish va tasdiqlash (taklif kodi bilan)
    const register = async (phone, extra = {}) => {
        await app.db('UPDATE otp_codes SET created_at = created_at - INTERVAL \'2 minutes\' WHERE phone = $1', [phone]);
        const sent = await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
        const res = await app.api('/auth/verify-otp', {
            method: 'POST', body: { phone, code: sent.data?.data?.devCode, accept_terms: true, name: extra.name, ref: extra.ref },
        });
        assert.equal(res.status, 200, res.data?.message);
        return { token: res.data.data.token, id: res.data.data.user.id };
    };
    const referredBy = async (userId) => (await app.db('SELECT referred_by FROM users WHERE id = $1', [userId]))[0].referred_by;
    const ledger = async (token) => (await app.api('/masters/me/commission', { token })).data.data;
    // Oddiy buyurtma: mijoz beradi, usta bajarib, ish haqi bilan yakunlaydi
    const job = async (clientToken, master, labor) => {
        const created = await app.api('/orders', {
            method: 'POST', token: clientToken, body: { title: 'Kran almashtirish', address: 'Chilonzor 1', master_id: master.id },
        });
        assert.equal(created.status, 201, created.data?.message);
        const id = created.data.data.id;
        for (const status of ['accepted', 'in_progress']) {
            const res = await app.api(`/orders/${id}/status`, { method: 'PUT', token: master.token, body: { status } });
            assert.equal(res.status, 200, res.data?.message);
        }
        const done = await app.api(`/orders/${id}/status`, { method: 'PUT', token: master.token, body: { status: 'completed', labor_price: labor } });
        assert.equal(done.status, 200, done.data?.message);
        return id;
    };

    before(async () => {
        app = await startApp();
        const phone = randomPhone();
        referrer = await app.tokenFor(phone, { name: 'Alisher Taklifchi', role: 'master' });
        await app.db('INSERT INTO master_profiles (user_id, district) VALUES ($1, \'Chilonzor\')', [referrer.id]);
        referrerChat = crypto.randomInt(830000000, 839999999);
        await app.db('INSERT INTO telegram_links (telegram_user_id, chat_id, user_id, phone) VALUES ($1, $1, $2, $3)', [referrerChat, referrer.id, phone]);
        outsider = await app.tokenFor(randomPhone(), { name: 'Begona Mijoz' });
    });
    after(() => app.close());

    it('shaxsiy kod va havola: bir marta yaratiladi, ommaviy sahifada faqat ism', async () => {
        const me = await app.api('/referrals/me', { token: referrer.token });
        assert.equal(me.status, 200);
        code = me.data.data.code;
        assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
        assert.ok(me.data.data.link.endsWith(`/r/${code}`));
        assert.deepEqual(me.data.data.bonuses, { master: 20000, welcome: 20000, client: 5000, min_labor: 50000 });
        assert.equal((await app.api('/referrals/me', { token: referrer.token })).data.data.code, code);

        const pub = await app.api(`/referrals/${code.toLowerCase()}`);
        assert.equal(pub.status, 200);
        assert.equal(pub.data.data.name, 'Alisher');
        assert.equal(pub.data.data.is_master, true);
        assert.equal(JSON.stringify(pub.data).includes('+998'), false);
        assert.equal((await app.api('/referrals/ZZZZZZ')).status, 404);
        assert.equal((await app.api('/referrals/abc')).status, 404);
        const qr = await fetch(`${app.url}/api/referrals/${code}/qr?format=svg`);
        assert.equal(qr.status, 200);
        assert.match(await qr.text(), /<svg/);
    });

    it('ro\'yxatdan o\'tishda bog\'lanadi; mavjud hisob va noto\'g\'ri kod o\'zgartirmaydi', async () => {
        newMaster = await register(randomPhone(), { name: 'Bobur Yangi', ref: code });
        assert.equal(await referredBy(newMaster.id), referrer.id);
        newClient = await register(randomPhone(), { name: 'Dilnoza Mijoz', ref: code.toLowerCase() });
        assert.equal(await referredBy(newClient.id), referrer.id);

        const stranger = await register(randomPhone(), { name: 'Notanish', ref: 'XXXXXX' });
        assert.equal(await referredBy(stranger.id), null);
        // Mavjud hisob qayta kirsa - bog'lanmaydi
        await register(stranger.phone || (await app.db('SELECT phone FROM users WHERE id = $1', [stranger.id]))[0].phone, { ref: code });
        assert.equal(await referredBy(stranger.id), null);
    });

    it('usta taklifi: minimal summadan kam ish bonus bermaydi, birinchi munosib ishda ikkalasiga bonus, keyin yo\'q', async () => {
        const quick = await app.api('/masters/quick-start', { method: 'POST', token: newMaster.token, body: { specialization_ids: [1], district: 'Sergeli' } });
        assert.equal(quick.status, 201, quick.data?.message);
        const before = await ledger(referrer.token);

        await job(outsider.token, newMaster, 40000);
        assert.equal((await ledger(referrer.token)).due, before.due, 'minimal summadan kam');

        const orderId = await job(outsider.token, newMaster, 80000);
        const ref = await ledger(referrer.token);
        assert.equal(ref.due, before.due - 20000);
        const [bonus] = ref.entries;
        assert.equal(bonus.kind, 'bonus');
        assert.equal(bonus.amount, -20000);
        assert.equal(bonus.note, 'Referal: Bobur');
        assert.equal(bonus.order_id, orderId);
        assert.equal(ref.totals.bonus, 20000);

        // Yangi usta: komissiya 10% (4 000 + 8 000) va xush kelibsiz bonusi -20 000
        const mine = await ledger(newMaster.token);
        assert.equal(mine.due, 4000 + 8000 - 20000);
        assert.ok(mine.entries.some((e) => e.kind === 'bonus' && e.amount === -20000 && e.note === 'Xush kelibsiz bonusi'));

        await job(outsider.token, newMaster, 90000);
        assert.equal((await ledger(referrer.token)).due, before.due - 20000, 'bonus bir marta');

        const notice = await waitFor(() => app.telegram.sent.find((m) => String(m.chat.id) === String(referrerChat) && m.text.includes('birinchi ishini bajardi')));
        assert.match(notice.text, /🎁/);
    });

    it('mijoz taklifi: taklif qilgan ustaning o\'zi bajarsa bonus yo\'q, boshqa usta bajarsa bor', async () => {
        const before = (await ledger(referrer.token)).due;
        await job(newClient.token, referrer, 100000);
        // O'zaro buyurtma: faqat komissiya (10 000), bonus yo'q
        assert.equal((await ledger(referrer.token)).due, before + 10000);

        await job(newClient.token, newMaster, 60000);
        assert.equal((await ledger(referrer.token)).due, before + 10000 - 5000);
        const rewards = await app.db('SELECT event, referrer_amount FROM referral_rewards WHERE referee_id = $1', [newClient.id]);
        assert.deepEqual(rewards.map((r) => [r.event, Number(r.referrer_amount)]), [['client_first_order', 5000]]);
    });

    it('statistika va ro\'yxat: faqat ism, telefon yo\'q', async () => {
        const me = (await app.api('/referrals/me', { token: referrer.token })).data.data;
        assert.equal(me.stats.invited, 2);
        assert.equal(me.stats.masters, 1);
        assert.equal(me.stats.active, 2);
        assert.equal(me.stats.earned, 25000);
        const names = me.invited.map((i) => i.name).sort();
        assert.deepEqual(names, ['Bobur', 'Dilnoza']);
        assert.equal(me.invited.find((i) => i.name === 'Bobur').bonus, 20000);
        assert.equal(JSON.stringify(me.invited).includes('+998'), false);
    });

    it('mijoz taklif qilgan usta: taklif qiluvchiga bonus yo\'q (hisobi yo\'q), yangi ustaga xush kelibsiz bonusi bor', async () => {
        const clientCode = (await app.api('/referrals/me', { token: outsider.token })).data.data.code;
        const invited = await register(randomPhone(), { name: 'Sardor Usta', ref: clientCode });
        await app.api('/masters/quick-start', { method: 'POST', token: invited.token, body: { specialization_ids: [1], district: 'Yunusobod' } });
        await job(newClient.token, invited, 70000);
        const [reward] = await app.db('SELECT referrer_amount, referee_amount FROM referral_rewards WHERE referee_id = $1', [invited.id]);
        assert.equal(Number(reward.referrer_amount), 0);
        assert.equal(Number(reward.referee_amount), 20000);
        assert.equal((await ledger(invited.token)).due, 7000 - 20000);
    });
});
