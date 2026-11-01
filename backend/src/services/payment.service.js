// =============================================
// UyRemont - Mijoz to'langan summani tasdiqlaydi (tezkor chaqiruv yakunlangach).
// Usta yakuniy summani kam yozsa (komissiya kamroq bo'lishi uchun), mijozning javobi farqni ko'rsatadi:
// buyurtma admin tekshiruviga tushadi va admin farqdan komissiya yozishi mumkin.
// =============================================

const { withTransaction } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');

// Yaxlitlash farqi hisobga olinmaydi: kamida 5 000 so'm va yakuniy summaning 5 foizidan ko'p farq
const TOLERANCE_MIN = 5000;
const TOLERANCE_PERCENT = 5;
const MAX_AMOUNT = 1000000000;

const PRIVATE_FIELDS = ['client_paid_amount', 'payment_review', 'payment_reviewed_at', 'payment_reviewed_by'];

/**
 * Mijoz aytgan summa ustaning yozganidan sezilarli ko'pmi
 */
const isUnderreported = (statedPrice, paidAmount) => {
    const stated = Number(statedPrice) || 0;
    return Number(paidAmount) - stated > Math.max(TOLERANCE_MIN, (stated * TOLERANCE_PERCENT) / 100);
};

const awaitsConfirmation = (order) => order.mode === 'instant'
    && order.status === 'completed'
    && order.final_price !== null && order.final_price !== undefined
    && !order.payment_confirmed_at;

/**
 * Buyurtmani foydalanuvchiga qaytarishdan oldin: mijoz aytgan summa va tekshiruv holati
 * faqat mijoz va adminga ko'rinadi. Ustaga faqat "mijoz tasdiqladi" belgisi (summa mos kelgan bo'lsa)
 * @param {object} order - orders qatori
 * @param {{ id: string, role: string }} user
 */
const paymentView = (order, user) => {
    if (!order) return order;
    const isClient = order.client_id === user.id;
    if (user.role === 'admin' || isClient) {
        return { ...order, can_confirm_payment: isClient && awaitsConfirmation(order) };
    }
    const view = { ...order };
    PRIVATE_FIELDS.forEach((field) => delete view[field]);
    view.payment_confirmed_at = order.payment_confirmed_at && !order.payment_review ? order.payment_confirmed_at : null;
    return view;
};

/**
 * Mijoz to'lovni tasdiqlaydi: amount berilmasa - ustaning yozgan summasi to'g'ri
 * @param {string} orderId
 * @param {string} userId - mijoz
 * @param {{ amount?: number|null }} options
 * @returns {Promise<object>} yangilangan buyurtma
 */
const confirmPayment = (orderId, userId, { amount = null } = {}) => withTransaction(async (client) => {
    const result = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = result.rows[0];
    if (!order) throw new HttpError(404, 'Buyurtma topilmadi');
    if (order.client_id !== userId) throw new HttpError(403, 'To\'lovni faqat buyurtma bergan mijoz tasdiqlaydi');
    if (order.payment_confirmed_at) throw new HttpError(409, 'To\'lov allaqachon tasdiqlangan');
    if (!awaitsConfirmation(order)) throw new HttpError(400, 'Bu buyurtma uchun to\'lovni tasdiqlash kerak emas');

    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT)) {
        throw new HttpError(400, 'To\'langan summani to\'g\'ri kiriting');
    }
    const paid = amount === null ? Number(order.final_price) : Math.round(amount);
    const review = isUnderreported(order.final_price, paid) ? 'pending' : null;

    const updated = await client.query(
        `UPDATE orders
         SET client_paid_amount = $2, payment_confirmed_at = NOW(), payment_review = $3
         WHERE id = $1
         RETURNING *`,
        [orderId, paid, review]
    );
    return updated.rows[0];
});

module.exports = { confirmPayment, paymentView, isUnderreported, awaitsConfirmation, TOLERANCE_MIN, TOLERANCE_PERCENT };
