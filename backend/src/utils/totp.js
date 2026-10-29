// =============================================
// UyRemont - Ikki bosqichli kirish (TOTP, RFC 6238)
// Google Authenticator, Microsoft Authenticator va boshqalar bilan mos
// =============================================

const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

const base32Encode = (buffer) => {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return output;
};

const base32Decode = (text) => {
    const clean = text.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const char of clean) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) throw new Error('Noto\'g\'ri base32 belgi');
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
};

const generateSecret = () => base32Encode(crypto.randomBytes(20));

const codeForCounter = (secret, counter) => {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24)
        | (hmac[offset + 1] << 16)
        | (hmac[offset + 2] << 8)
        | hmac[offset + 3];
    return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
};

const currentCounter = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Kodni tekshirish (+-1 qadam soat farqi uchun).
 * @returns {number|null} mos kelgan hisoblagich (qayta ishlatishni taqiqlash uchun) yoki null
 */
const verifyTotp = (secret, code, { window = 1, now = Date.now() } = {}) => {
    if (!/^\d{6}$/.test(String(code || ''))) return null;
    const counter = currentCounter(now);
    for (let i = -window; i <= window; i += 1) {
        const expected = codeForCounter(secret, counter + i);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(code)))) return counter + i;
    }
    return null;
};

const otpauthUrl = (secret, account, issuer = 'Usta24') => {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
};

// ---------- Maxfiy kalitni bazada shifrlab saqlash (AES-256-GCM) ----------

const encryptionKey = () => crypto
    .createHash('sha256')
    .update(`usta24-totp:${process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || ''}`)
    .digest();

const encryptSecret = (plain) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
};

const decryptSecret = (stored) => {
    const [version, iv, tag, data] = String(stored || '').split(':');
    if (version !== 'v1') throw new Error('Noma\'lum shifr formati');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

module.exports = {
    generateSecret,
    verifyTotp,
    otpauthUrl,
    encryptSecret,
    decryptSecret,
    codeForCounter,
    currentCounter,
    base32Encode,
    base32Decode,
};
