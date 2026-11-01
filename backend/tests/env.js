// =============================================
// Har bir test fayli yuklanishidan OLDIN ishlaydi (package.json: node --require ./tests/env.js --test):
// baza ulanishi faqat TEST_DATABASE_URL ga. Test fayli server modulini startApp() dan oldin
// yuklasa ham, backend/.env dagi asosiy bazaga hech narsa yozilmaydi.
// =============================================

const { resolveTestDatabaseUrl } = require('./helpers');

try {
    process.env.DATABASE_URL = resolveTestDatabaseUrl();
    process.env.DATABASE_SSL = 'false';
} catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
}
