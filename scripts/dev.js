// =============================================
// UyRemont - backend va frontendni bitta oynada ishga tushirish
// Foydalanish (loyiha papkasida):
//   npm run dev         -> kompyuterda: http://localhost:3000
//   npm run dev:phone   -> telefondan sinash: HTTPS havola + QR kod (Cloudflare tunnel)
// To'xtatish: Ctrl + C
// =============================================

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const phoneMode = process.argv.includes('--phone');
const WEB_PORT = 3000;
let tunnel = null;

const SERVICES = [
    { name: 'backend', cwd: path.join(ROOT, 'backend'), color: '\x1b[36m' },
    { name: 'web', cwd: path.join(ROOT, 'web'), color: '\x1b[35m' },
];

const missing = SERVICES.filter((s) => !fs.existsSync(path.join(s.cwd, 'node_modules')));
if (missing.length > 0 || !fs.existsSync(path.join(ROOT, 'backend', '.env'))) {
    console.error('❌ Loyiha hali sozlanmagan. Avval shu buyruqni bajaring:  npm run setup');
    process.exit(1);
}

let shuttingDown = false;
const children = [];

/**
 * Bola jarayonlarni ularning ichidagi nodemon/vite bilan birga to'xtatish
 */
const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (tunnel) tunnel.stop();
    children.forEach((child) => {
        if (child.exitCode !== null) return;
        if (isWindows) {
            spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            try {
                process.kill(-child.pid, 'SIGTERM');
            } catch {
                child.kill('SIGTERM');
            }
        }
    });
    setTimeout(() => process.exit(code), 500);
};

const pipeWithPrefix = (stream, output, prefix) => {
    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        lines.forEach((line) => output.write(`${prefix}${line}\n`));
    });
    stream.on('end', () => {
        if (buffer) output.write(`${prefix}${buffer}\n`);
    });
};

SERVICES.forEach((service) => {
    const prefix = `${service.color}[${service.name}]\x1b[0m `;
    // Telefon rejimida sayt Wi-Fi tarmog'idagi boshqa qurilmalarga ham ochiladi
    const npmArgs = phoneMode && service.name === 'web' ? ['run', 'dev', '--', '--host'] : ['run', 'dev'];
    const child = spawn('npm', npmArgs, {
        cwd: service.cwd,
        shell: isWindows,
        detached: !isWindows,
        env: { ...process.env, FORCE_COLOR: '1' },
    });
    pipeWithPrefix(child.stdout, process.stdout, prefix);
    pipeWithPrefix(child.stderr, process.stderr, prefix);
    child.on('exit', (code) => {
        if (shuttingDown) return;
        console.error(`${prefix}to'xtadi (kod ${code}). Ikkinchi xizmat ham to'xtatilmoqda...`);
        shutdown(code || 1);
    });
    children.push(child);
});

console.log('🏠 UyRemont ishga tushmoqda: backend -> http://localhost:5000, sayt -> http://localhost:3000');
console.log('   To\'xtatish: Ctrl + C\n');

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => shutdown(0));

// ---------- Telefondan sinash ----------

const lanUrls = () => Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => `http://${net.address}:${WEB_PORT}`);

const printQr = (url) => {
    try {
        require('qrcode-terminal').generate(url, { small: true }, (qr) => console.log(qr));
    } catch {
        // QR kutubxonasi o'rnatilmagan bo'lsa faqat havola ko'rsatiladi
    }
};

const startTunnel = async () => {
    let cloudflared;
    try {
        cloudflared = require('cloudflared');
    } catch {
        console.error('❌ Telefon rejimi uchun paket topilmadi. Loyiha papkasida "npm install" ni bajaring.');
        return;
    }

    // cloudflared dasturi birinchi marta avtomatik yuklab olinadi
    if (!fs.existsSync(cloudflared.bin)) {
        console.log('📥 cloudflared yuklab olinmoqda (faqat birinchi marta, ~30 MB)...');
        try {
            await cloudflared.install(cloudflared.bin);
        } catch (error) {
            console.error(`❌ cloudflared ni yuklab bo'lmadi: ${error.message}`);
            return;
        }
    }

    console.log('🌐 Telefon uchun HTTPS havola tayyorlanmoqda...');
    tunnel = cloudflared.Tunnel.quick(`http://localhost:${WEB_PORT}`);
    tunnel.once('url', (url) => {
        const line = '='.repeat(64);
        console.log(`\n${line}`);
        console.log('📱 TELEFONDAN OCHISH (istalgan internet, GPS ham ishlaydi):');
        console.log(`\n   ${url}\n`);
        printQr(url);
        const lan = lanUrls();
        if (lan.length) {
            console.log('   Shu Wi-Fi tarmog\'ida tezroq variant (GPS ishlamaydi):');
            lan.forEach((u) => console.log(`   ${u}`));
        }
        console.log('   Havola har safar ishga tushirganda yangilanadi.');
        console.log(`${line}\n`);
    });
    tunnel.on('error', (error) => console.error('❌ Tunnel xatosi:', error.message));
    tunnel.on('exit', (code) => {
        if (!shuttingDown) console.error(`⚠️ Telefon havolasi to'xtadi (kod ${code}). "npm run dev:phone" ni qayta ishga tushiring.`);
    });
};

if (phoneMode) {
    // Sayt ishga tushishini kutib, keyin havola yaratish
    setTimeout(startTunnel, 4000);
}
