// =============================================
// "npm test" dan oldin: test bazasida sxema va demo ma'lumotlarni tayyorlash
// =============================================

const { spawnSync } = require('child_process');
const path = require('path');
const { resolveTestDatabaseUrl } = require('./helpers');

let url;
try {
    url = resolveTestDatabaseUrl();
} catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
}

const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'db-setup.js'), '--seed'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DATABASE_SSL: 'false', ADMIN_PHONE: '+998900000000' },
});
process.exit(result.status ?? 1);
