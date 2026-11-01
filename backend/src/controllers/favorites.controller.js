// =============================================
// UyRemont - Sevimli ustalar: tez qayta buyurtma berish va tezkor chaqiruvda ustunlik
// =============================================

const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { assertUuid } = require('../utils/validators');

const MAX_FAVORITES = 50;

/**
 * GET /api/favorites - katalog kartochkasi formatida
 */
const listFavorites = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT
                u.id, u.name, u.avatar_url,
                mp.id as master_profile_id, mp.bio, mp.experience_years,
                mp.hourly_rate, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count, mp.is_available, mp.public_slug,
                COALESCE(
                    (SELECT JSON_AGG(jsonb_build_object(
                        'id', s.id, 'slug', s.slug, 'name_uz', s.name_uz, 'name_ru', s.name_ru,
                        'icon', s.icon, 'vertical', s.vertical
                    ) ORDER BY s.id)
                     FROM master_specializations ms
                     JOIN specializations s ON s.id = ms.specialization_id
                     WHERE ms.master_id = mp.id AND s.is_active = TRUE),
                    '[]'
                ) as specializations
             FROM favorite_masters f
             JOIN users u ON u.id = f.master_user_id
             JOIN master_profiles mp ON mp.user_id = u.id
             WHERE f.user_id = $1 AND u.is_active = TRUE AND u.role = 'master' AND u.deleted_at IS NULL
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/favorites/ids - yurakcha belgisi uchun
 */
const listFavoriteIds = async (req, res, next) => {
    try {
        const result = await query('SELECT master_user_id FROM favorite_masters WHERE user_id = $1', [req.user.id]);
        res.status(200).json({ success: true, data: result.rows.map((row) => row.master_user_id) });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/favorites/:masterId
 */
const addFavorite = async (req, res, next) => {
    try {
        const masterId = assertUuid(req.params.masterId, 'Usta topilmadi');
        if (masterId === req.user.id) throw new HttpError(400, 'O\'zingizni sevimlilarga qo\'sha olmaysiz');

        const master = await query(
            `SELECT u.id FROM users u JOIN master_profiles mp ON mp.user_id = u.id
             WHERE u.id = $1 AND u.role = 'master' AND u.is_active = TRUE AND u.deleted_at IS NULL`,
            [masterId]
        );
        if (!master.rows[0]) throw new HttpError(404, 'Usta topilmadi');

        const count = await query('SELECT COUNT(*)::int as total FROM favorite_masters WHERE user_id = $1', [req.user.id]);
        if (count.rows[0].total >= MAX_FAVORITES) throw new HttpError(400, `Ko'pi bilan ${MAX_FAVORITES} ta sevimli usta`);

        await query(
            'INSERT INTO favorite_masters (user_id, master_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, masterId]
        );
        res.status(201).json({ success: true, message: 'Sevimlilarga qo\'shildi' });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/favorites/:masterId
 */
const removeFavorite = async (req, res, next) => {
    try {
        const masterId = assertUuid(req.params.masterId, 'Usta topilmadi');
        await query('DELETE FROM favorite_masters WHERE user_id = $1 AND master_user_id = $2', [req.user.id, masterId]);
        res.status(200).json({ success: true, message: 'Sevimlilardan olib tashlandi' });
    } catch (error) {
        next(error);
    }
};

module.exports = { listFavorites, listFavoriteIds, addFavorite, removeFavorite };
