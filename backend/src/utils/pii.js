// =============================================
// Shaxsiy ma'lumotlarni bazada shifrlash (pasport seriya-raqami): AES-256-GCM va takrorni aniqlash uchun HMAC.
// Kalit: DATA_ENCRYPTION_KEY (bo'lmasa JWT_SECRET). Kalit almashtirilsa eski yozuvlarni ochib bo'lmaydi.
// =============================================

const crypto = require('crypto');

const secret = () => process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
const encryptionKey = () => crypto.createHash('sha256').update(`usta24-pii:${secret()}`).digest();
const hashKey = () => crypto.createHash('sha256').update(`usta24-pii-hash:${secret()}`).digest();

const encryptPii = (plain) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
};

const decryptPii = (stored) => {
    const [version, iv, tag, data] = String(stored || '').split(':');
    if (version !== 'v1') throw new Error('Noma\'lum shifr formati');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

/** Bir xil qiymat uchun bir xil iz (ochib bo'lmaydi) */
const hashPii = (plain) => crypto.createHmac('sha256', hashKey()).update(String(plain)).digest('hex');

// O'zbekiston pasporti / ID karta: 2 lotin harfi + 7 raqam (AA1234567, AD1234567)
const PASSPORT = /^[A-Z]{2}\d{7}$/;
const normalizePassport = (value) => String(value || '').toUpperCase().replace(/[\s-]/g, '');
const isValidPassport = (value) => PASSPORT.test(normalizePassport(value));
// Ko'rsatish uchun: AA*****67
const maskPassport = (passport) => (passport ? `${passport.slice(0, 2)}*****${passport.slice(-2)}` : null);

module.exports = { encryptPii, decryptPii, hashPii, normalizePassport, isValidPassport, maskPassport };
