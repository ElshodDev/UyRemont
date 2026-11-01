// =============================================
// UyRemont - Komissiya hisobi: usta o'z qarzini ko'radi, administrator to'lovlarni qabul qiladi
// =============================================

const config = require('../config/dispatch');
const { query, withTransaction } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { logAdminAction } = require('../services/audit.service');
const {
    PAYMENT_METHODS, formatSum, isOverLimit, addLedgerEntry, notifyCommission, loadMasterLedger,
} = require('../services/commission.service');
const { assertUuid, optionalNumber, optionalString, requiredString } = require('../utils/validators');

const MAX_AMOUNT = 1000000000;
const FILTERS = ['debtors', 'over_limit', 'all'];

const dueText = (due) => {
    if (due > 0) return `Qolgan qarz: ${formatSum(due)}`;
    if (due < 0) return `Oldindan to'langan: ${formatSum(-due)}`;
    return 'Qarzingiz yo\'q';
};

/**
 * Usta: o'z komissiya hisobi
 * GET /api/masters/me/commission
 */
const getMyCommission = async (req, res, next) => {
    try {
        const ledger = await loadMasterLedger(req.user.id);
        if (!ledger) throw new HttpError(404, 'Usta profili topilmadi');
        res.status(200).json({ success: true, data: ledger });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: ustalar qarzi ro'yxati va umumiy ko'rsatkichlar
 * GET /api/admin/commission?filter=debtors|over_limit|all&q=
 */
const listCommission = async (req, res, next) => {
    try {
        const filter = FILTERS.includes(req.query.filter) ? req.query.filter : 'debtors';
        const search = optionalString(req.query.q, { max: 50, field: 'Qidiruv' });
        const limit = config.COMMISSION_DEBT_LIMIT;

        const conditions = ['u.role = \'master\'', 'u.deleted_at IS NULL'];
        const params = [];
        if (filter === 'debtors') conditions.push('mp.commission_due > 0');
        if (filter === 'over_limit') conditions.push(limit > 0 ? `mp.commission_due > ${Number(limit)}` : 'FALSE');
        if (search) {
            params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`);
            conditions.push(`(u.name ILIKE $${params.length} OR u.phone LIKE $${params.length})`);
        }

        const [masters, summary, period] = await Promise.all([
            query(
                `SELECT u.id, u.name, u.phone, u.is_active, mp.commission_due, mp.is_online, mp.is_verified,
                        s.commission_total, s.paid_total, s.last_payment_at
                 FROM master_profiles mp
                 JOIN users u ON u.id = mp.user_id
                 LEFT JOIN LATERAL (
                     SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'commission'), 0) as commission_total,
                            COALESCE(-SUM(amount) FILTER (WHERE kind = 'payment'), 0) as paid_total,
                            MAX(created_at) FILTER (WHERE kind = 'payment') as last_payment_at
                     FROM master_ledger l WHERE l.master_id = u.id
                 ) s ON TRUE
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY mp.commission_due DESC, u.name
                 LIMIT 100`,
                params
            ),
            query(
                `SELECT COALESCE(SUM(mp.commission_due) FILTER (WHERE mp.commission_due > 0), 0) as total_due,
                        COUNT(*) FILTER (WHERE mp.commission_due > 0)::int as debtors,
                        COUNT(*) FILTER (WHERE $1::numeric > 0 AND mp.commission_due > $1::numeric)::int as over_limit,
                        COUNT(*)::int as all_masters
                 FROM master_profiles mp JOIN users u ON u.id = mp.user_id
                 WHERE u.role = 'master' AND u.deleted_at IS NULL`,
                [limit]
            ),
            query(
                `SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'commission'), 0) as accrued,
                        COALESCE(-SUM(amount) FILTER (WHERE kind = 'payment'), 0) as collected
                 FROM master_ledger WHERE created_at > NOW() - INTERVAL '30 days'`
            ),
        ]);

        const s = summary.rows[0];
        res.status(200).json({
            success: true,
            data: masters.rows.map((row) => ({
                ...row,
                commission_due: Number(row.commission_due),
                commission_total: Number(row.commission_total),
                paid_total: Number(row.paid_total),
                over_limit: isOverLimit(row.commission_due),
            })),
            summary: {
                total_due: Number(s.total_due),
                debtors: s.debtors,
                over_limit: s.over_limit,
                accrued_30d: Number(period.rows[0].accrued),
                collected_30d: Number(period.rows[0].collected),
                limit,
                percent: config.COMMISSION_PERCENT,
            },
            counts: { debtors: s.debtors, over_limit: s.over_limit, all: s.all_masters },
        });
    } catch (error) {
        next(error);
    }
};

const loadMaster = async (masterId) => {
    const id = assertUuid(masterId, 'Usta topilmadi');
    const result = await query(
        `SELECT u.id, u.name, u.phone FROM users u JOIN master_profiles mp ON mp.user_id = u.id
         WHERE u.id = $1 AND u.role = 'master'`,
        [id]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Usta topilmadi');
    return result.rows[0];
};

/**
 * Admin: bitta ustaning hisobi (barcha yozuvlar)
 * GET /api/admin/commission/:masterId
 */
const getMasterCommission = async (req, res, next) => {
    try {
        const master = await loadMaster(req.params.masterId);
        const ledger = await loadMasterLedger(master.id, { limit: 300 });
        res.status(200).json({ success: true, data: { master, ...ledger } });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: ustadan to'lov qabul qilish (qarz kamayadi)
 * POST /api/admin/commission/:masterId/payments
 * Body: { amount, method: card|cash|transfer|other, note? }
 */
const recordPayment = async (req, res, next) => {
    try {
        const master = await loadMaster(req.params.masterId);
        const amount = optionalNumber(req.body.amount, { min: 1, max: MAX_AMOUNT, field: 'To\'lov summasi' });
        if (amount === null) throw new HttpError(400, 'To\'lov summasini kiriting');
        const method = String(req.body.method || '');
        if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'To\'lov usulini tanlang');
        const note = optionalString(req.body.note, { max: 300, field: 'Izoh' });
        const sum = Math.round(amount);

        const before = await query('SELECT commission_due FROM master_profiles WHERE user_id = $1', [master.id]);
        const wasBlocked = isOverLimit(before.rows[0].commission_due);
        const { entry, due } = await withTransaction((client) => addLedgerEntry(client, {
            masterId: master.id, kind: 'payment', amount: -sum, method, note, createdBy: req.user.id,
        }));

        await logAdminAction(req, {
            action: 'commission.payment',
            targetUserId: master.id,
            details: { amount: sum, method, due_after: due },
        });
        notifyCommission(master.id, {
            due,
            message: `To'lov qabul qilindi: ${formatSum(sum)}. ${dueText(due)}.`
                + (wasBlocked && !isOverLimit(due) ? ' Endi ishga chiqishingiz mumkin.' : ''),
        });

        res.status(201).json({ success: true, message: `To'lov qabul qilindi. ${dueText(due)}`, data: { entry, due } });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: hisobni tuzatish (xato yozuv, chegirma, jarima). Musbat - qarz oshadi, manfiy - kamayadi
 * POST /api/admin/commission/:masterId/adjustments
 * Body: { amount, note }
 */
const recordAdjustment = async (req, res, next) => {
    try {
        const master = await loadMaster(req.params.masterId);
        const amount = optionalNumber(req.body.amount, { min: -MAX_AMOUNT, max: MAX_AMOUNT, field: 'Summa' });
        const sum = Math.round(amount || 0);
        if (!sum) throw new HttpError(400, 'Tuzatish summasini kiriting (qarzni kamaytirish uchun manfiy)');
        const note = requiredString(req.body.note, { min: 5, max: 300, field: 'Sabab' });

        const { entry, due } = await withTransaction((client) => addLedgerEntry(client, {
            masterId: master.id, kind: 'adjustment', amount: sum, note, createdBy: req.user.id,
        }));

        await logAdminAction(req, {
            action: 'commission.adjust',
            targetUserId: master.id,
            details: { amount: sum, note, due_after: due },
        });
        notifyCommission(master.id, {
            due,
            message: `Komissiya hisobingiz tuzatildi: ${sum > 0 ? '+' : '−'}${formatSum(Math.abs(sum))} (${note}). ${dueText(due)}.`,
        });

        res.status(201).json({ success: true, message: `Hisob tuzatildi. ${dueText(due)}`, data: { entry, due } });
    } catch (error) {
        next(error);
    }
};

module.exports = { getMyCommission, listCommission, getMasterCommission, recordPayment, recordAdjustment };
