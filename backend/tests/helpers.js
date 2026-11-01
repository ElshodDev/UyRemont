// =============================================
// Test yordamchilari: alohida test bazasida serverni ishga tushirish, so'rovlar, tokenlar
// Testlar FAQAT TEST_DATABASE_URL dagi bazada ishlaydi (asosiy bazaga tegmaydi).
// =============================================

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { startFakeTelegram } = require('./fakeTelegram');

const TEST_JWT_SECRET = 'test-jwt-secret-for-automated-tests-only-1234567890';
const TEST_BOT_TOKEN = '123456:TEST_TOKEN_abcdefghijklmnopqrstuvwxyz12';

/**
 * TEST_DATABASE_URL ni tekshirish: yo'q bo'lsa yoki backend/.env dagi asosiy baza bilan bir xil bo'lsa to'xtatiladi
 */
const resolveTestDatabaseUrl = () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
        throw new Error('TEST_DATABASE_URL o\'rnatilmagan. Testlar alohida bazada ishlaydi, masalan: '
            + 'TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/uyremont_test npm test');
    }
    const envFile = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envFile)) {
        const mainUrl = require('dotenv').parse(fs.readFileSync(envFile)).DATABASE_URL;
        if (mainUrl && mainUrl === url) {
            throw new Error('TEST_DATABASE_URL asosiy baza (backend/.env DATABASE_URL) bilan bir xil. Testlar uchun alohida baza oching');
        }
    }
    return url;
};

/**
 * Serverni (API, socket, dispetcher, soxta Telegram bilan bot) tasodifiy portda ishga tushirish
 */
const startApp = async () => {
    const telegram = await startFakeTelegram();
    Object.assign(process.env, {
        NODE_ENV: 'test',
        DATABASE_URL: resolveTestDatabaseUrl(),
        JWT_SECRET: TEST_JWT_SECRET,
        OTP_DEV_MODE: 'true',
        TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
        TELEGRAM_API_URL: telegram.url,
        PUBLIC_APP_URL: 'https://usta24.example.uz',
        DATABASE_SSL: 'false',
        // backend/.env dagi haqiqiy SMS/webhook sozlamalari testlarda ishlatilmasin (dotenv mavjud qiymatni almashtirmaydi)
        ESKIZ_EMAIL: '',
        ESKIZ_PASSWORD: '',
        TELEGRAM_WEBHOOK_URL: '',
        UPLOAD_DIR: path.join(os.tmpdir(), 'usta24-test', 'uploads'),
        ORDER_PHOTO_DIR: path.join(os.tmpdir(), 'usta24-test', 'orders'),
        MASTER_DOC_DIR: path.join(os.tmpdir(), 'usta24-test', 'documents'),
    });

    const { server, io } = require('../server');
    const { startDispatcher, stopDispatcher } = require('../src/services/dispatch.service');
    const { startTelegramBot, stopTelegramBot } = require('../src/services/telegram/bot');
    const { pool } = require('../src/config/database');

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    startDispatcher(io);
    await startTelegramBot();

    const db = async (sql, params) => (await pool.query(sql, params)).rows;

    /**
     * API so'rovi: { status, data } (data - JSON javob)
     */
    const api = async (pathname, { method = 'GET', body, token, headers = {} } = {}) => {
        const isForm = body instanceof FormData;
        const res = await fetch(`${url}/api${pathname}`, {
            method,
            headers: {
                ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
                ...(token && { Authorization: `Bearer ${token}` }),
                ...headers,
            },
            body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        return { status: res.status, data, headers: res.headers };
    };

    /**
     * Foydalanuvchini bazada yaratib (yoki topib) to'g'ridan-to'g'ri token olish (OTP siz, tez)
     */
    const tokenFor = async (phone, { name = 'Test Foydalanuvchi', role } = {}) => {
        const [user] = await db(
            `INSERT INTO users (id, phone, role, name, is_active, terms_accepted_at, terms_version)
             VALUES ($1, $2, COALESCE($4, 'client'), $3, TRUE, NOW(), '2026-10')
             ON CONFLICT (phone) DO UPDATE SET
                 is_active = TRUE, role = COALESCE($4, users.role), name = COALESCE(users.name, $3)
             RETURNING id, token_version`,
            [crypto.randomUUID(), phone, name, role || null]
        );
        const jwt = require('jsonwebtoken');
        return { token: jwt.sign({ userId: user.id, tv: user.token_version }, TEST_JWT_SECRET, { expiresIn: '1h' }), id: user.id };
    };

    const close = async () => {
        stopDispatcher();
        stopTelegramBot();
        io.close();
        await new Promise((resolve) => server.close(resolve));
        await telegram.close();
        await pool.end();
    };

    return { url, api, db, tokenFor, telegram, close };
};

/**
 * Tasodifiy O'zbekiston raqami (har testda yangi foydalanuvchi)
 */
const randomPhone = () => `+99893${crypto.randomInt(1000000, 9999999)}`;

/**
 * Shart bajarilguncha kutish (dispetcher, Telegram kabi fon jarayonlari uchun)
 */
const waitFor = async (fn, { timeout = 8000, interval = 100 } = {}) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        const value = await fn();
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return null;
};

/**
 * Sinov rasmi: EXIF va GPS bilan (sharp orqali yaratiladi, repoda binar fayl saqlanmaydi)
 */
const makeTestJpeg = () => require('sharp')({
    create: { width: 2400, height: 1800, channels: 3, background: { r: 30, g: 120, b: 200 } },
})
    .jpeg()
    .withExif({
        IFD0: { Make: 'TestPhoneMaker', Model: 'GPS Test' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 18/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '69/1 14/1 0/1' },
    })
    .toBuffer();

const imageForm = (buffer, { type = 'image/jpeg', name = 'photo.jpg', fields = {} } = {}) => {
    const form = new FormData();
    form.append('image', new Blob([buffer], { type }), name);
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    return form;
};

module.exports = {
    startApp, randomPhone, waitFor, makeTestJpeg, imageForm, resolveTestDatabaseUrl, TEST_BOT_TOKEN,
};
