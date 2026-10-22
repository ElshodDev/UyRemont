// =============================================
// UyRemont - Buyurtmalar Controller
// =============================================

const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

/**
 * Yangi buyurtma yaratish
 * POST /api/orders
 * Body: { title, description, address, district, budget, master_id, scheduled_at }
 */
const createOrder = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const { title, description, address, district, budget, master_id, scheduled_at } = req.body;

        // Majburiy maydonlarni tekshirish
        if (!title || !address) {
            return res.status(400).json({
                success: false,
                message: 'Sarlavha va manzil majburiy',
            });
        }

        // Buyurtmani saqlash
        const result = await query(
            `INSERT INTO orders (id, client_id, master_id, title, description, address, district, budget, scheduled_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
             RETURNING *`,
            [uuidv4(), clientId, master_id || null, title, description, address, district, budget, scheduled_at || null]
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
 */
const getOrders = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { status, page = 1, limit = 10 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const params = [];
        let paramIndex = 1;

        // Rol bo'yicha filtr
        let roleCondition;
        if (userRole === 'client') {
            roleCondition = `o.client_id = $${paramIndex}`;
        } else if (userRole === 'master') {
            roleCondition = `o.master_id = $${paramIndex}`;
        } else {
            roleCondition = 'TRUE'; // Admin - hammani ko'radi
            paramIndex--; // Admin uchun userId kerak emas
        }

        if (userRole !== 'admin') {
            params.push(userId);
            paramIndex++;
        }

        // Status filtr
        let statusCondition = '';
        if (status) {
            statusCondition = `AND o.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        const ordersQuery = `
            SELECT 
                o.*,
                c.name as client_name, c.avatar_url as client_avatar, c.phone as client_phone,
                m.name as master_name, m.avatar_url as master_avatar
            FROM orders o
            LEFT JOIN users c ON c.id = o.client_id
            LEFT JOIN users m ON m.id = o.master_id
            WHERE ${roleCondition} ${statusCondition}
            ORDER BY o.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit), offset);

        const result = await query(ordersQuery, params);

        res.status(200).json({
            success: true,
            data: result.rows,
        });
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
        const { id } = req.params;
        const userId = req.user.id;

        const result = await query(
            `SELECT 
                o.*,
                c.name as client_name, c.avatar_url as client_avatar, c.phone as client_phone,
                m.name as master_name, m.avatar_url as master_avatar, m.phone as master_phone,
                r.rating, r.comment as review_comment
             FROM orders o
             LEFT JOIN users c ON c.id = o.client_id
             LEFT JOIN users m ON m.id = o.master_id
             LEFT JOIN reviews r ON r.order_id = o.id
             WHERE o.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Buyurtma topilmadi',
            });
        }

        const order = result.rows[0];

        // Faqat tegishli foydalanuvchi ko'ra oladi
        if (order.client_id !== userId && order.master_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Bu buyurtmani ko\'rishga ruxsatingiz yo\'q',
            });
        }

        // Chat xabarlarini olish
        const messagesResult = await query(
            `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
             FROM messages m
             INNER JOIN users u ON u.id = m.sender_id
             WHERE m.order_id = $1
             ORDER BY m.created_at ASC`,
            [id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...order,
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
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Ruxsat etilgan holatlar
        const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
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

        // Ruxsat tekshirish
        if (userRole === 'client' && order.client_id !== userId) {
            return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
        }
        if (userRole === 'master' && order.master_id !== userId) {
            return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
        }

        // Yangilash
        const result = await query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        res.status(200).json({
            success: true,
            message: 'Buyurtma holati yangilandi',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createOrder, getOrders, getOrderById, updateOrderStatus };
