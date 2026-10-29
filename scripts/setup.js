// =============================================
// UyRemont - bir buyruqda o'rnatish va sozlash
// Foydalanish (loyiha papkasida):
//   npm run setup                      -> paketlar, .env, baza (demo ma'lumotlar bilan)
//   npm run setup -- --no-seed         -> demo ma'lumotlarsiz
//   npm run setup -- --skip-install    -> paketlarni qayta o'rnatmasdan
// =============================================

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const WEB = path.join(ROOT, 'web');
const ENV_PATH = path.join(BACKEND, '.env');
const ENV_EXAMPLE_PATH = path.join(BACKEND, '.env.example');
const PLACEHOLDER_SECRETS = ['', 'your_super_secret_jwt_key_here'];
const LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/uyremont';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const TOTAL_STEPS = 4;

const step = (n, text) => console.log(`\n[${n}/${TOTAL_STEPS}] ${text}`);
const fail = (message) => {
    console.error(`\n❌ ${message}`);
    process.exit(1);
};

/**
 * Buyruqni ishga tushirish (Windows da npm.cmd uchun shell kerak)
 */
const run = (command, commandArgs, cwd) => {
    const result = spawnSync(command, commandArgs, {
        cwd,
        // stdin berilmaydi: aks holda npm foydalanuvchi kiritgan matnni "yutib" yuboradi
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: process.platform === 'win32',
    });
    return result.status === 0;
};

const ask = (question) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
        resolve(answer);
        rl.close();
    });
    rl.on('close', () => resolve(''));
});

// ---------- .env bilan ishlash ----------

const readEnvLines = () => fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);

const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2');

const getEnv = (lines, key) => {
    const line = lines.find((l) => l.trim().startsWith(`${key}=`));
    return line === undefined ? undefined : unquote(line.slice(line.indexOf('=') + 1));
};

/**
 * Kalitni yangilash: birinchi qatorni almashtiradi, takroriy qatorlarni olib tashlaydi
 */
const setEnv = (lines, key, value) => {
    const formatted = `${key}="${value}"`;
    let replaced = false;
    const result = [];
    lines.forEach((line) => {
        if (line.trim().startsWith(`${key}=`)) {
            if (!replaced) result.push(formatted);
            replaced = true;
        } else {
            result.push(line);
        }
    });
    if (!replaced) result.push(formatted);
    return result;
};

const hostOf = (url) => {
    try {
        const parsed = new URL(url);
        return `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
    } catch {
        return null;
    }
};

/**
 * Foydalanuvchi joylashtirgan matndan ulanish manzilini ajratib olish.
 * "DATABASE_URL=..." yoki qo'shtirnoq bilan joylashtirilsa ham ishlaydi.
 */
const normalizeDatabaseUrl = (input) => {
    let value = unquote(input.trim().replace(/^DATABASE_URL\s*=\s*/, ''));
    if (!value) return '';
    if (!/^postgres(ql)?:\/\//.test(value)) {
        fail('Ulanish manzili "postgresql://" bilan boshlanishi kerak. Neon yoki Supabase dagi Connection string ni to\'liq nusxalang.');
    }
    // pg kutubxonasida "require" baribir "verify-full" sifatida ishlaydi; ogohlantirish chiqmasligi uchun
    value = value.replace(/sslmode=require\b/, 'sslmode=verify-full');
    return value;
};

const configureEnv = async () => {
    // Notepad ba'zan faylni ".env.txt" nomi bilan saqlaydi
    const notepadCopy = `${ENV_PATH}.txt`;
    if (!fs.existsSync(ENV_PATH) && fs.existsSync(notepadCopy)) {
        fs.renameSync(notepadCopy, ENV_PATH);
        console.log('   .env.txt fayli .env deb qayta nomlandi');
    }
    if (!fs.existsSync(ENV_PATH)) {
        fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
        console.log('   backend/.env yaratildi (.env.example asosida)');
    }

    let lines = readEnvLines();

    // JWT_SECRET: bo'sh yoki namunaviy bo'lsa avtomatik yaratiladi
    const secret = getEnv(lines, 'JWT_SECRET');
    if (secret === undefined || PLACEHOLDER_SECRETS.includes(secret)) {
        lines = setEnv(lines, 'JWT_SECRET', crypto.randomBytes(48).toString('hex'));
        console.log('   ✅ JWT_SECRET avtomatik yaratildi');
    } else {
        console.log('   ✅ JWT_SECRET mavjud');
    }

    // DATABASE_URL: buyruqda berilgan, joylashtirilgan yoki mavjud qiymat
    const current = getEnv(lines, 'DATABASE_URL');
    const fromArg = args.find((a) => a.startsWith('--db='));
    let databaseUrl = fromArg ? normalizeDatabaseUrl(fromArg.slice(5)) : '';

    if (!databaseUrl) {
        console.log(`   Hozirgi baza: ${current ? hostOf(current) || 'noto\'g\'ri format' : 'belgilanmagan'}`);
        console.log('   Neon (neon.tech) yoki Supabase dagi "Connection string" ni shu yerga joylashtiring.');
        console.log('   Kompyuterdagi PostgreSQL ishlatsangiz yoki hozirgisini qoldirmoqchi bo\'lsangiz - Enter bosing.');
        const answer = await ask('   DATABASE_URL: ');
        databaseUrl = normalizeDatabaseUrl(answer);
    }

    if (databaseUrl) {
        lines = setEnv(lines, 'DATABASE_URL', databaseUrl);
        console.log(`   ✅ DATABASE_URL saqlandi: ${hostOf(databaseUrl)}`);
    } else if (!current) {
        lines = setEnv(lines, 'DATABASE_URL', LOCAL_DB_URL);
        console.log(`   DATABASE_URL belgilanmagan, lokal PostgreSQL ishlatiladi: ${hostOf(LOCAL_DB_URL)}`);
    } else {
        console.log(`   ✅ Hozirgi DATABASE_URL qoldirildi: ${hostOf(current)}`);
    }

    fs.writeFileSync(ENV_PATH, `${lines.join('\n').replace(/\n+$/, '')}\n`);
};

// ---------- Asosiy jarayon ----------

const main = async () => {
    console.log('🏠 UyRemont - o\'rnatish va sozlash');

    const [major] = process.versions.node.split('.').map(Number);
    if (major < 18) fail(`Node.js 18 yoki undan yangi versiya kerak (hozirgi: ${process.versions.node})`);

    // Avval savollar (DATABASE_URL), keyin uzoq davom etadigan o'rnatish
    step(1, 'backend/.env sozlanmoqda...');
    await configureEnv();

    if (flag('--skip-install')) {
        step(2, 'Paketlarni o\'rnatish o\'tkazib yuborildi');
    } else {
        step(2, 'Paketlar o\'rnatilmoqda (backend va web, 1-3 daqiqa)...');
        if (!run('npm', ['install'], BACKEND)) fail('backend paketlarini o\'rnatib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.');
        if (!run('npm', ['install'], WEB)) fail('web paketlarini o\'rnatib bo\'lmadi. Internetni tekshirib, qayta urinib ko\'ring.');
    }

    step(3, flag('--no-seed') ? 'Ma\'lumotlar bazasi tayyorlanmoqda...' : 'Ma\'lumotlar bazasi tayyorlanmoqda (demo ma\'lumotlar bilan)...');
    const dbArgs = ['scripts/db-setup.js', ...(flag('--no-seed') ? [] : ['--seed'])];
    if (!run(process.execPath, dbArgs, BACKEND)) {
        fail('Bazani tayyorlab bo\'lmadi. Yuqoridagi xabarni o\'qing, DATABASE_URL ni tekshirib, "npm run setup -- --skip-install" ni qayta ishga tushiring.');
    }

    step(4, 'Tayyor! 🎉');
    console.log(`
   Ishga tushirish:   npm run dev
   Sayt:              http://localhost:3000
   API holati:        http://localhost:5000/api/health

   Kirish (SMS sozlanmagan - kod kirish oynasida ko'rsatiladi):
   - Administrator:   ${process.env.ADMIN_PHONE || '+998900000000'}
   - Demo usta:       +998901112233
   - Mijoz:           istalgan boshqa raqam
`);
};

main().catch((error) => fail(error.message));
