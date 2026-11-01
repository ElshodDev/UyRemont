require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { apiLimiter, previewLimiter } = require('./src/middleware/rateLimit');
const { languageMiddleware } = require('./src/middleware/language');
const { getPublicMasterPage, getMasterOgImage, getGuidePage } = require('./src/controllers/og.controller');
const { initChatSocket } = require('./src/socket/chat.socket');
const { startDispatcher, stopDispatcher } = require('./src/services/dispatch.service');
const { UPLOAD_DIR } = require('./src/middleware/upload');
const { checkDatabase, describeTarget, pool } = require('./src/config/database');
const { validateSecurityConfig } = require('./src/config/security');
const { isSmsConfigured } = require('./src/services/sms.service');
const { startTelegramBot, stopTelegramBot, telegramWebhook } = require('./src/services/telegram/bot');
const { isTelegramConfigured } = require('./src/services/telegram/client');

const app = express();
const server = http.createServer(app);

// Ruxsat etilgan frontend manzillari (vergul bilan bir nechta berish mumkin)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

// Socket.io sozlash
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Controllerlar real-time hodisa yuborishi uchun
app.set('io', io);
// Qaysi proksi-serverlarning X-Forwarded-For sarlavhasiga ishonish (so'rovlar chegarasi uchun haqiqiy IP).
// Sukut bo'yicha faqat shu kompyuterdagi proksi (Vite, Nginx). To'g'ridan-to'g'ri internetga ochilganda
// ishonish shart emas, aks holda IP soxtalashtirilib, cheklovlardan o'tib ketish mumkin.
const trustProxy = process.env.TRUST_PROXY || 'loopback';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
// So'rov tili (Accept-Language) va javobdagi `message` tarjimasi. JSON tahlilidan oldin turadi:
// noto'g'ri JSON xatosi ham (errorHandler -> res.json) tanlangan tilda qaytadi
app.use(languageMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Yuklangan rasmlar (portfolio)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// Telegram webhook (production). Telegram serverlaridan keladi, umumiy so'rovlar cheklovidan oldin
app.post('/api/telegram/webhook', telegramWebhook);

// Ustaning ommaviy sahifasi va havola kartochkasi (Telegram/WhatsApp ko'rinishi uchun).
// Production'da proksi /u/* va /ustalar so'rovlarini shu yerga yuboradi (deploy/Caddyfile)
app.get('/u/:slug', previewLimiter, getPublicMasterPage);
app.get('/ustalar', previewLimiter, getGuidePage);
app.get('/api/masters/u/:slug/og.png', previewLimiter, getMasterOgImage);

// Asosiy API yo'nalishi
app.use('/api', apiLimiter, routes);

// Bosh sahifa
app.get('/', (req, res) => {
    res.json({
        name: 'UyRemont API',
        version: require('./package.json').version,
        status: 'online',
        docs: '/api/health'
    });
});

// Chat socketni ishga tushirish
initChatSocket(io);

// 404 va xatoliklarni ushlovchi middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    // Xavfli sozlamalar bilan server ishga tushmaydi
    const security = validateSecurityConfig({ smsConfigured: isSmsConfigured(), telegramConfigured: isTelegramConfigured() });
    security.warnings.forEach((warning) => console.warn(`⚠️ Xavfsizlik: ${warning}`));
    if (security.errors.length > 0) {
        security.errors.forEach((error) => console.error(`❌ Xavfsizlik: ${error}`));
        process.exit(1);
    }

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ ${PORT}-port band. Backend boshqa oynada allaqachon ishlayotgan bo'lishi mumkin - o'sha oynani yoping`);
            console.error('   yoki backend/.env da boshqa PORT belgilang (masalan PORT=5001).');
        } else {
            console.error('❌ Serverni ishga tushirib bo\'lmadi:', error.message);
        }
        process.exit(1);
    });

    server.listen(PORT, async () => {
        console.log(`🚀 UyRemont Backend Server ${PORT}-portda ishga tushdi`);
        console.log(`🔗 API manzili: http://localhost:${PORT}/api`);

        const db = await checkDatabase();
        if (!db.ok) {
            console.error(`❌ Ma'lumotlar bazasiga ulanib bo'lmadi (${describeTarget()}): ${db.message}`);
            console.error('   backend/.env dagi DATABASE_URL ni tekshiring yoki loyiha papkasida "npm run setup" ni ishga tushiring.');
        } else if (!db.schemaReady) {
            console.error(`⚠️ Baza ulandi (${describeTarget()}), lekin jadvallar yaratilmagan. backend papkasida "npm run db:seed" ni ishga tushiring.`);
        } else {
            console.log(`🗄️  Ma'lumotlar bazasi ulandi: ${describeTarget()}`);
        }

        startDispatcher(io);
        startTelegramBot();
    });

    // To'xtatish (Docker, systemd, Ctrl+C): yangi ulanishlar qabul qilinmaydi, boshlangan so'rovlar
    // tugatiladi, keyin baza ulanishlari yopiladi. 10 soniyada tugamasa majburan to'xtatiladi
    let shuttingDown = false;
    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`🛑 ${signal}: server to'xtatilmoqda...`);
        setTimeout(() => {
            console.error('⚠️ 10 soniyada to\'xtamadi, majburan yopildi');
            process.exit(1);
        }, 10000).unref();
        stopDispatcher();
        stopTelegramBot();
        // io.close() HTTP serverni ham yopadi
        io.close(() => {
            pool.end().catch(() => {}).finally(() => {
                console.log('👋 Server to\'xtadi');
                process.exit(0);
            });
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, server, io };
