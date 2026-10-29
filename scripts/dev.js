// =============================================
// UyRemont - backend va frontendni bitta oynada ishga tushirish
// Foydalanish (loyiha papkasida): npm run dev   |   to'xtatish: Ctrl + C
// =============================================

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

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
    const child = spawn('npm', ['run', 'dev'], {
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
