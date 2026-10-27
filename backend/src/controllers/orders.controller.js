// =============================================
// UyRemont - Buyurtmalar Controller
// =============================================

const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const {
    assertUuid,
    optionalString,
    requiredString,
    optionalNumber,
    parsePagination,
} = require('../utils/validators');

const STATUSES = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

/**
 * Ruxsat etilgan holat o'zgarishlari: joriy holat -> yangi holat -> kim bajarishi mumkin
 * Admin har qanday yakunlanmagan buyurtma holatini o'zgartira oladi.
 */
const TRANSITIONS = {
    pending: { accepted: ['master'], cancelled: ['client', 'master'] },
    accepted: { in_progress: ['master'], cancelled: ['client', 'master'] },
    in_progress: { completed: ['master', 'client'] },
    completed: {},
    cancelled: {},
};

const ORDER_SELECT = `
    SELECT
        o.*,
        c.name as client_name, c.avatar_url as client_avatar,
        m.name as master_name, m.avatar_url as master_avatar,
        s.name_uz as specialization_name, s.icon as specialization_icon,
        r.rating as review_rating, r.comment as review_comment
    FROM orders o
    LEFT JOIN users c ON c.id = o.client_id
    LEFT JOIN users m ON m.id = o.master_id
    LEFT JOIN specializations s ON s.id = o.specialization_id
    LEFT JOIN reviews r ON r.order_id = o.id
`;

/**
 * Buyurtma ishtirokchisimi yoki ochiq buyurtmani ko'ra oladigan ustami
 */
const canViewOrder = (order, user) => {
    if (user.role === 'admin') return true;
    if (order.client_id === user.id || order.master_id === user.id) return true;
    return user.role === 'master' && order.status === 'pending' && !order.master_id;
};

/**
 * Telefon raqamlarni faqat kerakli tomonlarga ko'rsatish
 */
const loadPhones = async (order, user) => {
    const showPhones = user.role === 'admin'
        || ((order.client_id === user.id || order.master_id === user.id)
            && ['accepted', 'in_progress', 'completed'].includes(order.status));
    if (!showPhones) return {};

    const result = await query(
        'SELECT id, phone FROM users WHERE id = ANY($1::uuid[])',
        [[order.client_id, order.master_id].filter(Boolean)]
    );
    const byId = Object.fromEntries(result.rows.map((row) => [row.id, row.phone]));
    return {
        client_phone: byId[order.client_id] || null,
        master_phone: byId[order.master_id] || null,
    };
};

/**
 * Yangi buyurtma yaratish
 * POST /api/orders
 * Body: { title, description, address, district, budget, master_id, specialization_id, scheduled_at }
 * master_id berilmasa buyurtma barcha mos ustalar uchun ochiq bo'ladi
 */
const createOrder = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const title = requiredString(req.body.title, { min: 3, max: 200, field: 'Sarlavha' });
        const address = requiredString(req.body.address, { min: 3, max: 500, field: 'Manzil' });
        const description = optionalString(req.body.description, { max: 2000, field: 'Tavsif' });
        const district = optionalString(req.body.district, { max: 100, field: 'Tuman' });
        const budget = optionalNumber(req.body.budget, { min: 0, max: 10000000000, field: 'Byudjet' });
        const specializationId = optionalNumber(req.body.specialization_id, {
            min: 1, max: 100000, integer: true, field: 'Mutaxassislik',
        });

        let scheduledAt = null;
        if (req.body.scheduled_at) {
            scheduledAt = new Date(req.body.scheduled_at);
            if (Number.isNaN(scheduledAt.getTime())) {
                throw new HttpError(400, 'Sana noto\'g\'ri kiritilgan');
            }
            if (scheduledAt.getTime() < Date.now() - 60 * 60 * 1000) {
                throw new HttpError(400, 'Rejalashtirilgan vaqt o\'tib ketgan bo\'lmasligi kerak');
            }
        }

        let masterId = null;
        if (req.body.master_id) {
            masterId = assertUuid(req.body.master_id, 'Usta topilmadi');
            if (masterId === clientId) {
                throw new HttpError(400, 'O\'zingizga buyurtma bera olmaysiz');
            }
            const masterResult = await query(
                `SELECT u.id FROM users u
                 JOIN master_profiles mp ON mp.user_id = u.id
                 WHERE u.id = $1 AND u.role = 'master' AND u.is_active = TRUE`,
                [masterId]
            );
            if (masterResult.rows.length === 0) {
                throw new HttpError(404, 'Usta topilmadi yoki faol emas');
            }
        } else if (!specializationId) {
            throw new HttpError(400, 'Ustani yoki mutaxassislikni tanlang');
        }

        // Buyurtmani saqlash
        const result = await query(
            `INSERT INTO orders (id, client_id, master_id, specialization_id, title, description, address, district, budget, scheduled_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
             RETURNING *`,
            [uuidv4(), clientId, masterId, specializationId, title, description, address, district, budget, scheduledAt]
        );

        res.status(201).json({
            success: true,
            message: 'Buyurtma yaratildi',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Buyurtmalar ro'yxatini olish
 * GET /api/orders
 * Query: status, page, limit, q (faqat admin)
 */
const getOrders = async (req, res, next) => {
    try {
        const { id: userId, role } = req.user;
        const { status, q } = req.query;
        const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20 });

        const conditions = [];
        const params = [];
        const addParam = (value) => {
            params.push(value);
            return `$${params.length}`;
        };

        // Rol bo'yicha filtr (admin hammasini ko'radi)
        if (role === 'client') {
            conditions.push(`o.client_id = ${addParam(userId)}`);
        } else if (role === 'master') {
            conditions.push(`o.master_id = ${addParam(userId)}`);
        }

        // Status filtr
        if (status) {
            if (!STATUSES.includes(status)) throw new HttpError(400, 'Noto\'g\'ri holat');
            conditions.push(`o.status = ${addParam(status)}`);
        }

        if (role === 'admin' && q && String(q).trim()) {
            const pattern = addParam(`%${String(q).trim()}%`);
            conditions.push(`(o.title ILIKE ${pattern} OR c.name ILIKE ${pattern} OR m.name ILIKE ${pattern})`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const filterParams = [...params];

        const [ordersResult, countResult] = await Promise.all([
            query(
                `${ORDER_SELECT} ${whereClause}
                 ORDER BY o.created_at DESC
                 LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}`,
                params
            ),
            query(
                `SELECT COUNT(*)::int as total FROM orders o
                 LEFT JOIN users c ON c.id = o.client_id
                 LEFT JOIN users m ON m.id = o.master_id
                 ${whereClause}`,
                filterParams
            ),
        ]);

        const total = countResult.rows[0].total;

        res.status(200).json({
            success: true,
            data: ordersResult.rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ustaga mos ochiq (hali usta biriktirilmagan) buyurtmalar
 * GET /api/orders/open
 */
const getOpenOrders = async (req, res, next) => {
    try {
        const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20 });

        // Ustaning mutaxassisliklariga mos yoki mutaxassislik ko'rsatilmagan buyurtmalar
        const result = await query(
            `${ORDER_SELECT}
             WHERE o.status = 'pending' AND o.master_id IS NULL AND o.client_id <> $1
               AND (
                   o.specialization_id IS NULL
                   OR NOT EXISTS (
                       SELECT 1 FROM master_specializations ms
                       JOIN master_profiles mp ON mp.id = ms.master_id
                       WHERE mp.user_id = $1
                   )
                   OR o.specialization_id IN (
                       SELECT ms.specialization_id FROM master_specializations ms
                       JOIN master_profiles mp ON mp.id = ms.master_id
                       WHERE mp.user_id = $1
                   )
               )
             ORDER BY o.created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * Buyurtma tafsilotini olish
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Buyurtma topilmadi');

        const result = await query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Buyurtma topilmadi',
            });
        }

        const order = result.rows[0];

        // Faqat tegishli foydalanuvchi ko'ra oladi
        if (!canViewOrder(order, req.user)) {
            return res.status(403).json({
                success: false,
                message: 'Bu buyurtmani ko\'rishga ruxsatingiz yo\'q',
            });
        }

        const isParticipant = order.client_id === req.user.id
            || order.master_id === req.user.id
            || req.user.role === 'admin';

        // Chat xabarlari faqat ishtirokchilarga
        const messagesResult = isParticipant
            ? await query(
                `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
                 FROM messages m
                 INNER JOIN users u ON u.id = m.sender_id
                 WHERE m.order_id = $1
                 ORDER BY m.created_at ASC`,
                [id]
            )
            : { rows: [] };

        res.status(200).json({
            success: true,
            data: {
                ...order,
                ...(await loadPhones(order, req.user)),
                messages: messagesResult.rows,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Buyurtma holatini yangilash
 * PUT /api/orders/:id/status
 * Body: { status }
 */
const updateOrderStatus = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Buyurtma topilmadi');
        const { status } = req.body;
        const { id: userId, role } = req.user;

        if (!STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Noto\'g\'ri holat',
            });
        }

        // Buyurtmani tekshirish
        const orderResult = await query('SELECT * FROM orders WHERE id = $1', [id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Buyurtma topilmadi',
            });
        }

        const order = orderResult.rows[0];
        const isOpenOrder = order.status === 'pending' && !order.master_id;

        // Kim ekanligini aniqlash: buyurtma egasi yoki biriktirilgan usta
        let actor = null;
        if (role === 'admin') actor = 'admin';
        else if (order.client_id === userId) actor = 'client';
        else if (order.master_id === userId) actor = 'master';
        else if (role === 'master' && isOpenOrder && status === 'accepted') actor = 'master';

        if (!actor) {
            return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
        }

        const allowedActors = TRANSITIONS[order.status][status];
        const transitionAllowed = actor === 'admin'
            ? order.status !== status && Object.keys(TRANSITIONS[order.status]).length > 0
            : Boolean(allowedActors && allowedActors.includes(actor));

        // Ochiq buyurtmani faqat usta qabul qilib, o'ziga biriktira oladi
        const adminAcceptsOpen = actor === 'admin' && isOpenOrder && status === 'accepted';

        if (!transitionAllowed || adminAcceptsOpen) {
            return res.status(400).json({
                success: false,
                message: 'Buyurtmani bu holatga o\'tkazib bo\'lmaydi',
            });
        }

        // Ochiq buyurtmani qabul qilgan usta unga biriktiriladi.
        // WHERE dagi status sharti bir vaqtda ikki kishi o'zgartirishining oldini oladi.
        const assignMaster = isOpenOrder && status === 'accepted' && actor === 'master';
        const result = await query(
            `UPDATE orders
             SET status = $1, master_id = CASE WHEN $4::boolean THEN $5::uuid ELSE master_id END
             WHERE id = $2 AND status = $3
               AND (NOT $4::boolean OR master_id IS NULL)
             RETURNING *`,
            [status, id, order.status, assignMaster, userId]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({
                success: false,
                message: 'Buyurtma holati allaqachon o\'zgargan. Sahifani yangilang',
            });
        }

        const updated = result.rows[0];
        const io = req.app.get('io');
        if (io) {
            io.to(`order_${id}`).emit('order_updated', { order_id: id, status: updated.status });
        }

        res.status(200).json({
            success: true,
            message: 'Buyurtma holati yangilandi',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrder,
    getOrders,
    getOpenOrders,
    getOrderById,
    updateOrderStatus,
    canViewOrder,
};
