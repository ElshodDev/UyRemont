// Sof funksiyalar: slug, TOTP (RFC 6238), Telegram yordamchilari
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { slugify, isValidSlug } = require('../src/utils/slug');
const totp = require('../src/utils/totp');

describe('slug', () => {
    it('lotin va kirill ismlardan havola yasaydi', () => {
        assert.equal(slugify('Jamshid Karimov'), 'jamshid-karimov');
        assert.equal(slugify('G\'ayrat O\'ktamov'), 'gayrat-oktamov');
        assert.equal(slugify('Шерзод Алиев'), 'sherzod-aliev');
        assert.equal(slugify('Ёқубжон'), 'yoqubjon');
        assert.equal(slugify('  '), '');
    });

    it('faqat 3-40 belgili, chiziqcha bilan boshlanmaydigan havolalarni qabul qiladi', () => {
        assert.ok(isValidSlug('jamshid-karimov'));
        assert.ok(isValidSlug('usta-24'));
        assert.ok(!isValidSlug('ab'));
        assert.ok(!isValidSlug('-jamshid'));
        assert.ok(!isValidSlug('jamshid-'));
        assert.ok(!isValidSlug('jam--shid'));
        assert.ok(!isValidSlug('Jamshid'));
        assert.ok(!isValidSlug('a'.repeat(41)));
    });
});

describe('TOTP', () => {
    it('RFC 6238 test vektorlariga mos', () => {
        // RFC 4226 ilovasi: "12345678901234567890" kaliti
        const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
        assert.equal(totp.codeForCounter(secret, 1), '287082');
        assert.equal(totp.codeForCounter(secret, 9), '520489');
    });

    it('shifrlangan kalit qayta ochiladi', () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret-value-1234567890-abcdef';
        const secret = totp.generateSecret();
        const encrypted = totp.encryptSecret(secret);
        assert.ok(encrypted.startsWith('v1:'));
        assert.equal(totp.decryptSecret(encrypted), secret);
    });
});

describe('Telegram yordamchilari', () => {
    const { escapeHtml, maskPhone, urlButton } = require('../src/services/telegram/client');

    it('HTML belgilarni xavfsiz qiladi', () => {
        assert.equal(escapeHtml('<b>A & B</b>'), '&lt;b&gt;A &amp; B&lt;/b&gt;');
    });

    it('raqamni yashiradi', () => {
        assert.equal(maskPhone('+998901234567'), '+998 90 *** ** 67');
    });

    it('localhost havolasidan tugma yasamaydi', () => {
        assert.equal(urlButton('Ochish', 'http://localhost:3000/orders/1'), null);
        assert.deepEqual(urlButton('Ochish', 'https://usta24.uz/orders/1'), { text: 'Ochish', url: 'https://usta24.uz/orders/1' });
    });
});
