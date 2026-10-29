// =============================================
// UyRemont - Telefonini yo'qotgan foydalanuvchi uchun 2FA ni o'chirish
// Faqat serverga kirish huquqi bor odam bajara oladi:
//   node scripts/reset-2fa.js +998900000000
// Barcha sessiyalar ham bekor qilinadi.
// =============================================

require('dotenv').config();
const { pool } = require('../src/config/database');
const { normalizePhone } = require('../src/utils/validators');

const main = async () => {
    const phone = normalizePhone(process.argv[2] || '');
    if (!phone) {
        console.error('Foydalanish: node scripts/reset-2fa.js +998XXXXXXXXX');
        process.exitCode = 1;
        return;
    }
    const result = await pool.query(
        `UPDATE users
         SET totp_enabled = FALSE, totp_secret = NULL, totp_last_counter = NULL,
             token_version = token_version + 1
         WHERE phone = $1
         RETURNING id, name, role`,
        [phone]
    );
    if (result.rows.length === 0) {
        console.error(`❌ ${phone} raqamli foydalanuvchi topilmadi`);
        process.exitCode = 1;
    } else {
        const user = result.rows[0];
        console.log(`✅ ${user.name || phone} (${user.role}) uchun 2FA o'chirildi va barcha sessiyalar bekor qilindi`);
    }
};

main()
    .catch((error) => {
        console.error('❌ Xatolik:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
