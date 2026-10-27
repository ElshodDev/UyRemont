// =============================================
// UyRemont - Administrator Controller
// =============================================

const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { assertUuid, parsePagination } = require('../utils/validators');

const ROLES = ['client', 'master', 'admin'];

/**
 * Platforma statistikasi
 * GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
    try {
        const [usersResult, ordersResult, reviewsResult, dailyResult] = await Promise.all([
            query(
                `SELECT
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE role = 'client')::int as clients,
                    COUNT(*) FILTER (WHERE role = 'master')::int as masters,
                    COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
                    COUNT(*) FILTER (WHERE is_active = FALSE)::int as blocked,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int as new_this_week
                 FROM users`
            ),
            query(
                `SELECT
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE status IN ('pending', 'searching'))::int as pending,
                    COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
                    COUNT(*) FILTER (WHERE status IN ('arrived', 'in_progress'))::int as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
                    COUNT(*) FILTER (WHERE status IN ('cancelled', 'expired'))::int as cancelled,
                    COALESCE(SUM(budget) FILTER (WHERE status = 'completed'), 0) as completed_budget
                 FROM orders`
            ),
            query('SELECT COUNT(*)::int as total, COALESCE(AVG(rating), 0)::DECIMAL(3,2) as average FROM reviews'),
            query(
                `SELECT d::date as day, COUNT(o.id)::int as orders
                 FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d
                 LEFT JOIN orders o ON o.created_at::date = d::date
                 GROUP BY d ORDER BY d`
            ),
        ]);

        const live = await query(
            `SELECT
                (SELECT COUNT(*)::int FROM master_profiles mp JOIN users u ON u.id = mp.user_id
                 WHERE mp.is_online = TRUE AND u.is_active = TRUE) as online_masters,
                (SELECT COUNT(*)::int FROM orders WHERE mode = 'instant' AND status = 'searching') as searching,
                (SELECT COUNT(*)::int FROM orders WHERE mode = 'instant' AND status IN ('accepted', 'arrived', 'in_progress')) as active_jobs,
                (SELECT COUNT(*)::int FROM orders WHERE mode = 'instant' AND status = 'expired'
                   AND created_at::date = CURRENT_DATE) as expired_today,
                (SELECT COALESCE(SUM(final_price), 0) FROM orders WHERE mode = 'instant' AND status = 'completed'
                   AND completed_at::date = CURRENT_DATE) as instant_revenue_today`
        );

        const unverified = await query(
            `SELECT COUNT(*)::int as total FROM master_profiles mp
             JOIN users u ON u.id = mp.user_id
             WHERE u.role = 'master' AND mp.is_verified = FALSE`
        );

        res.status(200).json({
            success: true,
            data: {
                users: usersResult.rows[0],
                orders: ordersResult.rows[0],
                reviews: reviewsResult.rows[0],
                unverified_masters: unverified.rows[0].total,
                live: live.rows[0],
                orders_last_7_days: dailyResult.rows,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Foydalanuvchilar ro'yxati
 * GET /api/admin/users
 * Query: q, role, status (active|blocked), page, limit
 */
const getUsers = async (req, res, next) => {
    try {
        const { q, role, status } = req.query;
        const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20 });

        const conditions = [];
        const params = [];
        const addParam = (value) => {
            params.push(value);
            return `$${params.length}`;
        };

        if (role && ROLES.includes(role)) conditions.push(`u.role = ${addParam(role)}`);
        if (status === 'active') conditions.push('u.is_active = TRUE');
        if (status === 'blocked') conditions.push('u.is_active = FALSE');
        if (q && String(q).trim()) {
            const pattern = addParam(`%${String(q).trim()}%`);
            conditions.push(`(u.name ILIKE ${pattern} OR u.phone ILIKE ${pattern})`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const filterParams = [...params];

        const [usersResult, countResult] = await Promise.all([
            query(
                `SELECT
                    u.id, u.phone, u.name, u.role, u.avatar_url, u.is_active, u.created_at,
                    mp.is_verified, mp.rating, mp.reviews_count, mp.district,
                    (SELECT COUNT(*)::int FROM orders o WHERE o.client_id = u.id OR o.master_id = u.id) as orders_count
                 FROM users u
                 LEFT JOIN master_profiles mp ON mp.user_id = u.id
                 ${whereClause}
                 ORDER BY u.created_at DESC
                 LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}`,
                params
            ),
            query(`SELECT COUNT(*)::int as total FROM users u ${whereClause}`, filterParams),
        ]);

        const total = countResult.rows[0].total;

        res.status(200).json({
            success: true,
            data: usersResult.rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Foydalanuvchini yangilash (bloklash, rol, usta tasdiqlash)
 * PATCH /api/admin/users/:id
 * Body: { is_active?, role?, is_verified? }
 */
const updateUser = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Foydalanuvchi topilmadi');
        const { is_active: isActive, role, is_verified: isVerified } = req.body;

        if (isActive !== undefined && typeof isActive !== 'boolean') {
            throw new HttpError(400, 'is_active mantiqiy qiymat bo\'lishi kerak');
        }
        if (isVerified !== undefined && typeof isVerified !== 'boolean') {
            throw new HttpError(400, 'is_verified mantiqiy qiymat bo\'lishi kerak');
        }
        if (role !== undefined && !ROLES.includes(role)) {
            throw new HttpError(400, 'Noto\'g\'ri rol');
        }

        // Admin o'zini tasodifan bloklab yoki huquqdan mahrum qilib qo'ymasligi uchun
        if (id === req.user.id && (isActive === false || (role && role !== 'admin'))) {
            throw new HttpError(400, 'O\'z hisobingizni bloklay yoki rolini o\'zgartira olmaysiz');
        }

        const user = await withTransaction(async (client) => {
            const existing = await client.query('SELECT id, role FROM users WHERE id = $1', [id]);
            if (existing.rows.length === 0) return null;

            if (isActive !== undefined || role !== undefined) {
                await client.query(
                    `UPDATE users
                     SET is_active = COALESCE($1, is_active), role = COALESCE($2, role)
                     WHERE id = $3`,
                    [isActive ?? null, role ?? null, id]
                );
            }

            const effectiveRole = role || existing.rows[0].role;
            if (effectiveRole === 'master' || isVerified !== undefined) {
                // Usta profilini yaratish (agar yo'q bo'lsa) va tasdiqlash holatini o'rnatish
                await client.query(
                    `INSERT INTO master_profiles (id, user_id, is_verified) VALUES ($1, $2, COALESCE($3, FALSE))
                     ON CONFLICT (user_id) DO UPDATE SET is_verified = COALESCE($3, master_profiles.is_verified)`,
                    [uuidv4(), id, isVerified ?? null]
                );
            }

            const updated = await client.query(
                `SELECT u.id, u.phone, u.name, u.role, u.is_active, u.created_at, mp.is_verified
                 FROM users u LEFT JOIN master_profiles mp ON mp.user_id = u.id
                 WHERE u.id = $1`,
                [id]
            );
            return updated.rows[0];
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }

        // Bloklangan foydalanuvchining faol socket ulanishlarini uzish
        if (isActive === false) {
            const io = req.app.get('io');
            if (io) {
                const sockets = await io.fetchSockets();
                sockets
                    .filter((socket) => socket.data.userId === id)
                    .forEach((socket) => socket.disconnect(true));
            }
        }

        res.status(200).json({
            success: true,
            message: 'Foydalanuvchi yangilandi',
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getStats, getUsers, updateUser };
