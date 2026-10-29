// =============================================
// UyRemont - Ustaning taklifga javobi (sayt va Telegram tugmalari uchun umumiy)
// =============================================

const { query, withTransaction } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { emitOrderUpdate, emitToUser, triggerDispatch } = require('./dispatch.service');
const { syncOfferMessage } = require('./telegram/notify');

/**
 * Taklifni qabul qilish: buyurtma ustaga biriktiriladi
 * @returns {Promise<object>} yangilangan buyurtma
 */
const acceptOffer = async (offerId, userId) => {
    try {
        const order = await withTransaction(async (client) => {
            const offerResult = await client.query(
                'SELECT * FROM dispatch_offers WHERE id = $1 AND master_id = $2 FOR UPDATE',
                [offerId, userId]
            );
            const offer = offerResult.rows[0];
            if (!offer) throw new HttpError(404, 'Taklif topilmadi');
            if (offer.status !== 'pending' || new Date(offer.expires_at).getTime() < Date.now()) {
                throw new HttpError(409, 'Taklif muddati tugagan yoki bekor qilingan');
            }

            const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [offer.order_id]);
            if (!orderResult.rows[0] || orderResult.rows[0].status !== 'searching') {
                // Taklif yopiladi (tranzaksiya saqlanadi), so'ng xato qaytariladi
                await client.query(
                    'UPDATE dispatch_offers SET status = \'cancelled\', responded_at = NOW() WHERE id = $1',
                    [offerId]
                );
                return null;
            }

            await client.query(
                'UPDATE dispatch_offers SET status = \'accepted\', responded_at = NOW() WHERE id = $1',
                [offerId]
            );
            await client.query(
                `UPDATE master_profiles
                 SET offers_accepted = offers_accepted + 1, missed_offers_streak = 0
                 WHERE user_id = $1`,
                [userId]
            );
            const updated = await client.query(
                `UPDATE orders SET status = 'accepted', master_id = $2, accepted_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [offer.order_id, userId]
            );
            return updated.rows[0];
        });

        if (!order) throw new HttpError(409, 'Buyurtma endi mavjud emas');
        emitOrderUpdate(order, { message: 'Usta topildi va yo\'lga chiqdi', actor: 'master' });
        // Ustaning boshqa qurilmasidagi (sayt) taklif oynasi yopiladi
        emitToUser(userId, 'offer_closed', { offer_id: offerId, reason: 'accepted', order_id: order.id });
        return order;
    } finally {
        // Telegram'dagi taklif xabari har qanday natijada yangilanadi (hali ochiq bo'lsa o'zgarmaydi)
        syncOfferMessage(offerId);
    }
};

/**
 * Taklifni rad etish (javob hisoblanadi: ketma-ket javobsizlar hisobi nolga tushadi)
 */
const declineOffer = async (offerId, userId) => {
    const result = await query(
        `UPDATE dispatch_offers SET status = 'declined', responded_at = NOW()
         WHERE id = $1 AND master_id = $2 AND status = 'pending'
         RETURNING id`,
        [offerId, userId]
    );
    if (!result.rows[0]) throw new HttpError(409, 'Taklif allaqachon yopilgan');

    await query('UPDATE master_profiles SET missed_offers_streak = 0 WHERE user_id = $1', [userId]);
    emitToUser(userId, 'offer_closed', { offer_id: offerId, reason: 'declined' });
    syncOfferMessage(offerId);
    triggerDispatch();
};

module.exports = { acceptOffer, declineOffer };
