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
    connectionTimeoutMillis: 5000, // Ulanish kutish vaqti
});

// Bo'sh turgan ulanishdagi xato serverni yiqitmasligi kerak
pool.on('error', (err) => {
    console.error('❌ PostgreSQL ulanishida xato:', err.message);
});

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
        console.error('❌ So\'rov xatosi:', error.message);
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

module.exports = { pool, query, getClient, withTransaction };
