const { randomUUID: uuidv4 } = require('crypto');
const { query } = require('../config/database');
const { isUuid } = require('../utils/validators');
const { resolveUserFromToken } = require('../middleware/auth');
const { notifyChatMessage } = require('../services/telegram/notify');
const { translate, languageFromHeader } = require('../i18n');
const { joinLanguageRoom, socketLanguage } = require('./language');
const { maskContacts } = require('../utils/contacts');

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Foydalanuvchi buyurtma chatida qatnasha oladimi (mijoz, biriktirilgan usta yoki admin)
 */
const getChatAccess = async (orderId, user) => {
    if (!isUuid(orderId)) return { allowed: false, message: 'Buyurtma topilmadi' };

    const orderRes = await query(
        'SELECT client_id, master_id, accepted_at FROM orders WHERE id = $1',
        [orderId]
    );
    if (orderRes.rows.length === 0) return { allowed: false, message: 'Buyurtma topilmadi' };

    const order = orderRes.rows[0];
    const allowed = order.client_id === user.id || order.master_id === user.id || user.role === 'admin';
    // Usta qabul qilmaguncha raqamlar ko'rinmaydi: chatda yozilgan raqam ham yashiriladi
    return { allowed, accepted: Boolean(order.accepted_at), message: allowed ? null : 'Ushbu chatga kirishga ruxsat yo\'q' };
};

const initChatSocket = (io) => {
    // Socket autentifikatsiya middleware
    io.use(async (socket, next) => {
        // Ulanish xatosi tili: auth.lang yoki Accept-Language (foydalanuvchi hali noma'lum)
        const fail = (message) => next(new Error(translate(
            languageFromHeader(socket.handshake.auth?.lang || socket.handshake.headers?.['accept-language']),
            message
        )));
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                return fail('Avtorizatsiya tokeni kerak');
            }

            // HTTP so'rovlardagi kabi: token versiyasi, bloklash va o'chirilgan hisob tekshiriladi
            const { user } = await resolveUserFromToken(token);
            if (!user) return fail('Autentifikatsiya xatosi');

            socket.user = user;
            socket.data.userId = user.id;
            next();
        } catch (err) {
            fail('Autentifikatsiya xatosi');
        }
    });

    io.on('connection', (socket) => {
        const currentUser = socket.user;
        // Xatolar ulanishning joriy tilida (til almashtirilsa xona ham almashadi)
        const chatError = (message) => socket.emit('chat_error', { message: translate(socketLanguage(socket), message) });

        // Shaxsiy xona: takliflar, buyurtma holati va usta joylashuvi shu yerga yuboriladi
        socket.join(`user_${currentUser.id}`);
        // Til xonasi: matnli hodisalar foydalanuvchi tilida keladi (socket/language.js)
        joinLanguageRoom(socket, currentUser.language);

        // Buyurtma bo'yicha chat xonasiga kirish
        socket.on('join_order_chat', async ({ order_id } = {}) => {
            try {
                const access = await getChatAccess(order_id, currentUser);
                if (!access.allowed) {
                    return chatError(access.message);
                }

                const room = `order_${order_id}`;
                socket.join(room);

                // Eski xabarlarni yuborish
                const messagesRes = await query(
                    `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
                     FROM messages m
                     JOIN users u ON m.sender_id = u.id
                     WHERE m.order_id = $1
                     ORDER BY m.created_at ASC`,
                    [order_id]
                );

                // Boshqa tomon yuborgan xabarlarni o'qilgan deb belgilash
                await query(
                    'UPDATE messages SET is_read = TRUE WHERE order_id = $1 AND sender_id <> $2 AND is_read = FALSE',
                    [order_id, currentUser.id]
                );

                socket.emit('chat_history', { order_id, messages: messagesRes.rows });
            } catch (err) {
                console.error('Chat xatosi:', err.message);
                chatError('Chatga ulanishda xatolik');
            }
        });

        socket.on('leave_order_chat', ({ order_id } = {}) => {
            if (isUuid(order_id)) socket.leave(`order_${order_id}`);
        });

        // Xabar yuborish
        socket.on('send_message', async ({ order_id, text } = {}) => {
            try {
                if (typeof text !== 'string' || !text.trim()) return;
                if (text.length > MAX_MESSAGE_LENGTH) {
                    return chatError(`Xabar ${MAX_MESSAGE_LENGTH} belgidan oshmasligi kerak`);
                }

                // Har bir xabarda ishtirokchilikni qayta tekshirish
                const access = await getChatAccess(order_id, currentUser);
                if (!access.allowed) {
                    return chatError(access.message);
                }

                const original = text.trim();
                const safeText = access.accepted ? original : maskContacts(original);
                const insertRes = await query(
                    `INSERT INTO messages (id, order_id, sender_id, text)
                     VALUES ($1, $2, $3, $4)
                     RETURNING *`,
                    [uuidv4(), order_id, currentUser.id, safeText]
                );
                if (safeText !== original) {
                    chatError('Raqam yashirildi: telefon raqamlar usta buyurtmani qabul qilgach ikki tomonga ham ko\'rinadi');
                }

                const message = {
                    ...insertRes.rows[0],
                    sender_name: currentUser.name,
                    sender_avatar: currentUser.avatar_url
                };

                io.to(`order_${order_id}`).emit('new_message', message);
                // Qabul qiluvchi saytda bo'lmasa Telegram orqali xabar
                notifyChatMessage({ io, orderId: order_id, senderId: currentUser.id, senderName: currentUser.name, text: message.text });
            } catch (err) {
                console.error('Xabar yuborishda xatolik:', err.message);
                chatError('Xabarni yuborib bo\'lmadi');
            }
        });
    });
};

module.exports = { initChatSocket };
