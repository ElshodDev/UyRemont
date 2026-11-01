// =============================================
// UyRemont - Murojaatlar markazi: mijoz va usta muammoni yuboradi, administrator hal qiladi.
// Shikoyat - kimgadir qarshi murojaat (target_user_id): buyurtma bo'yicha (ikkinchi tomon) yoki
// usta profilidan (buyurtmasiz). Administrator ogohlantirish yuboradi yoki bloklaydi.
// =============================================

const { query, withTransaction } = require('../config/database');
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
    offsite_payment: ['client', 'master'],
    fraud: ['client', 'master'],
    fake_profile: ['client'],
    wrong_info: ['client'],
    inappropriate: ['client'],
    app_problem: ['client', 'master'],
    other: ['client', 'master'],
};
// Buyurtmaning ikkinchi tomoniga qarshi shikoyat (buyurtma sahifasidan)
const ORDER_COMPLAINTS = ['master_no_show', 'price_dispute', 'quality', 'client_no_pay', 'behavior', 'offsite_payment', 'fraud'];
// Usta profilidan, buyurtmasiz yuboriladigan shikoyat
const PROFILE_COMPLAINTS = ['fake_profile', 'wrong_info', 'offsite_payment', 'fraud', 'inappropriate', 'other'];
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
 * Murojaat yoki shikoyat yuborish
 * POST /api/support
 * Body: { category, message, order_id? } - buyurtma bo'yicha (shikoyat bo'lsa ikkinchi tomonga qarshi)
 *       { category, message?, target_user_id } - usta profilidan shikoyat (buyurtmasiz, izoh ixtiyoriy)
 */
const createTicket = async (req, res, next) => {
    try {
        const { id: userId, role } = req.user;
        const category = String(req.body.category || '');
        const allowedRoles = CATEGORIES[category];
        if (!allowedRoles) throw new HttpError(400, 'Murojaat turini tanlang');
        // Administrator o'zi murojaat yubormaydi; mijoz/usta faqat o'z turlarini tanlaydi
        if (!allowedRoles.includes(role)) throw new HttpError(400, 'Bu turdagi murojaat sizning hisobingiz uchun emas');

        let orderId = null;
        let targetId = null;
        let message;
        if (req.body.order_id) {
            orderId = assertUuid(req.body.order_id, 'Buyurtma topilmadi');
            const order = await query('SELECT client_id, master_id FROM orders WHERE id = $1', [orderId]);
            const row = order.rows[0];
            if (!row || (row.client_id !== userId && row.master_id !== userId)) {
                throw new HttpError(404, 'Buyurtma topilmadi');
            }
            if (ORDER_COMPLAINTS.includes(category)) {
                targetId = row.client_id === userId ? row.master_id : row.client_id;
            }
            message = requiredString(req.body.message, { min: 10, max: 2000, field: 'Muammo tavsifi' });
        } else if (req.body.target_user_id) {
            // Usta profilidan shikoyat
            targetId = assertUuid(req.body.target_user_id, 'Usta topilmadi');
            if (!PROFILE_COMPLAINTS.includes(category)) throw new HttpError(400, 'Shikoyat sababini tanlang');
            if (targetId === userId) throw new HttpError(400, 'O\'zingiz haqingizda shikoyat qila olmaysiz');
            const target = await query(
                'SELECT 1 FROM users u JOIN master_profiles mp ON mp.user_id = u.id WHERE u.id = $1 AND u.role = \'master\' AND u.deleted_at IS NULL',
                [targetId]
            );
            if (!target.rows[0]) throw new HttpError(404, 'Usta topilmadi');
            message = optionalString(req.body.message, { max: 2000, field: 'Izoh' }) || '';
            if (category === 'other' && message.length < 10) {
                throw new HttpError(400, 'Nima bo\'lganini yozing (kamida 10 belgi)');
            }
        } else if (category !== 'app_problem' && category !== 'other') {
            throw new HttpError(400, 'Bu turdagi murojaat buyurtma sahifasidan yuboriladi');
        } else {
            message = requiredString(req.body.message, { min: 10, max: 2000, field: 'Muammo tavsifi' });
        }

        const limits = await query(
            `SELECT COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int as open,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')::int as today,
                    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress') AND $2::uuid IS NOT NULL
                                     AND target_user_id = $2::uuid)::int as same_target
             FROM support_tickets WHERE user_id = $1`,
            [userId, targetId]
        );
        if (limits.rows[0].same_target > 0) {
            throw new HttpError(409, 'Bu foydalanuvchi haqidagi shikoyatingiz allaqachon ko\'rib chiqilmoqda');
        }
        if (limits.rows[0].open >= MAX_OPEN_TICKETS) {
            throw new HttpError(429, `Sizda ${MAX_OPEN_TICKETS} ta ochiq murojaat bor. Ular ko'rib chiqilishini kuting`);
        }
        if (limits.rows[0].today >= MAX_TICKETS_PER_DAY) {
            throw new HttpError(429, 'Bugun juda ko\'p murojaat yuborildi. Ertaga qayta urinib ko\'ring');
        }

        const result = await query(
            `INSERT INTO support_tickets (user_id, order_id, category, message, target_user_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, orderId, category, message, targetId]
        );
        res.status(201).json({
            success: true,
            message: targetId && !orderId
                ? `Shikoyatingiz qabul qilindi (#${result.rows[0].number}). Usta kim yuborganini bilmaydi`
                : `Murojaatingiz qabul qilindi (#${result.rows[0].number}). Javob shu yerda va Telegram'da ko'rinadi`,
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
        const [tickets, warnings] = await Promise.all([
            query(
                `SELECT t.id, t.number, t.order_id, t.category, t.message, t.status, t.admin_reply,
                        t.created_at, t.updated_at, o.title as order_title, t.target_user_id, tu.name as target_name
                 FROM support_tickets t
                 LEFT JOIN orders o ON o.id = t.order_id
                 LEFT JOIN users tu ON tu.id = t.target_user_id
                 WHERE t.user_id = $1
                 ORDER BY t.created_at DESC LIMIT 50`,
                [req.user.id]
            ),
            // Foydalanuvchiga berilgan ogohlantirishlar (kim shikoyat qilgani ko'rsatilmaydi)
            query(
                'SELECT id, message, created_at FROM user_warnings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
                [req.user.id]
            ),
        ]);
        res.status(200).json({ success: true, data: tickets.rows, warnings: warnings.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: murojaatlar ro'yxati
 * GET /api/admin/support?status=open&kind=complaint
 * Shikoyatlarda: kimga qarshi, unga qarshi jami shikoyatlar (turli odamlardan), ogohlantirishlar soni
 */
const listTickets = async (req, res, next) => {
    try {
        const status = STATUSES.includes(req.query.status) ? req.query.status : null;
        const complaintsOnly = req.query.kind === 'complaint';
        const [tickets, counts] = await Promise.all([
            query(
                `SELECT t.*, u.name as user_name, u.phone as user_phone, u.role as user_role,
                        o.title as order_title, o.status as order_status, o.mode as order_mode,
                        a.name as handled_by_name,
                        tu.name as target_name, tu.phone as target_phone, tu.role as target_role, tu.is_active as target_is_active,
                        ts.complaints_total as target_complaints, ts.reporters as target_reporters, ts.open_complaints as target_open,
                        (SELECT COUNT(*)::int FROM user_warnings w WHERE w.user_id = t.target_user_id) as target_warnings
                 FROM support_tickets t
                 JOIN users u ON u.id = t.user_id
                 LEFT JOIN orders o ON o.id = t.order_id
                 LEFT JOIN users a ON a.id = t.handled_by
                 LEFT JOIN users tu ON tu.id = t.target_user_id
                 LEFT JOIN LATERAL (
                     SELECT COUNT(*)::int as complaints_total,
                            COUNT(DISTINCT s.user_id)::int as reporters,
                            COUNT(*) FILTER (WHERE s.status IN ('open', 'in_progress'))::int as open_complaints
                     FROM support_tickets s WHERE s.target_user_id = t.target_user_id
                 ) ts ON t.target_user_id IS NOT NULL
                 WHERE ($1::text IS NULL OR t.status = $1)
                   AND (NOT $2::boolean OR t.target_user_id IS NOT NULL)
                 ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at DESC
                 LIMIT 100`,
                [status, complaintsOnly]
            ),
            query(
                `SELECT status, COUNT(*)::int as total FROM support_tickets
                 WHERE (NOT $1::boolean OR target_user_id IS NOT NULL) GROUP BY status`,
                [complaintsOnly]
            ),
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

/**
 * Admin: foydalanuvchiga ogohlantirish (shikoyat bo'yicha). Saytda, Telegram'da va "Murojaatlarim" da ko'rinadi
 * POST /api/admin/users/:id/warnings
 * Body: { message, ticket_id? }
 */
const warnUser = async (req, res, next) => {
    try {
        const userId = assertUuid(req.params.id, 'Foydalanuvchi topilmadi');
        const message = requiredString(req.body.message, { min: 10, max: 1000, field: 'Ogohlantirish matni' });
        const ticketId = req.body.ticket_id ? assertUuid(req.body.ticket_id, 'Murojaat topilmadi') : null;

        const warning = await withTransaction(async (client) => {
            const user = await client.query('SELECT id, role FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
            if (!user.rows[0]) throw new HttpError(404, 'Foydalanuvchi topilmadi');
            if (user.rows[0].role === 'admin') throw new HttpError(400, 'Administratorga ogohlantirish yuborilmaydi');
            if (ticketId) {
                const ticket = await client.query('SELECT 1 FROM support_tickets WHERE id = $1 AND target_user_id = $2', [ticketId, userId]);
                if (!ticket.rows[0]) throw new HttpError(404, 'Murojaat topilmadi');
            }
            const inserted = await client.query(
                `INSERT INTO user_warnings (user_id, ticket_id, message, created_by)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, ticketId, message, req.user.id]
            );
            return inserted.rows[0];
        });

        await logAdminAction(req, { action: 'user.warn', targetUserId: userId, details: { message, ticket_id: ticketId } });
        emitToUser(userId, 'account_warning', { id: warning.id, message });
        notifyUser(
            userId,
            (lang) => `${tr(lang, '⚠️ <b>Usta24 ogohlantirishi</b>')}\n\n${escapeHtml(message)}\n\n${tr(lang, 'Takrorlansa, hisob bloklanishi mumkin.')}`,
            (lang) => keyboard([[urlButton(tr(lang, 'Ishlash qoidalari'), '/rules')]])
        ).catch(() => {});

        res.status(201).json({ success: true, message: 'Ogohlantirish yuborildi', data: warning });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getContacts, createTicket, listMyTickets, listTickets, updateTicket, warnUser, CATEGORIES,
};
