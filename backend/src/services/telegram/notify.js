// =============================================
// UyRemont - Telegram bildirishnomalari
// Usta takliflarni ilova yopiq bo'lsa ham oladi va shu yerning o'zida qabul qiladi;
// mijoz buyurtma bosqichlari haqida xabar oladi. Barcha funksiyalar xatoni o'zi ushlaydi
// (Telegram ishlamasa ham asosiy jarayon to'xtamaydi).
// Matnlar qabul qiluvchining tilida (users.language): andoza avval tarjima qilinadi, keyin unga
// escapeHtml qilingan qiymatlar qo'yiladi.
// =============================================

const { query } = require('../../config/database');
const config = require('../../config/dispatch');
const { tr, phrase, normalizeLanguage, DEFAULT_LANGUAGE } = require('../../i18n');
const {
    isTelegramConfigured, sendMessage, editMessage, escapeHtml, urlButton, keyboard,
} = require('./client');

const CHAT_NOTIFY_COOLDOWN_MS = 2 * 60 * 1000;
const chatNotifiedAt = new Map();

const money = (value, lang) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0
        ? tr(lang, '{sum} so\'m', { sum: Math.round(num).toLocaleString('ru-RU') })
        : tr(lang, 'kelishiladi');
};

/**
 * Tezkor chaqiruvning avtomatik sarlavhasi ("Santexnik chaqiruvi") boshqa tilda mutaxassislik nomi bilan
 * (specializations.name_ru). Mijoz yozgan sarlavha o'zgarmaydi.
 */
const orderTitle = (order, lang) => {
    if (lang !== DEFAULT_LANGUAGE && order.specialization_name && order.specialization_name_ru
        && order.title === `${order.specialization_name} chaqiruvi`) {
        return tr(lang, '{spec} chaqiruvi', { spec: order.specialization_name_ru });
    }
    return order.title;
};

const navigationUrl = (lat, lng) => `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;

const logError = (label) => (error) => {
    console.error(`⚠️ Telegram (${label}):`, error.message);
};

/**
 * Xabar olishga rozi bo'lgan, faol foydalanuvchining Telegram chati va tili (bitta so'rov)
 * @returns {Promise<{ chatId: string, lang: 'uz'|'ru' }|null>}
 */
const recipientFor = async (userId) => {
    if (!userId || !isTelegramConfigured()) return null;
    const result = await query(
        `SELECT t.chat_id, u.language FROM telegram_links t JOIN users u ON u.id = t.user_id
         WHERE t.user_id = $1 AND t.notifications = TRUE AND u.is_active = TRUE AND u.deleted_at IS NULL`,
        [userId]
    );
    const row = result.rows[0];
    return row ? { chatId: row.chat_id, lang: normalizeLanguage(row.language) } : null;
};

/**
 * Foydalanuvchiga xabar. text va replyMarkup qiymat yoki (lang) => qiymat (qabul qiluvchining tilida tuziladi)
 */
const notifyUser = async (userId, text, replyMarkup) => {
    const recipient = await recipientFor(userId);
    if (!recipient) return null;
    const resolve = (value) => (typeof value === 'function' ? value(recipient.lang) : value);
    return sendMessage(recipient.chatId, resolve(text), { replyMarkup: resolve(replyMarkup) });
};

// ---------- Ustaga taklif ----------

const offerText = (offer, lang) => {
    const clientName = offer.client_name === 'Mijoz' ? tr(lang, 'Mijoz') : offer.client_name;
    const lines = [
        tr(lang, '🔔 <b>Yangi buyurtma</b> · {sec} soniya ichida javob bering', { sec: offer.timeout_sec || 20 }),
        '',
        `${escapeHtml(offer.specialization_icon || '🛠')} <b>${escapeHtml(orderTitle(offer, lang))}</b>`,
    ];
    if (offer.description) lines.push(`📝 ${escapeHtml(offer.description.slice(0, 300))}`);
    lines.push(`📍 ${escapeHtml([offer.district, offer.address].filter(Boolean).join(', '))}`);
    lines.push(tr(lang, '🚗 {km} km · ~{eta} daqiqa', { km: Number(offer.distance_km).toFixed(1), eta: offer.eta_min }));
    lines.push(tr(lang, '💰 Chiqish narxi: {fee}', { fee: money(offer.call_fee, lang) }));
    if (offer.photos?.length) lines.push(tr(lang, '📷 Rasm: {n} ta (saytda ko\'ring)', { n: offer.photos.length }));
    lines.push(tr(lang, '👤 Mijoz: {name} · ⭐ {rating}', {
        name: escapeHtml(clientName),
        rating: Number(offer.client_rating || 5).toFixed(1),
    }));
    return lines.join('\n');
};

/**
 * Taklifni ustaga Telegram orqali yuborish ("Qabul qilish" / "Rad etish" tugmalari bilan)
 */
const notifyOffer = (masterId, offer) => (async () => {
    const recipient = await recipientFor(masterId);
    if (!recipient) return;
    const { chatId, lang } = recipient;
    const message = await sendMessage(chatId, offerText(offer, lang), {
        replyMarkup: keyboard([
            [
                { text: tr(lang, '✅ Qabul qilish'), callback_data: `o:${offer.offer_id}:a` },
                { text: tr(lang, '❌ Rad etish'), callback_data: `o:${offer.offer_id}:d` },
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
        `SELECT d.status, d.telegram_chat_id, d.telegram_message_id, u.language,
                o.id as order_id, o.title, o.address, o.district, o.lat, o.lng,
                s.name_uz as specialization_name, s.name_ru as specialization_name_ru
         FROM dispatch_offers d
         JOIN orders o ON o.id = d.order_id
         JOIN users u ON u.id = d.master_id
         LEFT JOIN specializations s ON s.id = o.specialization_id
         WHERE d.id = $1`,
        [offerId]
    );
    const offer = result.rows[0];
    if (!offer || !offer.telegram_message_id || offer.status === 'pending') return;
    const lang = normalizeLanguage(offer.language);

    const lines = [`${tr(lang, OFFER_RESULT[offer.status] || OFFER_RESULT.cancelled)}: ${escapeHtml(orderTitle(offer, lang))}`];
    let replyMarkup;
    if (offer.status === 'accepted') {
        lines.push(`📍 ${escapeHtml([offer.district, offer.address].filter(Boolean).join(', '))}`);
        lines.push(tr(lang, 'Mijoz manziliga yo\'l oling. Yetib kelgach saytda «Yetib keldim» ni bosing.'));
        replyMarkup = keyboard([[
            offer.lat && offer.lng ? urlButton(tr(lang, '🧭 Yo\'l ko\'rsatish'), navigationUrl(offer.lat, offer.lng)) : null,
            urlButton(tr(lang, '📋 Buyurtmani ochish'), `/orders/${offer.order_id}`),
        ]]);
    }
    await editMessage(offer.telegram_chat_id, offer.telegram_message_id, lines.join('\n'), { replyMarkup });
})().catch(logError('taklifni yangilash'));

// ---------- Buyurtma bosqichlari ----------

const loadOrder = async (orderId) => {
    const result = await query(
        `SELECT o.*, c.name as client_name, m.name as master_name,
                s.name_uz as specialization_name, s.name_ru as specialization_name_ru,
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

// Tezkor chaqiruv yakunlanganda mijozdan to'langan summa so'raladi (bir tugma bilan tasdiqlash)
const paymentQuestion = (order) => order.mode === 'instant' && Number(order.final_price) > 0 && !order.payment_confirmed_at;

const paymentButtons = (order, lang) => [
    [{ text: tr(lang, '✅ Ha, {sum} to\'ladim', { sum: money(order.final_price, lang) }), callback_data: `p:${order.id}:ok` }],
    [
        urlButton(tr(lang, '✏️ Boshqa summa'), `/orders/${order.id}#tolov`),
        urlButton(tr(lang, '⭐ Baholash'), `/orders/${order.id}`),
    ],
];

/**
 * Holat o'zgarganda kimga qanday xabar boradi. actor - amalni bajargan tomon (unga xabar yuborilmaydi).
 * text va replyMarkup - (lang) => qiymat: har bir qabul qiluvchi o'z tilida oladi.
 */
const orderMessages = (order, actor) => {
    const messages = [];
    const open = (lang) => urlButton(tr(lang, '📋 Buyurtmani ochish'), `/orders/${order.id}`);
    const to = (role, text, buttons = (lang) => [open(lang)]) => {
        const userId = role === 'client' ? order.client_id : order.master_id;
        // buttons(lang): bitta qator tugmalar yoki qatorlar ro'yxati
        const rows = (lang) => {
            const value = buttons(lang);
            return Array.isArray(value[0]) ? value : [value];
        };
        if (userId && actor !== role) messages.push({ userId, text, replyMarkup: (lang) => keyboard(rows(lang)) });
    };
    const names = (lang) => ({
        title: escapeHtml(orderTitle(order, lang)),
        master: escapeHtml(order.master_name || tr(lang, 'Usta')),
    });

    switch (order.status) {
        case 'accepted':
            if (order.mode === 'instant') {
                const etaMin = order.accepted_distance_km
                    ? Math.max(3, Math.round((Number(order.accepted_distance_km) / config.CITY_SPEED_KMH) * 60))
                    : null;
                to('client', (lang) => (etaMin
                    ? tr(lang, '🚗 <b>Usta topildi!</b>\n{master} yo\'lga chiqdi. Taxminan {n} daqiqada yetib keladi.\n{title}', { ...names(lang), n: etaMin })
                    : tr(lang, '🚗 <b>Usta topildi!</b>\n{master} yo\'lga chiqdi.\n{title}', names(lang))),
                (lang) => [urlButton(tr(lang, '🗺 Xaritada kuzatish'), `/orders/${order.id}`)]);
            } else {
                to('client', (lang) => tr(lang, '✅ {master} buyurtmangizni qabul qildi:\n<b>{title}</b>', names(lang)));
            }
            break;
        case 'arrived':
            to('client', (lang) => tr(lang, '📍 <b>Usta yetib keldi</b>: {master}\n{title}', names(lang)));
            break;
        case 'in_progress':
            to('client', (lang) => tr(lang, '🔧 Ish boshlandi: <b>{title}</b>', names(lang)));
            break;
        case 'completed':
            to('client', (lang) => {
                const lines = [tr(lang, '🎉 <b>Ish yakunlandi</b>: {title}', names(lang))];
                if (order.final_price) {
                    lines.push(Number(order.materials_price) > 0
                        ? tr(lang, '💰 Summa: {sum} (ish haqi {labor} + material {materials})', {
                            sum: money(order.final_price, lang),
                            labor: money(order.labor_price, lang),
                            materials: money(order.materials_price, lang),
                        })
                        : tr(lang, '💰 Summa: {sum}', { sum: money(order.final_price, lang) }));
                }
                lines.push(paymentQuestion(order)
                    ? tr(lang, 'Ustaga shuncha to\'ladingizmi? Tasdiqlang va ustani baholang.')
                    : tr(lang, 'Ustani baholang — bu boshqa mijozlarga yordam beradi.'));
                return lines.join('\n');
            }, (lang) => (paymentQuestion(order)
                ? paymentButtons(order, lang)
                : [urlButton(tr(lang, '⭐ Baholash'), `/orders/${order.id}`)]));
            to('master', (lang) => tr(lang, '✅ Buyurtma yakunlandi: <b>{title}</b>', names(lang)));
            break;
        case 'cancelled': {
            // Saytda tanlangan tayyor sabablar tarjima qilinadi, o'zi yozgan sabab o'zgarmaydi
            const cancelled = (lang) => [
                tr(lang, '❌ Buyurtma bekor qilindi: <b>{title}</b>', names(lang)),
                order.cancel_reason ? tr(lang, 'Sabab: {reason}', { reason: escapeHtml(phrase(lang, order.cancel_reason)) }) : null,
            ].filter(Boolean).join('\n');
            to('client', cancelled);
            to('master', cancelled);
            break;
        }
        case 'expired':
            to('client', (lang) => tr(
                lang,
                '😔 Afsuski, yaqin atrofda bo\'sh usta topilmadi: <b>{title}</b>\nBirozdan so\'ng qayta urinib ko\'ring yoki oddiy buyurtma qoldiring.',
                names(lang)
            ), (lang) => [urlButton(tr(lang, '⚡ Qayta chaqirish'), '/call')]);
            break;
        case 'searching':
            to('client', (lang) => tr(lang, '🔄 Usta buyurtmadan voz kechdi. Yangi usta qidirilmoqda: <b>{title}</b>', names(lang)));
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
    await notifyUser(
        order.master_id,
        (lang) => [
            tr(lang, '📋 <b>Sizga yangi buyurtma</b>'),
            `<b>${escapeHtml(order.title)}</b>`,
            order.description ? `📝 ${escapeHtml(order.description.slice(0, 300))}` : null,
            order.district ? `📍 ${escapeHtml(order.district)}` : null,
            tr(lang, '💰 Byudjet: {sum}', { sum: money(order.budget, lang) }),
            order.photos?.length ? tr(lang, '📷 Rasm: {n} ta', { n: order.photos.length }) : null,
        ].filter(Boolean).join('\n'),
        (lang) => keyboard([[urlButton(tr(lang, '📋 Ko\'rish va qabul qilish'), `/orders/${order.id}`)]])
    );
})().catch(logError('yangi buyurtma'));

/**
 * Chatdagi yangi xabar: qabul qiluvchi saytda bo'lmasa Telegram'ga (har buyurtma uchun 2 daqiqada bir marta)
 */
const notifyChatMessage = ({ io, orderId, senderId, senderName, text }) => (async () => {
    if (!isTelegramConfigured()) return;
    const order = await query(
        `SELECT o.client_id, o.master_id, o.title, s.name_uz as specialization_name, s.name_ru as specialization_name_ru
         FROM orders o LEFT JOIN specializations s ON s.id = o.specialization_id
         WHERE o.id = $1`,
        [orderId]
    );
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
        (lang) => `💬 <b>${escapeHtml(senderName || tr(lang, 'Yangi xabar'))}</b> · ${escapeHtml(orderTitle(row, lang))}\n${escapeHtml(preview)}`,
        (lang) => keyboard([[urlButton(tr(lang, '↩️ Javob berish'), `/orders/${orderId}`)]])
    );
})().catch(logError('chat'));

module.exports = {
    notifyUser,
    notifyOffer,
    syncOfferMessage,
    notifyOrderEvent,
    notifyNewOrderForMaster,
    notifyChatMessage,
    orderMessages,
    orderTitle,
    OFFER_RESULT,
};
