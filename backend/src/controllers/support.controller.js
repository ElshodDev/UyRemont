// =============================================
// UyRemont - Murojaatlar markazi: mijoz va usta muammoni yuboradi, administrator hal qiladi
// =============================================

const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { logAdminAction } = require('../services/audit.service');
const { emitToUser } = require('../services/dispatch.service');
const { notifyUser } = require('../services/telegram/notify');
const { escapeHtml, urlButton, keyboard } = require('../services/telegram/client');
const { assertUuid, optionalString, requiredString } = require('../utils/validators');
const { tr } = require('../i18n');

// Kim qaysi turdagi murojaatni yubora oladi
const CATEGORIES = {
    master_no_show: ['client'],
    price_dispute: ['client', 'master'],
    quality: ['client'],
    client_no_pay: ['master'],
    behavior: ['client', 'master'],
    app_problem: ['client', 'master'],
    other: ['client', 'master'],
};
const STATUSES = ['open', 'in_progress', 'resolved', 'rejected'];
const MAX_OPEN_TICKETS = 5;
const MAX_TICKETS_PER_DAY = 10;

const STATUS_TEXT = {
    in_progress: 'ko\'rib chiqilmoqda',
    resolved: 'hal qilindi',
    rejected: 'rad etildi',
};

/**
 * Qo'llab-quvvatlash kontaktlari (ommaviy): SUPPORT_PHONE, SUPPORT_TELEGRAM
 * GET /api/support/contacts
 */
const getContacts = (req, res) => {
    const telegram = (process.env.SUPPORT_TELEGRAM || '').trim().replace(/^@/, '');
    res.status(200).json({
        success: true,
        data: {
            phone: (process.env.SUPPORT_PHONE || '').trim() || null,
            telegram: /^[A-Za-z0-9_]{5,32}$/.test(telegram) ? telegram : null,
        },
    });
};

/**
 * Murojaat yuborish
 * POST /api/support
 * Body: { category, message, order_id? }
 */
const createTicket = async (req, res, next) => {
    try {
        const { id: userId, role } = req.user;
        const category = String(req.body.category || '');
        const allowedRoles = CATEGORIES[category];
        if (!allowedRoles) throw new HttpError(400, 'Murojaat turini tanlang');
        // Administrator o'zi murojaat yubormaydi; mijoz/usta faqat o'z turlarini tanlaydi
        if (!allowedRoles.includes(role)) throw new HttpError(400, 'Bu turdagi murojaat sizning hisobingiz uchun emas');
        const message = requiredString(req.body.message, { min: 10, max: 2000, field: 'Muammo tavsifi' });

        let orderId = null;
        if (req.body.order_id) {
            orderId = assertUuid(req.body.order_id, 'Buyurtma topilmadi');
            const order = await query('SELECT client_id, master_id FROM orders WHERE id = $1', [orderId]);
            const row = order.rows[0];
            if (!row || (row.client_id !== userId && row.master_id !== userId)) {
                throw new HttpError(404, 'Buyurtma topilmadi');
            }
        } else if (category !== 'app_problem' && category !== 'other') {
            throw new HttpError(400, 'Bu turdagi murojaat buyurtma sahifasidan yuboriladi');
        }

        const limits = await query(
            `SELECT COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int as open,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')::int as today
             FROM support_tickets WHERE user_id = $1`,
            [userId]
        );
        if (limits.rows[0].open >= MAX_OPEN_TICKETS) {
            throw new HttpError(429, `Sizda ${MAX_OPEN_TICKETS} ta ochiq murojaat bor. Ular ko'rib chiqilishini kuting`);
        }
        if (limits.rows[0].today >= MAX_TICKETS_PER_DAY) {
            throw new HttpError(429, 'Bugun juda ko\'p murojaat yuborildi. Ertaga qayta urinib ko\'ring');
        }

        const result = await query(
            `INSERT INTO support_tickets (user_id, order_id, category, message)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, orderId, category, message]
        );
        res.status(201).json({
            success: true,
            message: `Murojaatingiz qabul qilindi (#${result.rows[0].number}). Javob shu yerda va Telegram'da ko'rinadi`,
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Foydalanuvchining murojaatlari
 * GET /api/support/my
 */
const listMyTickets = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT t.id, t.number, t.order_id, t.category, t.message, t.status, t.admin_reply,
                    t.created_at, t.updated_at, o.title as order_title
             FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id
             WHERE t.user_id = $1
             ORDER BY t.created_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: murojaatlar ro'yxati
 * GET /api/admin/support?status=open
 */
const listTickets = async (req, res, next) => {
    try {
        const status = STATUSES.includes(req.query.status) ? req.query.status : null;
        const [tickets, counts] = await Promise.all([
            query(
                `SELECT t.*, u.name as user_name, u.phone as user_phone, u.role as user_role,
                        o.title as order_title, o.status as order_status, o.mode as order_mode,
                        a.name as handled_by_name
                 FROM support_tickets t
                 JOIN users u ON u.id = t.user_id
                 LEFT JOIN orders o ON o.id = t.order_id
                 LEFT JOIN users a ON a.id = t.handled_by
                 WHERE ($1::text IS NULL OR t.status = $1)
                 ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at DESC
                 LIMIT 100`,
                [status]
            ),
            query('SELECT status, COUNT(*)::int as total FROM support_tickets GROUP BY status'),
        ]);
        res.status(200).json({
            success: true,
            data: tickets.rows,
            counts: Object.fromEntries(counts.rows.map((row) => [row.status, row.total])),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: holat va javob
 * PUT /api/admin/support/:id
 * Body: { status, admin_reply? }
 */
const updateTicket = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Murojaat topilmadi');
        const status = String(req.body.status || '');
        if (!STATUSES.includes(status) || status === 'open') throw new HttpError(400, 'Holatni tanlang');
        const reply = optionalString(req.body.admin_reply, { max: 2000, field: 'Javob' });
        if ((status === 'resolved' || status === 'rejected') && !reply) {
            throw new HttpError(400, 'Foydalanuvchiga javob yozing');
        }

        const before = await query('SELECT * FROM support_tickets WHERE id = $1', [id]);
        if (!before.rows[0]) throw new HttpError(404, 'Murojaat topilmadi');

        const result = await query(
            `UPDATE support_tickets
             SET status = $2, admin_reply = COALESCE($3, admin_reply), handled_by = $4, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, status, reply, req.user.id]
        );
        const ticket = result.rows[0];

        await logAdminAction(req, {
            action: 'support.update',
            targetUserId: ticket.user_id,
            targetOrderId: ticket.order_id,
            details: { number: Number(ticket.number), from: before.rows[0].status, to: status },
        });

        // Foydalanuvchiga xabar: saytda (socket) va Telegram'da
        emitToUser(ticket.user_id, 'support_updated', { id: ticket.id, number: ticket.number, status });
        notifyUser(
            ticket.user_id,
            (lang) => tr(lang, '📨 <b>Murojaat #{number}</b> {status}', { number: ticket.number, status: tr(lang, STATUS_TEXT[status]) })
                + (ticket.admin_reply ? `\n\n${escapeHtml(ticket.admin_reply)}` : ''),
            (lang) => keyboard([[urlButton(tr(lang, 'Murojaatlarim'), '/support')]])
        ).catch(() => {});

        res.status(200).json({ success: true, message: 'Murojaat yangilandi', data: ticket });
    } catch (error) {
        next(error);
    }
};

module.exports = { getContacts, createTicket, listMyTickets, listTickets, updateTicket, CATEGORIES };
