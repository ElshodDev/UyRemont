// =============================================
// UyRemont - Ustalar Controller
// =============================================

const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { UPLOAD_DIR } = require('../middleware/upload');
const {
    assertUuid,
    optionalString,
    optionalNumber,
    parsePagination,
} = require('../utils/validators');

const VERTICALS = ['home', 'auto', 'appliance', 'gadget'];
const MAX_PORTFOLIO_ITEMS = 20;

/**
 * Barcha ustalarni olish (filtr bilan)
 * GET /api/masters
 * Query: q, vertical, specialization (slug), specialization_id, district,
 *        min_rate, max_rate, available, sort_by, page, limit
 */
const getAllMasters = async (req, res, next) => {
    try {
        const {
            q,
            vertical,
            specialization,
            specialization_id,
            district,
            min_rate,
            max_rate,
            available,
            sort_by = 'rating',
        } = req.query;
        const { page, limit, offset } = parsePagination(req.query);

        // Dinamik filtr qurilishi
        const conditions = ['u.is_active = TRUE', 'u.role = \'master\''];
        const params = [];
        const addParam = (value) => {
            params.push(value);
            return `$${params.length}`;
        };

        if (vertical && VERTICALS.includes(vertical)) {
            conditions.push(`EXISTS (
                SELECT 1 FROM master_specializations msv
                JOIN specializations sv ON sv.id = msv.specialization_id
                WHERE msv.master_id = mp.id AND sv.vertical = ${addParam(vertical)}
            )`);
        }

        if (specialization) {
            conditions.push(`EXISTS (
                SELECT 1 FROM master_specializations mss
                JOIN specializations ss ON ss.id = mss.specialization_id
                WHERE mss.master_id = mp.id AND ss.slug = ${addParam(String(specialization))}
            )`);
        } else if (specialization_id && Number.isInteger(Number(specialization_id))) {
            conditions.push(`EXISTS (
                SELECT 1 FROM master_specializations msi
                WHERE msi.master_id = mp.id AND msi.specialization_id = ${addParam(Number(specialization_id))}
            )`);
        }

        if (district) {
            conditions.push(`mp.district ILIKE ${addParam(`%${district}%`)}`);
        }

        if (q && String(q).trim()) {
            const pattern = addParam(`%${String(q).trim()}%`);
            conditions.push(`(
                u.name ILIKE ${pattern}
                OR mp.bio ILIKE ${pattern}
                OR EXISTS (
                    SELECT 1 FROM master_specializations msq
                    JOIN specializations sq ON sq.id = msq.specialization_id
                    WHERE msq.master_id = mp.id AND sq.name_uz ILIKE ${pattern}
                )
            )`);
        }

        if (min_rate && Number.isFinite(Number(min_rate))) {
            conditions.push(`mp.hourly_rate >= ${addParam(Number(min_rate))}`);
        }

        if (max_rate && Number.isFinite(Number(max_rate))) {
            conditions.push(`mp.hourly_rate <= ${addParam(Number(max_rate))}`);
        }

        if (available === 'true') {
            conditions.push('mp.is_available = TRUE');
        }

        // Saralash (faqat oq ro'yxatdagi qiymatlar)
        const sortOptions = {
            rating: 'mp.rating DESC, mp.reviews_count DESC',
            price_asc: 'mp.hourly_rate ASC NULLS LAST',
            price_desc: 'mp.hourly_rate DESC NULLS LAST',
            reviews: 'mp.reviews_count DESC',
            experience: 'mp.experience_years DESC',
        };
        const orderBy = sortOptions[sort_by] || sortOptions.rating;

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const filterParams = [...params];

        // Asosiy so'rov
        const mastersQuery = `
            SELECT
                u.id, u.name, u.avatar_url,
                mp.id as master_profile_id, mp.bio, mp.experience_years,
                mp.hourly_rate, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count, mp.is_available,
                COALESCE(
                    (SELECT JSON_AGG(jsonb_build_object(
                        'id', s.id, 'slug', s.slug, 'name_uz', s.name_uz,
                        'icon', s.icon, 'vertical', s.vertical
                    ) ORDER BY s.id)
                     FROM master_specializations ms
                     JOIN specializations s ON s.id = ms.specialization_id
                     WHERE ms.master_id = mp.id AND s.is_active = TRUE),
                    '[]'
                ) as specializations
            FROM users u
            INNER JOIN master_profiles mp ON mp.user_id = u.id
            ${whereClause}
            ORDER BY mp.is_available DESC, ${orderBy}, u.created_at DESC
            LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}
        `;

        // Umumiy soni
        const countQuery = `
            SELECT COUNT(*) as total
            FROM users u
            INNER JOIN master_profiles mp ON mp.user_id = u.id
            ${whereClause}
        `;

        const [mastersResult, countResult] = await Promise.all([
            query(mastersQuery, params),
            query(countQuery, filterParams),
        ]);

        const total = parseInt(countResult.rows[0].total, 10);

        res.status(200).json({
            success: true,
            data: {
                masters: mastersResult.rows,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Har bir bo'limdagi faol ustalar soni
 * GET /api/masters/verticals
 */
const getVerticalStats = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT s.vertical, COUNT(DISTINCT mp.id)::int as masters_count
             FROM specializations s
             JOIN master_specializations ms ON ms.specialization_id = s.id
             JOIN master_profiles mp ON mp.id = ms.master_id
             JOIN users u ON u.id = mp.user_id
             WHERE u.is_active = TRUE AND u.role = 'master' AND s.is_active = TRUE
             GROUP BY s.vertical`
        );

        const counts = Object.fromEntries(VERTICALS.map((v) => [v, 0]));
        result.rows.forEach((row) => {
            counts[row.vertical] = row.masters_count;
        });

        res.status(200).json({ success: true, data: counts });
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
        const id = assertUuid(req.params.id, 'Usta topilmadi');

        // Asosiy profil ma'lumotlari
        const masterResult = await query(
            `SELECT
                u.id, u.name, u.avatar_url, u.phone, u.created_at,
                mp.id as master_profile_id, mp.bio, mp.experience_years,
                mp.hourly_rate, mp.district, mp.city, mp.is_verified,
                mp.rating, mp.reviews_count, mp.is_available
             FROM users u
             INNER JOIN master_profiles mp ON mp.user_id = u.id
             WHERE u.id = $1 AND u.is_active = TRUE AND u.role = 'master'`,
            [id]
        );

        if (masterResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usta topilmadi',
            });
        }

        const master = masterResult.rows[0];

        const [specializationsResult, portfolioResult, reviewsResult, completedResult] = await Promise.all([
            // Mutaxassisliklar
            query(
                `SELECT s.id, s.slug, s.name_uz, s.name_ru, s.icon, s.vertical
                 FROM specializations s
                 INNER JOIN master_specializations ms ON ms.specialization_id = s.id
                 WHERE ms.master_id = $1 AND s.is_active = TRUE
                 ORDER BY s.id`,
                [master.master_profile_id]
            ),
            // Portfolio
            query(
                `SELECT id, image_url, description, created_at
                 FROM portfolio_items
                 WHERE master_id = $1
                 ORDER BY created_at DESC`,
                [master.master_profile_id]
            ),
            // So'nggi sharhlar (5 ta)
            query(
                `SELECT
                    r.id, r.rating, r.comment, r.created_at,
                    u.name as client_name, u.avatar_url as client_avatar
                 FROM reviews r
                 INNER JOIN users u ON u.id = r.client_id
                 WHERE r.master_id = $1
                 ORDER BY r.created_at DESC
                 LIMIT 5`,
                [id]
            ),
            // Bajarilgan buyurtmalar soni
            query(
                'SELECT COUNT(*)::int as total FROM orders WHERE master_id = $1 AND status = \'completed\'',
                [id]
            ),
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...master,
                completed_orders: completedResult.rows[0].total,
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
 * Body: { name, bio, experience_years, hourly_rate, district, city, is_available, specialization_ids }
 */
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const name = optionalString(req.body.name, { max: 100, field: 'Ism' });
        const bio = optionalString(req.body.bio, { max: 1000, field: 'Ma\'lumot' });
        const district = optionalString(req.body.district, { max: 100, field: 'Tuman' });
        const city = optionalString(req.body.city, { max: 100, field: 'Shahar' });
        const experienceYears = optionalNumber(req.body.experience_years, {
            min: 0, max: 60, integer: true, field: 'Tajriba',
        });
        const hourlyRate = optionalNumber(req.body.hourly_rate, {
            min: 0, max: 100000000, field: 'Narx',
        });
        const isAvailable = typeof req.body.is_available === 'boolean' ? req.body.is_available : null;
        const { specialization_ids: specializationIds } = req.body;

        if (specializationIds !== undefined) {
            const valid = Array.isArray(specializationIds)
                && specializationIds.length <= 10
                && specializationIds.every((sid) => Number.isInteger(sid) && sid > 0);
            if (!valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Mutaxassisliklar noto\'g\'ri tanlangan (ko\'pi bilan 10 ta)',
                });
            }
        }

        const updated = await withTransaction(async (client) => {
            const profileResult = await client.query(
                'SELECT id FROM master_profiles WHERE user_id = $1',
                [userId]
            );
            if (profileResult.rows.length === 0) return null;
            const masterProfileId = profileResult.rows[0].id;

            if (name) {
                await client.query('UPDATE users SET name = $1 WHERE id = $2', [name, userId]);
            }

            // Profilni yangilash
            await client.query(
                `UPDATE master_profiles
                 SET bio = COALESCE($1, bio),
                     experience_years = COALESCE($2, experience_years),
                     hourly_rate = COALESCE($3, hourly_rate),
                     district = COALESCE($4, district),
                     city = COALESCE($5, city),
                     is_available = COALESCE($6, is_available)
                 WHERE user_id = $7`,
                [bio, experienceYears, hourlyRate, district, city, isAvailable, userId]
            );

            // Mutaxassisliklarni yangilash
            if (Array.isArray(specializationIds)) {
                await client.query(
                    'DELETE FROM master_specializations WHERE master_id = $1',
                    [masterProfileId]
                );
                if (specializationIds.length > 0) {
                    await client.query(
                        `INSERT INTO master_specializations (master_id, specialization_id)
                         SELECT $1, s.id FROM specializations s
                         WHERE s.id = ANY($2::int[]) AND s.is_active = TRUE
                         ON CONFLICT DO NOTHING`,
                        [masterProfileId, specializationIds]
                    );
                }
            }
            return masterProfileId;
        });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Usta profili topilmadi',
            });
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
 * Joriy ustaning portfolio ro'yxati
 * GET /api/masters/portfolio/my
 */
const getMyPortfolio = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT p.id, p.image_url, p.description, p.created_at
             FROM portfolio_items p
             JOIN master_profiles mp ON mp.id = p.master_id
             WHERE mp.user_id = $1
             ORDER BY p.created_at DESC`,
            [req.user.id]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * Portfolio rasm qo'shish
 * POST /api/masters/portfolio
 * multipart/form-data: image (fayl), description
 * yoki JSON: { image_url, description }
 */
const uploadPortfolio = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const description = optionalString(req.body.description, { max: 300, field: 'Tavsif' });

        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        } else if (typeof req.body.image_url === 'string' && /^https?:\/\/\S+$/i.test(req.body.image_url.trim())) {
            imageUrl = req.body.image_url.trim();
        }

        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Rasm fayli yoki to\'g\'ri rasm URL kiritilmagan',
            });
        }

        // Master profilini topish
        const profileResult = await query(
            `SELECT mp.id, (SELECT COUNT(*)::int FROM portfolio_items p WHERE p.master_id = mp.id) as items
             FROM master_profiles mp WHERE mp.user_id = $1`,
            [userId]
        );

        if (profileResult.rows.length === 0 || profileResult.rows[0].items >= MAX_PORTFOLIO_ITEMS) {
            if (req.file) await fs.unlink(req.file.path).catch(() => {});
            return res.status(profileResult.rows.length === 0 ? 404 : 400).json({
                success: false,
                message: profileResult.rows.length === 0
                    ? 'Usta profili topilmadi'
                    : `Portfolioga ko'pi bilan ${MAX_PORTFOLIO_ITEMS} ta rasm qo'shish mumkin`,
            });
        }

        // Portfolio elementini saqlash
        const result = await query(
            `INSERT INTO portfolio_items (id, master_id, image_url, description)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [uuidv4(), profileResult.rows[0].id, imageUrl, description]
        );

        res.status(201).json({
            success: true,
            message: 'Portfolio rasmi qo\'shildi',
            data: result.rows[0],
        });
    } catch (error) {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        next(error);
    }
};

/**
 * Portfolio rasmini o'chirish
 * DELETE /api/masters/portfolio/:itemId
 */
const deletePortfolioItem = async (req, res, next) => {
    try {
        const itemId = assertUuid(req.params.itemId, 'Rasm topilmadi');

        const result = await query(
            `DELETE FROM portfolio_items p
             USING master_profiles mp
             WHERE p.id = $1 AND p.master_id = mp.id AND mp.user_id = $2
             RETURNING p.image_url`,
            [itemId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Rasm topilmadi' });
        }

        // Lokal yuklangan faylni ham o'chirish
        const imageUrl = result.rows[0].image_url;
        if (imageUrl.startsWith('/uploads/')) {
            await fs.unlink(path.join(UPLOAD_DIR, path.basename(imageUrl))).catch(() => {});
        }

        res.status(200).json({ success: true, message: 'Rasm o\'chirildi' });
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
            `SELECT id, slug, name_uz, name_ru, icon, vertical, call_fee
             FROM specializations WHERE is_active = TRUE ORDER BY id`
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
    getVerticalStats,
    getMasterById,
    updateProfile,
    getMyPortfolio,
    uploadPortfolio,
    deletePortfolioItem,
    getSpecializations,
};
