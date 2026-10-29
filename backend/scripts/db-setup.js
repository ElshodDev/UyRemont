// =============================================
// UyRemont - Ma'lumotlar bazasini tayyorlash
// Foydalanish:
//   node scripts/db-setup.js          -> faqat sxema (jadvallar, katalog)
//   node scripts/db-setup.js --seed   -> sxema + demo ma'lumotlar
// ADMIN_PHONE berilsa, shu raqam administrator qilib belgilanadi.
// =============================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool, describeDbError, describeTarget } = require('../src/config/database');
const { normalizePhone } = require('../src/utils/validators');

const MODELS_DIR = path.join(__dirname, '..', 'src', 'models');

const runSqlFile = async (client, fileName) => {
    const sql = fs.readFileSync(path.join(MODELS_DIR, fileName), 'utf8');
    await client.query(sql);
    console.log(`✅ ${fileName} bajarildi`);
};

const ensureAdmin = async (client) => {
    if (!process.env.ADMIN_PHONE) return;
    const phone = normalizePhone(process.env.ADMIN_PHONE);
    if (!phone) {
        console.warn('⚠️ ADMIN_PHONE noto\'g\'ri formatda (+998XXXXXXXXX), admin yaratilmadi');
        return;
    }
    await client.query(
        `INSERT INTO users (id, phone, role, name, is_active)
         VALUES ($1, $2, 'admin', $3, TRUE)
         ON CONFLICT (phone) DO UPDATE SET role = 'admin', is_active = TRUE`,
        [uuidv4(), phone, process.env.ADMIN_NAME || 'Administrator']
    );
    console.log(`👑 Administrator: ${phone}`);
};

const main = async () => {
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL o\'rnatilmagan. Loyiha papkasida "npm run setup" ni ishga tushiring yoki backend/.env ni to\'ldiring');
        process.exit(1);
    }

    const withSeed = process.argv.includes('--seed');
    let client;
    try {
        client = await pool.connect();
    } catch (error) {
        console.error(`❌ Ma'lumotlar bazasiga ulanib bo'lmadi (${describeTarget()}): ${describeDbError(error)}`);
        await pool.end();
        process.exitCode = 1;
        return;
    }
    console.log(`🔌 Ulandi: ${describeTarget()}`);
    try {
        await client.query('BEGIN');
        await runSqlFile(client, 'schema.sql');
        if (withSeed) await runSqlFile(client, 'seed.sql');
        await ensureAdmin(client);
        await client.query('COMMIT');
        console.log('🎉 Ma\'lumotlar bazasi tayyor');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Xatolik:', describeDbError(error));
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
};

main();
