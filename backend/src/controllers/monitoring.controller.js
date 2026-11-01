// =============================================
// UyRemont - MVP o'lchovlari (statistika) va xatolar jurnali
// =============================================

const { query } = require('../config/database');
const config = require('../config/dispatch');
const { HttpError } = require('../middleware/errorHandler');
const { recordError } = require('../services/errorLog.service');
const { assertUuid } = require('../utils/validators');

// Brauzer kengaytmalari va ma'nosiz xabarlar jurnalni to'ldirmasligi uchun
const IGNORED_CLIENT_ERRORS = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:/i];

/**
 * Saytdagi xatoni yozish (ommaviy, cheklangan)
 * POST /api/client-errors
 * Body: { message, stack?, url? }
 */
const reportClientError = async (req, res, next) => {
    try {
        const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
        if (!message) throw new HttpError(400, 'Xato matni yo\'q');
        const stack = typeof req.body.stack === 'string' ? req.body.stack : null;
        if (!IGNORED_CLIENT_ERRORS.some((pattern) => pattern.test(message) || pattern.test(stack || ''))) {
            await recordError({
                source: 'client',
                message,
                stack,
                url: typeof req.body.url === 'string' ? req.body.url : null,
                userAgent: req.get('user-agent'),
            });
        }
        res.status(204).end();
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/admin/errors?resolved=false
 */
const listErrors = async (req, res, next) => {
    try {
        const resolved = req.query.resolved === 'true';
        const result = await query(
            `SELECT id, source, message, stack, url, user_agent, count, first_seen, last_seen, resolved
             FROM error_logs WHERE resolved = $1 ORDER BY last_seen DESC LIMIT 100`,
            [resolved]
        );
        const open = await query('SELECT COUNT(*)::int as total FROM error_logs WHERE resolved = FALSE');
        res.status(200).json({ success: true, data: result.rows, open: open.rows[0].total });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/admin/errors/:id/resolve
 */
const resolveError = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Xato topilmadi');
        const result = await query('UPDATE error_logs SET resolved = TRUE WHERE id = $1 RETURNING id', [id]);
        if (!result.rows[0]) throw new HttpError(404, 'Xato topilmadi');
        res.status(200).json({ success: true, message: 'Hal qilindi deb belgilandi' });
    } catch (error) {
        next(error);
    }
};

/**
 * MVP o'lchovlari: kunlik buyurtmalar, usta topilish darajasi, kutish vaqti, daromad, sohalar bo'yicha talab
 * GET /api/admin/analytics?days=14
 */
const getAnalytics = async (req, res, next) => {
    try {
        const days = Math.min(90, Math.max(7, Number.parseInt(req.query.days, 10) || 14));
        const since = `CURRENT_DATE - (${days - 1} * INTERVAL '1 day')`;

        const [daily, kpi, bySpec, hourly, support, ledger] = await Promise.all([
            query(
                `SELECT d::date as day,
                    (SELECT COUNT(*)::int FROM orders o WHERE o.created_at::date = d::date AND o.mode = 'instant') as instant,
                    (SELECT COUNT(*)::int FROM orders o WHERE o.created_at::date = d::date AND o.mode = 'catalog') as catalog,
                    (SELECT COUNT(*)::int FROM orders o WHERE o.created_at::date = d::date AND o.mode = 'instant' AND o.accepted_at IS NOT NULL) as instant_found,
                    (SELECT COUNT(*)::int FROM orders o WHERE COALESCE(o.completed_at, o.updated_at)::date = d::date AND o.status = 'completed') as completed,
                    (SELECT COALESCE(SUM(COALESCE(o.final_price, o.budget, 0)), 0) FROM orders o
                       WHERE COALESCE(o.completed_at, o.updated_at)::date = d::date AND o.status = 'completed') as revenue,
                    (SELECT COUNT(*)::int FROM users u WHERE u.created_at::date = d::date AND u.role = 'client') as new_clients,
                    (SELECT COUNT(*)::int FROM users u WHERE u.created_at::date = d::date AND u.role = 'master') as new_masters
                 FROM generate_series(${since}, CURRENT_DATE, INTERVAL '1 day') d
                 ORDER BY d`
            ),
            query(
                `SELECT
                    COUNT(*) FILTER (WHERE mode = 'instant')::int as instant_total,
                    COUNT(*) FILTER (WHERE mode = 'instant' AND accepted_at IS NOT NULL)::int as instant_found,
                    COUNT(*) FILTER (WHERE mode = 'instant' AND status = 'expired')::int as instant_expired,
                    COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_by = 'client')::int as cancelled_by_client,
                    COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_by = 'master')::int as cancelled_by_master,
                    COUNT(*) FILTER (WHERE late_cancel)::int as late_cancels,
                    COALESCE(SUM(COALESCE(final_price, budget, 0)) FILTER (WHERE status = 'completed'), 0) as revenue,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM accepted_at - search_started_at))
                        FILTER (WHERE mode = 'instant' AND accepted_at IS NOT NULL AND search_started_at IS NOT NULL) as median_wait_sec,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM arrived_at - accepted_at))
                        FILTER (WHERE mode = 'instant' AND arrived_at IS NOT NULL) as median_arrival_sec,
                    COUNT(DISTINCT client_id) FILTER (WHERE status = 'completed')::int as paying_clients,
                    (SELECT COUNT(*)::int FROM (
                        SELECT client_id FROM orders
                        WHERE status = 'completed' AND created_at >= ${since}
                        GROUP BY client_id HAVING COUNT(*) > 1
                    ) r) as repeat_clients,
                    (SELECT COALESCE(AVG(rating), 0)::DECIMAL(3,2) FROM reviews WHERE created_at >= ${since}) as avg_rating
                 FROM orders WHERE created_at >= ${since}`
            ),
            query(
                `SELECT s.id, s.name_uz, s.icon,
                        COUNT(o.id) FILTER (WHERE o.mode = 'instant')::int as instant,
                        COUNT(o.id) FILTER (WHERE o.mode = 'instant' AND o.accepted_at IS NOT NULL)::int as found,
                        COUNT(o.id)::int as total,
                        (SELECT COUNT(*)::int FROM master_specializations ms
                           JOIN master_profiles mp ON mp.id = ms.master_id JOIN users u ON u.id = mp.user_id
                           WHERE ms.specialization_id = s.id AND u.is_active = TRUE AND mp.is_verified = TRUE) as verified_masters
                 FROM specializations s
                 LEFT JOIN orders o ON o.specialization_id = s.id AND o.created_at >= ${since}
                 WHERE s.is_active = TRUE
                 GROUP BY s.id
                 HAVING COUNT(o.id) > 0
                 ORDER BY total DESC
                 LIMIT 12`
            ),
            query(
                `SELECT h as hour, COUNT(o.id)::int as orders
                 FROM generate_series(0, 23) h
                 LEFT JOIN orders o ON EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'Asia/Tashkent') = h
                                   AND o.created_at >= ${since} AND o.mode = 'instant'
                 GROUP BY h ORDER BY h`
            ),
            query(
                `SELECT COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int as open,
                        COUNT(*) FILTER (WHERE created_at >= ${since})::int as period
                 FROM support_tickets`
            ),
            // Komissiya hisobi: davr ichida yozilgan va ustalardan qabul qilingan
            query(
                `SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'commission'), 0) as accrued,
                        COALESCE(-SUM(amount) FILTER (WHERE kind = 'payment'), 0) as paid,
                        (SELECT COALESCE(SUM(commission_due), 0) FROM master_profiles WHERE commission_due > 0) as outstanding
                 FROM master_ledger WHERE created_at >= ${since}`
            ),
        ]);

        const k = kpi.rows[0];
        const revenue = Number(k.revenue);
        res.status(200).json({
            success: true,
            data: {
                days,
                daily: daily.rows.map((row) => ({ ...row, revenue: Number(row.revenue) })),
                kpi: {
                    instant_total: k.instant_total,
                    instant_found: k.instant_found,
                    instant_expired: k.instant_expired,
                    found_rate: k.instant_total ? Math.round((k.instant_found / k.instant_total) * 100) : null,
                    median_wait_sec: k.median_wait_sec === null ? null : Math.round(Number(k.median_wait_sec)),
                    median_arrival_sec: k.median_arrival_sec === null ? null : Math.round(Number(k.median_arrival_sec)),
                    completed: k.completed,
                    cancelled_by_client: k.cancelled_by_client,
                    cancelled_by_master: k.cancelled_by_master,
                    late_cancels: k.late_cancels,
                    revenue,
                    commission: Number(ledger.rows[0].accrued),
                    commission_paid: Number(ledger.rows[0].paid),
                    commission_outstanding: Number(ledger.rows[0].outstanding),
                    commission_percent: config.COMMISSION_PERCENT,
                    paying_clients: k.paying_clients,
                    repeat_clients: k.repeat_clients,
                    avg_rating: Number(k.avg_rating),
                    open_tickets: support.rows[0].open,
                    tickets_in_period: support.rows[0].period,
                },
                by_specialization: bySpec.rows,
                hourly: hourly.rows,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin panel bo'limlaridagi hisoblagichlar (navbatlar)
 * GET /api/admin/queues
 */
const getQueues = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT
                (SELECT COUNT(*)::int FROM support_tickets WHERE status IN ('open', 'in_progress')) as tickets,
                (SELECT COUNT(*)::int FROM master_profiles mp JOIN users u ON u.id = mp.user_id
                   WHERE u.role = 'master' AND u.is_active = TRUE AND mp.is_verified = FALSE
                     AND mp.verification_requested_at IS NOT NULL
                     AND (mp.verification_rejected_at IS NULL OR mp.verification_rejected_at < mp.verification_requested_at)) as verifications,
                (SELECT COUNT(*)::int FROM error_logs WHERE resolved = FALSE) as errors,
                -- Komissiya: limitdan oshgan ustalar + tekshirilmagan to'lov farqlari
                (SELECT COUNT(*)::int FROM master_profiles mp JOIN users u ON u.id = mp.user_id
                   WHERE u.role = 'master' AND u.deleted_at IS NULL
                     AND $1::numeric > 0 AND mp.commission_due > $1::numeric)
                + (SELECT COUNT(*)::int FROM orders WHERE payment_review = 'pending') as commission`,
            [config.COMMISSION_DEBT_LIMIT]
        );
        res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

module.exports = { reportClientError, listErrors, resolveError, getAnalytics, getQueues };
