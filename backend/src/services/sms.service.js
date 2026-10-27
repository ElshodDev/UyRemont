// =============================================
// UyRemont - Eskiz.uz SMS xizmati
// ESKIZ_EMAIL/ESKIZ_PASSWORD berilmasa, kod konsolga chiqariladi (development)
// =============================================

const ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api';

let cachedToken = null;
let tokenExpiresAt = 0;

const isSmsConfigured = () => Boolean(process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD);

/**
 * Eskiz tokenini olish (29 kun keshlanadi, token 30 kun amal qiladi)
 */
const getEskizToken = async (forceRefresh = false) => {
    if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

    const body = new FormData();
    body.append('email', process.env.ESKIZ_EMAIL);
    body.append('password', process.env.ESKIZ_PASSWORD);

    const response = await fetch(`${ESKIZ_BASE_URL}/auth/login`, { method: 'POST', body });
    if (!response.ok) {
        throw new Error(`Eskiz login xatosi: ${response.status}`);
    }
    const data = await response.json();
    cachedToken = data?.data?.token;
    if (!cachedToken) throw new Error('Eskiz token qaytarmadi');
    tokenExpiresAt = Date.now() + 29 * 24 * 60 * 60 * 1000;
    return cachedToken;
};

const postSms = async (token, phone, message) => {
    const body = new FormData();
    body.append('mobile_phone', phone.replace('+', ''));
    body.append('message', message);
    body.append('from', process.env.ESKIZ_FROM || '4546');

    return fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
    });
};

/**
 * OTP kodni SMS orqali yuborish
 * @returns {Promise<{ delivered: boolean }>} delivered=false bo'lsa kod faqat konsolga chiqarilgan
 */
const sendOtpSms = async (phone, code) => {
    const message = `UyRemont: Tasdiqlash kodingiz: ${code}. Kod 5 daqiqa amal qiladi.`;

    if (!isSmsConfigured()) {
        console.log(`📱 OTP kodi [${phone}]: ${code} (SMS sozlanmagan, faqat development)`);
        return { delivered: false };
    }

    let response = await postSms(await getEskizToken(), phone, message);
    if (response.status === 401) {
        // Token muddati o'tgan bo'lsa bir marta yangilab qayta urinish
        response = await postSms(await getEskizToken(true), phone, message);
    }
    if (!response.ok) {
        throw new Error(`Eskiz SMS yuborish xatosi: ${response.status}`);
    }
    return { delivered: true };
};

module.exports = { sendOtpSms, isSmsConfigured };
