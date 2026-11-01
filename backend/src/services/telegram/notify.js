// =============================================
// UyRemont - Telegram bildirishnomalari
// Usta takliflarni ilova yopiq bo'lsa ham oladi va shu yerning o'zida qabul qiladi;
// mijoz buyurtma bosqichlari haqida xabar oladi. Barcha funksiyalar xatoni o'zi ushlaydi
// (Telegram ishlamasa ham asosiy jarayon to'xtamaydi).
// =============================================

const { query } = require('../../config/database');
const config = require('../../config/dispatch');
const {
    isTelegramConfigured, sendMessage, editMessage, escapeHtml, urlButton, keyboard,
} = require('./client');

const CHAT_NOTIFY_COOLDOWN_MS = 2 * 60 * 1000;
const chatNotifiedAt = new Map();

const money = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? `${Math.round(num).toLocaleString('ru-RU')} so'm` : 'kelishiladi';
};

const navigationUrl = (lat, lng) => `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;

const logError = (label) => (error) => {
    console.error(`⚠️ Telegram (${label}):`, error.message);
};

/**
 * Xabar olishga rozi bo'lgan, faol foydalanuvchining Telegram chati
 */
const chatForUser = async (userId) => {
    if (!userId || !isTelegramConfigured()) return null;
    const result = await query(
        `SELECT t.chat_id FROM telegram_links t JOIN users u ON u.id = t.user_id
         WHERE t.user_id = $1 AND t.notifications = TRUE AND u.is_active = TRUE AND u.deleted_at IS NULL`,
        [userId]
    );
    return result.rows[0]?.chat_id || null;
};

const notifyUser = async (userId, text, replyMarkup) => {
    const chatId = await chatForUser(userId);
    if (!chatId) return null;
    return sendMessage(chatId, text, { replyMarkup });
};

// ---------- Ustaga taklif ----------

const offerText = (offer) => {
    const lines = [
        `🔔 <b>Yangi buyurtma</b> · ${offer.timeout_sec || 20} soniya ichida javob bering`,
        '',
        `${escapeHtml(offer.specialization_icon || '🛠')} <b>${escapeHtml(offer.title)}</b>`,
    ];
    if (offer.description) lines.push(`📝 ${escapeHtml(offer.description.slice(0, 300))}`);
    lines.push(`📍 ${escapeHtml([offer.district, offer.address].filter(Boolean).join(', '))}`);
    lines.push(`🚗 ${Number(offer.distance_km).toFixed(1)} km · ~${offer.eta_min} daqiqa`);
    lines.push(`💰 Chiqish narxi: ${money(offer.call_fee)}`);
    if (offer.photos?.length) lines.push(`📷 Rasm: ${offer.photos.length} ta (saytda ko'ring)`);
    lines.push(`👤 Mijoz: ${escapeHtml(offer.client_name)} · ⭐ ${Number(offer.client_rating || 5).toFixed(1)}`);
    return lines.join('\n');
};

/**
 * Taklifni ustaga Telegram orqali yuborish ("Qabul qilish" / "Rad etish" tugmalari bilan)
 */
const notifyOffer = (masterId, offer) => (async () => {
    const chatId = await chatForUser(masterId);
    if (!chatId) return;
    const message = await sendMessage(chatId, offerText(offer), {
        replyMarkup: keyboard([
            [
                { text: '✅ Qabul qilish', callback_data: `o:${offer.offer_id}:a` },
                { text: '❌ Rad etish', callback_data: `o:${offer.offer_id}:d` },
            ],
        ]),
    });
    await query(
        'UPDATE dispatch_offers SET telegram_chat_id = $2, telegram_message_id = $3 WHERE id = $1',
        [offer.offer_id, chatId, message.message_id]
    );
})().catch(logError('taklif'));

const OFFER_RESULT = {
    accepted: '✅ <b>Qabul qildingiz</b>',
    declined: '❌ Rad etildi',
    expired: '⌛ Taklif muddati tugadi',
    cancelled: '🚫 Mijoz bekor qildi yoki buyurtma boshqa ustaga o\'tdi',
};

/**
 * Taklif yopilgach Telegram'dagi xabarni yangilash (eskirgan tugmalar qolmasligi uchun)
 */
const syncOfferMessage = (offerId) => (async () => {
    if (!isTelegramConfigured()) return;
    const result = await query(
        `SELECT d.status, d.telegram_chat_id, d.telegram_message_id,
                o.id as order_id, o.title, o.address, o.district, o.lat, o.lng
         FROM dispatch_offers d JOIN orders o ON o.id = d.order_id
         WHERE d.id = $1`,
        [offerId]
    );
    const offer = result.rows[0];
    if (!offer || !offer.telegram_message_id || offer.status === 'pending') return;

    const lines = [`${OFFER_RESULT[offer.status] || OFFER_RESULT.cancelled}: ${escapeHtml(offer.title)}`];
    let replyMarkup;
    if (offer.status === 'accepted') {
        lines.push(`📍 ${escapeHtml([offer.district, offer.address].filter(Boolean).join(', '))}`);
        lines.push('Mijoz manziliga yo\'l oling. Yetib kelgach saytda «Yetib keldim» ni bosing.');
        replyMarkup = keyboard([[
            offer.lat && offer.lng ? urlButton('🧭 Yo\'l ko\'rsatish', navigationUrl(offer.lat, offer.lng)) : null,
            urlButton('📋 Buyurtmani ochish', `/orders/${offer.order_id}`),
        ]]);
    }
    await editMessage(offer.telegram_chat_id, offer.telegram_message_id, lines.join('\n'), { replyMarkup });
})().catch(logError('taklifni yangilash'));

// ---------- Buyurtma bosqichlari ----------

const loadOrder = async (orderId) => {
    const result = await query(
        `SELECT o.*, c.name as client_name, m.name as master_name, s.name_uz as specialization_name,
                (SELECT distance_km FROM dispatch_offers d WHERE d.order_id = o.id AND d.status = 'accepted'
                 ORDER BY d.responded_at DESC LIMIT 1) as accepted_distance_km
         FROM orders o
         LEFT JOIN users c ON c.id = o.client_id
         LEFT JOIN users m ON m.id = o.master_id
         LEFT JOIN specializations s ON s.id = o.specialization_id
         WHERE o.id = $1`,
        [orderId]
    );
    return result.rows[0] || null;
};

/**
 * Holat o'zgarganda kimga qanday xabar boradi. actor - amalni bajargan tomon (unga xabar yuborilmaydi).
 */
const orderMessages = (order, actor) => {
    const title = escapeHtml(order.title);
    const master = escapeHtml(order.master_name || 'Usta');
    const open = urlButton('📋 Buyurtmani ochish', `/orders/${order.id}`);
    const messages = [];
    const to = (role, text, buttons = [open]) => {
        const userId = role === 'client' ? order.client_id : order.master_id;
        if (userId && actor !== role) messages.push({ userId, text, replyMarkup: keyboard([buttons]) });
    };

    switch (order.status) {
        case 'accepted':
            if (order.mode === 'instant') {
                const eta = order.accepted_distance_km
                    ? ` Taxminan ${Math.max(3, Math.round((Number(order.accepted_distance_km) / config.CITY_SPEED_KMH) * 60))} daqiqada yetib keladi.`
                    : '';
                to('client', `🚗 <b>Usta topildi!</b>\n${master} yo'lga chiqdi.${eta}\n${title}`, [urlButton('🗺 Xaritada kuzatish', `/orders/${order.id}`)]);
            } else {
                to('client', `✅ ${master} buyurtmangizni qabul qildi:\n<b>${title}</b>`);
            }
            break;
        case 'arrived':
            to('client', `📍 <b>Usta yetib keldi</b>: ${master}\n${title}`);
            break;
        case 'in_progress':
            to('client', `🔧 Ish boshlandi: <b>${title}</b>`);
            break;
        case 'completed':
            to('client', `🎉 <b>Ish yakunlandi</b>: ${title}${order.final_price ? `\n💰 Summa: ${money(order.final_price)}` : ''}\nUstani baholang — bu boshqa mijozlarga yordam beradi.`, [urlButton('⭐ Baholash', `/orders/${order.id}`)]);
            to('master', `✅ Buyurtma yakunlandi: <b>${title}</b>`);
            break;
        case 'cancelled': {
            const reason = order.cancel_reason ? `\nSabab: ${escapeHtml(order.cancel_reason)}` : '';
            to('client', `❌ Buyurtma bekor qilindi: <b>${title}</b>${reason}`);
            to('master', `❌ Buyurtma bekor qilindi: <b>${title}</b>${reason}`);
            break;
        }
        case 'expired':
            to('client', `😔 Afsuski, yaqin atrofda bo'sh usta topilmadi: <b>${title}</b>\nBirozdan so'ng qayta urinib ko'ring yoki oddiy buyurtma qoldiring.`, [urlButton('⚡ Qayta chaqirish', '/call')]);
            break;
        case 'searching':
            to('client', `🔄 Usta buyurtmadan voz kechdi. Yangi usta qidirilmoqda: <b>${title}</b>`);
            break;
        default:
            break;
    }
    return messages;
};

// Tezkor chaqiruvda bosqichlarni faqat usta o'tkazadi
const inferActor = (order) => (order.mode === 'instant'
    && ['accepted', 'arrived', 'in_progress', 'completed'].includes(order.status) ? 'master' : null);

/**
 * Buyurtma holati o'zgarganda tomonlarga xabar
 * @param {object} order - orders qatori
 * @param {{ actor?: string, cancelled_by?: string }} extra
 */
const notifyOrderEvent = (order, extra = {}) => (async () => {
    if (!isTelegramConfigured() || !order?.id) return;
    const full = await loadOrder(order.id);
    if (!full) return;
    const actor = extra.actor || extra.cancelled_by || inferActor(full);
    for (const message of orderMessages(full, actor)) {
        await notifyUser(message.userId, message.text, message.replyMarkup);
    }
})().catch(logError('buyurtma holati'));

/**
 * Mijoz aniq ustaga buyurtma berganda ustaga xabar
 */
const notifyNewOrderForMaster = (order) => (async () => {
    if (!order?.master_id) return;
    const lines = [
        `📋 <b>Sizga yangi buyurtma</b>`,
        `<b>${escapeHtml(order.title)}</b>`,
        order.description ? `📝 ${escapeHtml(order.description.slice(0, 300))}` : null,
        order.district ? `📍 ${escapeHtml(order.district)}` : null,
        `💰 Byudjet: ${money(order.budget)}`,
        order.photos?.length ? `📷 Rasm: ${order.photos.length} ta` : null,
    ].filter(Boolean);
    await notifyUser(order.master_id, lines.join('\n'), keyboard([[urlButton('📋 Ko\'rish va qabul qilish', `/orders/${order.id}`)]]));
})().catch(logError('yangi buyurtma'));

/**
 * Chatdagi yangi xabar: qabul qiluvchi saytda bo'lmasa Telegram'ga (har buyurtma uchun 2 daqiqada bir marta)
 */
const notifyChatMessage = ({ io, orderId, senderId, senderName, text }) => (async () => {
    if (!isTelegramConfigured()) return;
    const order = await query('SELECT client_id, master_id, title FROM orders WHERE id = $1', [orderId]);
    const row = order.rows[0];
    if (!row) return;
    const recipientId = row.client_id === senderId ? row.master_id : row.client_id;
    if (!recipientId) return;

    const key = `${orderId}:${recipientId}`;
    if (Date.now() - (chatNotifiedAt.get(key) || 0) < CHAT_NOTIFY_COOLDOWN_MS) return;
    if (io && (await io.in(`user_${recipientId}`).fetchSockets()).length > 0) return;

    chatNotifiedAt.set(key, Date.now());
    if (chatNotifiedAt.size > 5000) chatNotifiedAt.clear();
    const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    await notifyUser(
        recipientId,
        `💬 <b>${escapeHtml(senderName || 'Yangi xabar')}</b> · ${escapeHtml(row.title)}\n${escapeHtml(preview)}`,
        keyboard([[urlButton('↩️ Javob berish', `/orders/${orderId}`)]])
    );
})().catch(logError('chat'));

module.exports = {
    notifyOffer,
    syncOfferMessage,
    notifyOrderEvent,
    notifyNewOrderForMaster,
    notifyChatMessage,
    orderMessages,
};
