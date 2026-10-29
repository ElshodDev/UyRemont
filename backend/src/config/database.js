// =============================================
// UyRemont - PostgreSQL Ma'lumotlar Bazasi Ulanishi
// Supabase yoki lokal PostgreSQL ga ulanish
// =============================================

const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

/**
 * SSL faqat bulutli bazalar uchun yoqiladi.
 * DATABASE_SSL=true|false orqali majburan belgilash mumkin.
 */
const shouldUseSsl = () => {
    if (process.env.DATABASE_SSL === 'true') return true;
    if (process.env.DATABASE_SSL === 'false') return false;
    return /supabase\.co|neon\.tech|render\.com|amazonaws\.com/.test(connectionString || '');
};

// PostgreSQL connection pool
const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,
    max: 20,                    // Maksimal ulanishlar soni
    idleTimeoutMillis: 30000,   // Bo'sh ulanish kutish vaqti
    connectionTimeoutMillis: 10000, // Ulanish kutish vaqti (bulutli baza "uyg'onishi" uchun)
});

// Bo'sh turgan ulanishdagi xato serverni yiqitmasligi kerak
pool.on('error', (err) => {
    console.error('❌ PostgreSQL ulanishida xato:', describeDbError(err));
});

// Ulanish xatolari uchun tushunarli izohlar
const CONNECTION_ERROR_HINTS = {
    ECONNREFUSED: 'PostgreSQL ishlamayapti yoki manzil/port noto\'g\'ri',
    ENOTFOUND: 'Baza serveri topilmadi - DATABASE_URL dagi manzilni tekshiring',
    EAI_AGAIN: 'Baza serveri manzilini aniqlab bo\'lmadi - internetni tekshiring',
    ETIMEDOUT: 'Baza serveri javob bermadi - internet yoki manzilni tekshiring',
    ECONNRESET: 'Baza serveri ulanishni uzdi',
    '28P01': 'Foydalanuvchi nomi yoki parol noto\'g\'ri',
    '28000': 'Bazaga ulanishga ruxsat yo\'q',
    '3D000': 'Bunday nomli baza mavjud emas',
};

// Jadval topilmadi: baza ulangan, lekin sxema hali yaratilmagan
const SCHEMA_MISSING_CODE = '42P01';
const SCHEMA_MISSING_HINT = 'Jadvallar yaratilmagan - backend papkasida "npm run db:seed" ni ishga tushiring';

const errorCode = (error) => error?.code || error?.errors?.[0]?.code;

const isSchemaMissingError = (error) => errorCode(error) === SCHEMA_MISSING_CODE;

/**
 * Bazaga ulanib bo'lmagani sababli yuzaga kelgan xatomi
 */
const isConnectionError = (error) => Boolean(CONNECTION_ERROR_HINTS[errorCode(error)])
    || /timeout|terminated|ECONNREFUSED/i.test(error?.message || '');

/**
 * Xato matni. Windows da "localhost" ga ulanish xatosi bo'sh matnli
 * AggregateError bo'lib keladi, shuning uchun kod va ichki xatolar ham hisobga olinadi.
 */
const describeDbError = (error) => {
    if (!error) return 'Noma\'lum xato';
    const code = errorCode(error);
    const raw = error.message
        || (Array.isArray(error.errors) && error.errors.map((e) => e.message).filter(Boolean).join('; '))
        || code
        || String(error);
    const hint = CONNECTION_ERROR_HINTS[code] || (code === SCHEMA_MISSING_CODE ? SCHEMA_MISSING_HINT : null);
    return hint ? `${hint} (${raw})` : raw;
};

/**
 * DATABASE_URL dagi server manzili (parolsiz) - loglar uchun
 */
const describeTarget = () => {
    try {
        const url = new URL(connectionString);
        return `${url.hostname}:${url.port || 5432}${url.pathname}`;
    } catch {
        return 'DATABASE_URL o\'rnatilmagan yoki noto\'g\'ri';
    }
};

/**
 * Ulanish va jadvallar mavjudligini tekshirish (server ishga tushganda)
 */
const checkDatabase = async () => {
    try {
        const result = await pool.query('SELECT to_regclass(\'public.users\') IS NOT NULL as ready');
        return { ok: true, schemaReady: result.rows[0].ready };
    } catch (error) {
        return { ok: false, message: describeDbError(error) };
    }
};

/**
 * So'rov yuborish uchun yordamchi funksiya
 * @param {string} text - SQL so'rov
 * @param {Array} params - Parametrlar
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Sekin so'rovlarni loglash (100ms dan ko'p)
        if (duration > 100) {
            console.log('⚠️ Sekin so\'rov:', { duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        if (!isConnectionError(error) && !isSchemaMissingError(error)) {
            console.error('❌ So\'rov xatosi:', describeDbError(error));
        }
        throw error;
    }
};

/**
 * Tranzaksiya uchun client olish
 */
const getClient = () => pool.connect();

/**
 * Callback ichidagi so'rovlarni bitta tranzaksiyada bajarish
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
const withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    getClient,
    withTransaction,
    checkDatabase,
    describeDbError,
    describeTarget,
    isConnectionError,
    isSchemaMissingError,
};
