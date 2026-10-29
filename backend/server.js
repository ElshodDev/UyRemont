require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const routes = require('./src/routes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimit');
const { initChatSocket } = require('./src/socket/chat.socket');
const { startDispatcher } = require('./src/services/dispatch.service');
const { UPLOAD_DIR } = require('./src/middleware/upload');
const { checkDatabase, describeTarget } = require('./src/config/database');
const { validateSecurityConfig } = require('./src/config/security');
const { isSmsConfigured } = require('./src/services/sms.service');

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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Yuklangan rasmlar (portfolio)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

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
    const security = validateSecurityConfig({ smsConfigured: isSmsConfigured() });
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
    });
}

module.exports = { app, server, io };
