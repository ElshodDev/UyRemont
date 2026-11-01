// Kirish va xavfsizlik: OTP, rozilik, limitlar, sessiyalarni bekor qilish, bloklash, 2FA, hisobni o'chirish
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, randomPhone } = require('./helpers');
const totp = require('../src/utils/totp');

const ADMIN_PHONE = '+998900000000';

describe('kirish va xavfsizlik', () => {
    let app;

    // OTP orqali kirish (60 soniyalik oraliq sinov uchun orqaga suriladi)
    const login = async (phone, extra = { accept_terms: true }) => {
        await app.db(`UPDATE otp_codes SET created_at = created_at - INTERVAL '2 minutes' WHERE phone = $1`, [phone]);
        const sent = await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
        const verified = await app.api('/auth/verify-otp', { method: 'POST', body: { phone, code: sent.data?.data?.devCode, ...extra } });
        return { sent, verified, token: verified.data?.data?.token, user: verified.data?.data?.user };
    };

    before(async () => {
        app = await startApp();
        await app.db('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, totp_last_counter = NULL WHERE phone = $1', [ADMIN_PHONE]);
        // Testlar bir kunda ko'p marta ishga tushirilsa, admin raqamining kunlik kod cheklovi to'lib qolmasin
        await app.db('DELETE FROM otp_codes WHERE phone = $1', [ADMIN_PHONE]);
    });
    after(() => app.close());

    describe('OTP', () => {
        it('sinov rejimida kod javobda qaytadi va noto\'g\'ri raqam rad etiladi', async () => {
            const bad = await app.api('/auth/send-otp', { method: 'POST', body: { phone: '12345' } });
            assert.equal(bad.status, 400);
            const sent = await app.api('/auth/send-otp', { method: 'POST', body: { phone: randomPhone() } });
            assert.equal(sent.status, 200);
            assert.match(sent.data.data.devCode, /^\d{6}$/);
            assert.equal(sent.data.data.channel, 'sms');
        });

        it('rozilik bermagan yangi foydalanuvchi kira olmaydi, kod esa sarflanmaydi', async () => {
            const phone = randomPhone();
            const sent = await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
            const noTerms = await app.api('/auth/verify-otp', { method: 'POST', body: { phone, code: sent.data.data.devCode } });
            assert.equal(noTerms.status, 400);
            assert.equal(noTerms.data.code, 'TERMS_REQUIRED');
            const withTerms = await app.api('/auth/verify-otp', { method: 'POST', body: { phone, code: sent.data.data.devCode, accept_terms: true } });
            assert.equal(withTerms.status, 200);
            const [user] = await app.db('SELECT terms_version FROM users WHERE phone = $1', [phone]);
            assert.equal(user.terms_version, '2026-10');
        });

        it('60 soniya ichida qayta so\'ralsa 429 va retryAfter', async () => {
            const phone = randomPhone();
            await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
            const again = await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
            assert.equal(again.status, 429);
            assert.ok(again.data.retryAfter > 0);
        });

        it('5 ta noto\'g\'ri urinishdan keyin kod bekor qilinadi', async () => {
            const phone = randomPhone();
            const sent = await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
            const wrong = sent.data.data.devCode === '000000' ? '111111' : '000000';
            for (let i = 0; i < 5; i += 1) {
                await app.api('/auth/verify-otp', { method: 'POST', body: { phone, code: wrong, accept_terms: true } });
            }
            const right = await app.api('/auth/verify-otp', { method: 'POST', body: { phone, code: sent.data.data.devCode, accept_terms: true } });
            assert.equal(right.status, 400);
        });

        it('sutkalik limitdan ortiq kod berilmaydi', async () => {
            const phone = randomPhone();
            await app.db(
                `INSERT INTO otp_codes (id, phone, code, expires_at, is_used, created_at)
                 SELECT gen_random_uuid(), $1, '111111', NOW(), TRUE, NOW() - (g || ' minutes')::interval
                 FROM generate_series(2, 101) g`,
                [phone]
            );
            const res = await app.api('/auth/send-otp', { method: 'POST', body: { phone } });
            assert.equal(res.status, 429);
        });
    });

    describe('sessiyalar', () => {
        it('"barcha qurilmalardan chiqish" eski tokenni bekor qiladi', async () => {
            const { token } = await login(randomPhone());
            assert.equal((await app.api('/auth/me', { token })).status, 200);
            assert.equal((await app.api('/auth/logout-all', { method: 'POST', token })).status, 200);
            assert.equal((await app.api('/auth/me', { token })).status, 401);
        });

        it('bloklash sessiyani darhol bekor qiladi va jurnalga yoziladi', async () => {
            const admin = await login(ADMIN_PHONE);
            const victim = await login(randomPhone());
            const block = await app.api(`/admin/users/${victim.user.id}`, { method: 'PATCH', token: admin.token, body: { is_active: false } });
            assert.equal(block.status, 200, block.data?.message);
            const me = await app.api('/auth/me', { token: victim.token });
            assert.ok([401, 403].includes(me.status));
            const audit = await app.api('/admin/audit', { token: admin.token });
            assert.ok(audit.data.data.some((e) => e.action === 'user.block' && e.target_phone === victim.user.phone));
            assert.equal((await login(victim.user.phone)).verified.status, 403);
        });

        it('mijoz admin API ga kira olmaydi', async () => {
            const { token } = await app.tokenFor(randomPhone());
            assert.equal((await app.api('/admin/stats', { token })).status, 403);
        });
    });

    describe('ikki bosqichli kirish (2FA)', () => {
        it('yoqish, kirish, qayta ishlatishdan va terib topishdan himoya, o\'chirish', async () => {
            let admin = await login(ADMIN_PHONE);
            const setup = await app.api('/auth/2fa/setup', { method: 'POST', token: admin.token });
            assert.equal(setup.status, 200);
            assert.ok(setup.data.data.qr.startsWith('data:image/png'));
            const [stored] = await app.db('SELECT totp_secret FROM users WHERE phone = $1', [ADMIN_PHONE]);
            assert.ok(stored.totp_secret.startsWith('v1:'), 'kalit shifrlangan saqlanadi');

            const { secret } = setup.data.data;
            const now = totp.currentCounter();
            assert.equal((await app.api('/auth/2fa/enable', { method: 'POST', token: admin.token, body: { code: '000000' } })).status, 400);
            const enable = await app.api('/auth/2fa/enable', { method: 'POST', token: admin.token, body: { code: totp.codeForCounter(secret, now) } });
            assert.equal(enable.status, 200);

            const step1 = await login(ADMIN_PHONE);
            assert.equal(step1.token, undefined);
            assert.equal(step1.verified.data.data.requires_2fa, true);
            const challenge = step1.verified.data.data.challenge_token;
            assert.equal((await app.api('/admin/stats', { token: challenge })).status, 401, 'vaqtinchalik token API ga kirmaydi');
            const reused = await app.api('/auth/2fa/verify', { method: 'POST', body: { challenge_token: challenge, code: totp.codeForCounter(secret, now) } });
            assert.equal(reused.status, 400, 'ishlatilgan kod qayta ishlamaydi');
            const good = await app.api('/auth/2fa/verify', { method: 'POST', body: { challenge_token: challenge, code: totp.codeForCounter(secret, now + 1) } });
            assert.equal(good.status, 200);
            admin = { token: good.data.data.token };

            const step2 = await login(ADMIN_PHONE);
            const statuses = [];
            for (let i = 0; i < 6; i += 1) {
                statuses.push((await app.api('/auth/2fa/verify', {
                    method: 'POST', body: { challenge_token: step2.verified.data.data.challenge_token, code: String(100000 + i) },
                })).status);
            }
            assert.equal(statuses[5], 429, statuses.join(','));

            // Ishlatilgan kod qayta qabul qilinmaydi: keyingi 30 soniyalik oraliq kelganini simulyatsiya qilamiz
            await app.db('UPDATE users SET totp_last_counter = $2 WHERE phone = $1', [ADMIN_PHONE, now - 2]);
            const disable = await app.api('/auth/2fa/disable', { method: 'POST', token: admin.token, body: { code: totp.codeForCounter(secret, now) } });
            assert.equal(disable.status, 200, disable.data?.message);
        });
    });

    describe('hisobni o\'chirish', () => {
        it('tasdiqsiz va admin hisobini o\'chirib bo\'lmaydi', async () => {
            const { token } = await login(randomPhone());
            assert.equal((await app.api('/auth/me', { method: 'DELETE', token, body: {} })).status, 400);
            const admin = await app.tokenFor(ADMIN_PHONE);
            assert.equal((await app.api('/auth/me', { method: 'DELETE', token: admin.token, body: { confirm: true } })).status, 400);
        });

        it('faol buyurtma bo\'lsa o\'chirilmaydi, bo\'lmasa ma\'lumotlar anonimlashtiriladi', async () => {
            const phone = randomPhone();
            const { token, user } = await login(phone);
            const order = await app.api('/orders', { method: 'POST', token, body: { title: 'Kran', address: 'Uy 1', specialization_id: 1 } });
            assert.equal((await app.api('/auth/me', { method: 'DELETE', token, body: { confirm: true } })).status, 409);
            await app.api(`/orders/${order.data.data.id}/status`, { method: 'PUT', token, body: { status: 'cancelled' } });

            const res = await app.api('/auth/me', { method: 'DELETE', token, body: { confirm: true } });
            assert.equal(res.status, 200);
            assert.equal((await app.api('/auth/me', { token })).status, 401);
            const [row] = await app.db('SELECT name, phone, deleted_at FROM users WHERE id = $1', [user.id]);
            assert.equal(row.name, null);
            assert.match(row.phone, /^x[0-9a-f]{14}$/);
            assert.ok(row.deleted_at);
            const [kept] = await app.db('SELECT COUNT(*)::int as total FROM orders WHERE client_id = $1', [user.id]);
            assert.equal(kept.total, 1, 'buyurtma tarixi saqlanadi');
            assert.equal((await login(phone)).verified.status, 200, 'o\'sha raqam bilan yangi hisob ochish mumkin');
        });
    });
});
