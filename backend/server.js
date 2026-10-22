require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const { initChatSocket } = require('./src/socket/chat.socket');

const app = express();
const server = http.createServer(app);

// Socket.io sozlash
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Asosiy API yo'nalishi
app.use('/api', routes);

// Bosh sahifa
app.get('/', (req, res) => {
    res.json({
        name: 'UyRemont API',
        version: '1.0.0',
        status: 'online',
        docs: '/api/health'
    });
});

// Chat socketni ishga tushirish
initChatSocket(io);

// Xatoliklarni ushlovchi middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🚀 UyRemont Backend Server ${PORT}-portda ishga tushdi`);
    console.log(`🔗 API manzili: http://localhost:${PORT}/api`);
});
