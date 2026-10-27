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
const { UPLOAD_DIR } = require('./src/middleware/upload');

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
app.set('trust proxy', 1);

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
        version: '1.1.0',
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
    if (!process.env.JWT_SECRET) {
        console.error('❌ JWT_SECRET o\'rnatilmagan. backend/.env faylini tekshiring (.env.example ga qarang)');
        process.exit(1);
    }
    server.listen(PORT, () => {
        console.log(`🚀 UyRemont Backend Server ${PORT}-portda ishga tushdi`);
        console.log(`🔗 API manzili: http://localhost:${PORT}/api`);
    });
}

module.exports = { app, server, io };
