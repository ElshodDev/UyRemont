// =============================================
// UyRemont - Ustalar Controller
// =============================================

const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

/**
 * Barcha ustalarni olish (filtr bilan)
 * GET /api/masters
 * Query: specialization_id, district, min_rate, max_rate, sort_by, page, limit
 */
const getAllMasters = async (req, res, next) => {
    try {
        const {
            specialization_id,
            district,
            min_rate,
            max_rate,
            sort_by = 'rating',
            page = 1,
            limit = 10,
        } = req.query;

        // Dinamik filtr qurilishi
        const conditions = ['u.is_active = TRUE', 'mp.is_available = TRUE'];
        const params = [];
        let paramIndex = 1;

        if (district) {
            conditions.push(`mp.district ILIKE $${paramIndex}`);
            params.push(`%${district}%`);
            paramIndex++;
        }

        if (min_rate) {
            conditions.push(`mp.hourly_rate >= $${paramIndex}`);
            params.push(parseFloat(min_rate));
            paramIndex++;
        }

        if (max_rate) {
            conditions.push(`mp.hourly_rate <= $${paramIndex}`);
            params.push(parseFloat(max_rate));
            paramIndex++;
        }

        // Saralash
        const sortOptions = {
            rating: 'mp.rating DESC',
            price_asc: 'mp.hourly_rate ASC',
            price_desc: 'mp.hourly_rate DESC',
            reviews: 'mp.reviews_count DESC',
        };
        const orderBy = sortOptions[sort_by] || 'mp.rating DESC';

        // Offset hisoblash
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Mutaxassislik filtr
        let specializationJoin = '';
        if (specialization_id) {
            specializationJoin = `
                INNER JOIN master_specializations ms_filter ON ms_filter.master_id = mp.id
                AND ms_filter.specialization_id = $${paramIndex}
            `;
            params.push(parseInt(specialization_id));
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Asosiy so'rov
        const mastersQuery = `
            SELECT 
                u.id, u.name, u.avatar_url,
                mp.id as master_profile_id, mp.bio, mp.experience_years,
                mp.hourly_rate, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count,
                COALESCE(
                    JSON_AGG(
                        DISTINCT jsonb_build_object(
                            'id', s.id,
                            'name_uz', s.name_uz,
                            'icon', s.icon
                        )
                    ) FILTER (WHERE s.id IS NOT NULL),
                    '[]'
                ) as specializations
            FROM users u
            INNER JOIN master_profiles mp ON mp.user_id = u.id
            ${specializationJoin}
            LEFT JOIN master_specializations ms ON ms.master_id = mp.id
            LEFT JOIN specializations s ON s.id = ms.specialization_id
            ${whereClause}
            GROUP BY u.id, u.name, u.avatar_url, mp.id, mp.bio, 
                     mp.experience_years, mp.hourly_rate, mp.district, 
                     mp.city, mp.is_verified, mp.rating, mp.reviews_count
            ORDER BY ${orderBy}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit), offset);

        // Umumiy soni
        const countQuery = `
            SELECT COUNT(DISTINCT u.id) as total
            FROM users u
            INNER JOIN master_profiles mp ON mp.user_id = u.id
            ${specializationJoin}
            ${whereClause}
        `;

        const [mastersResult, countResult] = await Promise.all([
            query(mastersQuery, params),
            query(countQuery, params.slice(0, -2)), // limit va offset ni olib tashlash
        ]);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                masters: mastersResult.rows,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta profilini ID bo'yicha olish
 * GET /api/masters/:id
 */
const getMasterById = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Asosiy profil ma'lumotlari
        const masterResult = await query(
            `SELECT 
                u.id, u.name, u.avatar_url, u.phone, u.created_at,
                mp.id as master_profile_id, mp.bio, mp.experience_years,
                mp.hourly_rate, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count, mp.is_available
             FROM users u
             INNER JOIN master_profiles mp ON mp.user_id = u.id
             WHERE u.id = $1 AND u.is_active = TRUE`,
            [id]
        );

        if (masterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usta topilmadi',
            });
        }

        const master = masterResult.rows[0];

        // Mutaxassisliklar
        const specializationsResult = await query(
            `SELECT s.id, s.name_uz, s.name_ru, s.icon
             FROM specializations s
             INNER JOIN master_specializations ms ON ms.specialization_id = s.id
             WHERE ms.master_id = $1`,
            [master.master_profile_id]
        );

        // Portfolio
        const portfolioResult = await query(
            `SELECT id, image_url, description, created_at
             FROM portfolio_items
             WHERE master_id = $1
             ORDER BY created_at DESC`,
            [master.master_profile_id]
        );

        // So'nggi sharhlar (5 ta)
        const reviewsResult = await query(
            `SELECT 
                r.id, r.rating, r.comment, r.created_at,
                u.name as client_name, u.avatar_url as client_avatar
             FROM reviews r
             INNER JOIN users u ON u.id = r.client_id
             WHERE r.master_id = $1
             ORDER BY r.created_at DESC
             LIMIT 5`,
            [id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...master,
                specializations: specializationsResult.rows,
                portfolio: portfolioResult.rows,
                recent_reviews: reviewsResult.rows,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta profilini yangilash
 * PUT /api/masters/profile
 */
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { bio, experience_years, hourly_rate, district, city, specialization_ids } = req.body;

        // Master profilini tekshirish
        const profileResult = await query(
            'SELECT id FROM master_profiles WHERE user_id = $1',
            [userId]
        );

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usta profili topilmadi',
            });
        }

        const masterProfileId = profileResult.rows[0].id;

        // Profilni yangilash
        await query(
            `UPDATE master_profiles 
             SET bio = COALESCE($1, bio),
                 experience_years = COALESCE($2, experience_years),
                 hourly_rate = COALESCE($3, hourly_rate),
                 district = COALESCE($4, district),
                 city = COALESCE($5, city)
             WHERE user_id = $6`,
            [bio, experience_years, hourly_rate, district, city, userId]
        );

        // Mutaxassisliklarni yangilash
        if (specialization_ids && Array.isArray(specialization_ids)) {
            // Eskilarini o'chirish
            await query(
                'DELETE FROM master_specializations WHERE master_id = $1',
                [masterProfileId]
            );

            // Yangilarini qo'shish
            for (const specId of specialization_ids) {
                await query(
                    'INSERT INTO master_specializations (master_id, specialization_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [masterProfileId, specId]
                );
            }
        }

        res.status(200).json({
            success: true,
            message: 'Profil yangilandi',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Portfolio rasm qo'shish
 * POST /api/masters/portfolio
 */
const uploadPortfolio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { image_url, description } = req.body;

        if (!image_url) {
            return res.status(400).json({
                success: false,
                message: 'Rasm URL kiritilmagan',
            });
        }

        // Master profilini topish
        const profileResult = await query(
            'SELECT id FROM master_profiles WHERE user_id = $1',
            [userId]
        );

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usta profili topilmadi',
            });
        }

        const masterProfileId = profileResult.rows[0].id;

        // Portfolio elementini saqlash
        const result = await query(
            `INSERT INTO portfolio_items (id, master_id, image_url, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [uuidv4(), masterProfileId, image_url, description]
        );

        res.status(201).json({
            success: true,
            message: 'Portfolio rasmi qo\'shildi',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Barcha mutaxassisliklarni olish
 * GET /api/masters/specializations
 */
const getSpecializations = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM specializations WHERE is_active = TRUE ORDER BY id'
        );

        res.status(200).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllMasters,
    getMasterById,
    updateProfile,
    uploadPortfolio,
    getSpecializations,
};
