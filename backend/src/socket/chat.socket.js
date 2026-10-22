const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

const initChatSocket = (io) => {
    // Socket autentifikatsiya middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Avtorizatsiya tokeni kerak'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userRes = await query('SELECT id, phone, role, name, avatar_url FROM users WHERE id = $1 AND is_active = TRUE', [decoded.userId]);
            
            if (userRes.rows.length === 0) {
                return next(new Error('Foydalanuvchi topilmadi'));
            }

            socket.user = userRes.rows[0];
            next();
        } catch (err) {
            next(new Error('Autentifikatsiya xatosi: ' + err.message));
        }
    });

    io.on('connection', (socket) => {
        const currentUser = socket.user;
        console.log(`🔌 Foydalanuvchi ulandi: ${currentUser.name || currentUser.phone} (${socket.id})`);

        // Buyurtma bo'yicha chat xonasiga kirish
        socket.on('join_order_chat', async ({ order_id }) => {
            try {
                if (!order_id) return;

                // Foydalanuvchi buyurtma ishtirokchisi ekanligini tekshirish
                const orderRes = await query(
                    'SELECT client_id, master_id FROM orders WHERE id = $1',
                    [order_id]
                );

                if (orderRes.rows.length === 0) {
                    return socket.emit('error', { message: 'Buyurtma topilmadi' });
                }

                const order = orderRes.rows[0];
                if (order.client_id !== currentUser.id && order.master_id !== currentUser.id && currentUser.role !== 'admin') {
                    return socket.emit('error', { message: 'Ushbu chatga kirishga ruxsat yo\'q' });
                }

                const room = `order_${order_id}`;
                socket.join(room);
                console.log(`👤 ${currentUser.id} '${room}' xonasiga qo'shildi`);

                // Eski xabarlarni yuborish
                const messagesRes = await query(
                    `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
                     FROM messages m
                     JOIN users u ON m.sender_id = u.id
                     WHERE m.order_id = $1
                     ORDER BY m.created_at ASC`,
                    [order_id]
                );

                socket.emit('chat_history', { order_id, messages: messagesRes.rows });
            } catch (err) {
                console.error('Chat xatosi:', err.message);
                socket.emit('error', { message: 'Chatga ulanishda xatolik' });
            }
        });

        // Xabar yuborish
        socket.on('send_message', async ({ order_id, text }) => {
            try {
                if (!order_id || !text || !text.trim()) return;

                const messageId = uuidv4();
                const insertRes = await query(
                    `INSERT INTO messages (id, order_id, sender_id, text)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [messageId, order_id, currentUser.id, text.trim()]
                );

                const message = {
                    ...insertRes.rows[0],
                    sender_name: currentUser.name,
                    sender_avatar: currentUser.avatar_url
                };

                const room = `order_${order_id}`;
                io.to(room).emit('new_message', message);
            } catch (err) {
                console.error('Xabar yuborishda xatolik:', err.message);
                socket.emit('error', { message: 'Xabarni yuborib bo\'lmadi' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Foydalanuvchi uzildi: ${currentUser.id}`);
        });
    });
};

module.exports = { initChatSocket };
