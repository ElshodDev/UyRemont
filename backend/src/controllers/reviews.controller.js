// =============================================
// UyRemont - Sharhlar Controller
// =============================================

const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

/**
 * Sharh qo'shish
 * POST /api/reviews
 * Body: { order_id, rating, comment }
 */
const createReview = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { order_id, rating, comment } = req.body;

        // Tekshirish
        if (!order_id || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Buyurtma ID va reyting majburiy',
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Reyting 1 dan 5 gacha bo\'lishi kerak',
            });
        }

        // Buyurtmani tekshirish
        const orderResult = await query(
            'SELECT * FROM orders WHERE id = $1 AND client_id = $2 AND status = \'completed\'',
            [order_id, clientId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Buyurtma topilmadi yoki yakunlanmagan',
            });
        }

        const order = orderResult.rows[0];

        // Sharh mavjudligini tekshirish
        const existingReview = await query(
            'SELECT id FROM reviews WHERE order_id = $1',
            [order_id]
        );

        if (existingReview.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Bu buyurtma uchun sharh allaqachon qoldirilgan',
            });
        }

        // Sharhni saqlash
        const reviewResult = await query(
            `INSERT INTO reviews (id, order_id, client_id, master_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [uuidv4(), order_id, clientId, order.master_id, parseInt(rating), comment]
        );

        // Ustaning o'rtacha reytingini yangilash
        await query(
            `UPDATE master_profiles mp
             SET 
                rating = (
                    SELECT AVG(r.rating)::DECIMAL(3,2)
                    FROM reviews r
                    WHERE r.master_id = $1
                ),
                reviews_count = (
                    SELECT COUNT(*)
                    FROM reviews r
                    WHERE r.master_id = $1
                )
             WHERE mp.user_id = $1`,
            [order.master_id]
        );

        res.status(201).json({
            success: true,
            message: 'Sharh qo\'shildi',
            data: reviewResult.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta sharhlarini olish
 * GET /api/reviews/master/:masterId
 */
const getMasterReviews = async (req, res, next) => {
    try {
        const { masterId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const result = await query(
            `SELECT 
                r.id, r.rating, r.comment, r.created_at,
                u.name as client_name, u.avatar_url as client_avatar
             FROM reviews r
             INNER JOIN users u ON u.id = r.client_id
             WHERE r.master_id = $1
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3`,
            [masterId, parseInt(limit), offset]
        );

        // Umumiy soni
        const countResult = await query(
            'SELECT COUNT(*) as total FROM reviews WHERE master_id = $1',
            [masterId]
        );

        // Reyting taqsimoti
        const ratingDistResult = await query(
            `SELECT rating, COUNT(*) as count
             FROM reviews
             WHERE master_id = $1
             GROUP BY rating
             ORDER BY rating DESC`,
            [masterId]
        );

        res.status(200).json({
            success: true,
            data: {
                reviews: result.rows,
                total: parseInt(countResult.rows[0].total),
                rating_distribution: ratingDistResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createReview, getMasterReviews };
