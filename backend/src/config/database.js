// =============================================
// UyRemont - PostgreSQL Ma'lumotlar Bazasi Ulanishi
// Supabase orqali PostgreSQL ga ulanish
// =============================================

const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Supabase SSL uchun
    },
    max: 20,                    // Maksimal ulanishlar soni
    idleTimeoutMillis: 30000,   // Bo'sh ulanish kutish vaqti
    connectionTimeoutMillis: 2000, // Ulanish kutish vaqti
});

// Ulanishni tekshirish
pool.on('connect', () => {
    console.log('✅ PostgreSQL ga muvaffaqiyatli ulandi');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL ulanishida xato:', err.message);
    process.exit(-1);
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
            console.log('⚠️ Sekin so\'rov:', { text, duration, rows: res.rowCount });
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

module.exports = { pool, query, getClient };
