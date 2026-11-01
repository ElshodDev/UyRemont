// =============================================
// UyRemont - Komissiya hisobi (qo'lda yig'ish):
// buyurtma yakuniy summasi bilan yakunlanganda ustaning qarziga komissiya yoziladi (tezkor chaqiruv -
// COMMISSION_PERCENT, oddiy buyurtma - CATALOG_COMMISSION_PERCENT), administrator to'lovni qabul qilib
// qarzni kamaytiradi. Qarz COMMISSION_DEBT_LIMIT dan oshsa usta ishga chiqa olmaydi, taklif va yangi buyurtma olmaydi.
// =============================================

const config = require('../config/dispatch');
const { query } = require('../config/database');
const { emitToUser } = require('./dispatch.service');
const { notifyUser } = require('./telegram/notify');
const { escapeHtml, urlButton, keyboard } = require('./telegram/client');
const { tr, translate } = require('../i18n');

const PAYMENT_METHODS = ['card', 'cash', 'transfer', 'other'];

const formatSum = (value) => `${Math.round(Number(value) || 0).toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`;

const hasLimit = () => config.COMMISSION_DEBT_LIMIT > 0;
const isOverLimit = (due) => hasLimit() && Number(due) > config.COMMISSION_DEBT_LIMIT;

/**
 * Hisobga yozuv qo'shish va qarzning tezkor nusxasini yangilash (tranzaksiya ichida chaqiriladi)
 * @param {import('pg').PoolClient} client
 * @param {{ masterId: string, kind: 'commission'|'payment'|'adjustment', amount: number, orderId?: string,
 *           percent?: number, baseAmount?: number, method?: string, note?: string, createdBy?: string }} entry
 * @returns {Promise<{ entry: object, due: number }>}
 */
const addLedgerEntry = async (client, entry) => {
    const inserted = await client.query(
        `INSERT INTO master_ledger (master_id, kind, amount, order_id, percent, base_amount, method, note, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [entry.masterId, entry.kind, entry.amount, entry.orderId || null, entry.percent ?? null,
            entry.baseAmount ?? null, entry.method || null, entry.note || null, entry.createdBy || null]
    );
    const profile = await client.query(
        `UPDATE master_profiles SET commission_due = commission_due + $2
         WHERE user_id = $1 RETURNING commission_due`,
        [entry.masterId, entry.amount]
    );
    return { entry: inserted.rows[0], due: Number(profile.rows[0]?.commission_due || 0) };
};

/**
 * Buyurtma turiga qarab komissiya foizi: tezkor chaqiruv yoki oddiy (katalog) buyurtma
 */
const commissionPercentFor = (order) => (order.mode === 'instant' ? config.COMMISSION_PERCENT : config.CATALOG_COMMISSION_PERCENT);

/**
 * Yakuniy summasi bilan yakunlangan buyurtma uchun komissiya (foiz yozilgan paytdagisi saqlanadi; takror yozilmaydi)
 * @returns {Promise<{ amount: number, due: number }|null>}
 */
const accrueCommission = async (client, order) => {
    // Komissiya ish haqidan (materiallarsiz); ish haqi yozilmagan eski buyurtmalarda - yakuniy summadan
    const base = Number(order.labor_price ?? order.final_price) || 0;
    const percent = commissionPercentFor(order);
    if (!order.master_id || base <= 0 || percent <= 0) return null;
    const amount = Math.round((base * percent) / 100);
    if (amount <= 0) return null;

    const inserted = await client.query(
        `INSERT INTO master_ledger (master_id, kind, amount, order_id, percent, base_amount)
         VALUES ($1, 'commission', $2, $3, $4, $5)
         ON CONFLICT (order_id) WHERE kind = 'commission' DO NOTHING
         RETURNING id`,
        [order.master_id, amount, order.id, percent, base]
    );
    if (!inserted.rows[0]) return null;
    const profile = await client.query(
        `UPDATE master_profiles SET commission_due = commission_due + $2
         WHERE user_id = $1 RETURNING commission_due`,
        [order.master_id, amount]
    );
    return { amount, due: Number(profile.rows[0]?.commission_due || 0) };
};

/**
 * Ustaga xabar: saytda (socket) va Telegram'da. message o'zbekcha yoziladi va ustaning tiliga tarjima qilinadi
 */
const notifyCommission = (masterId, { due, message, telegram = true }) => {
    emitToUser(masterId, 'commission_updated', (lang) => ({
        due, limit: config.COMMISSION_DEBT_LIMIT, blocked: isOverLimit(due), message: translate(lang, message),
    }));
    if (telegram) {
        notifyUser(
            masterId,
            (lang) => `💳 ${escapeHtml(translate(lang, message))}`,
            (lang) => keyboard([[urlButton(tr(lang, 'Komissiya hisobi'), '/master/hisob')]])
        ).catch(() => {});
    }
};

/**
 * Komissiya yozilgandan keyin: qarz limitdan oshsa yoki unga yaqinlashsa ogohlantirish
 * (ish rejimi o'chgani ham shu hodisa orqali ko'rinadi: sayt holatni qayta yuklaydi)
 * @param {{ amount: number, due: number }} accrued
 */
const afterAccrual = (masterId, accrued) => {
    if (!accrued) return;
    const limit = config.COMMISSION_DEBT_LIMIT;
    if (isOverLimit(accrued.due)) {
        const message = `Komissiya qarzingiz ${formatSum(accrued.due)} — limitdan (${formatSum(limit)}) oshdi. `
            + 'To\'lamaguningizcha yangi takliflar kelmaydi.';
        notifyCommission(masterId, { due: accrued.due, message });
    } else if (hasLimit() && accrued.due >= limit * 0.8) {
        notifyCommission(masterId, {
            due: accrued.due,
            message: `Komissiya qarzingiz ${formatSum(accrued.due)}. Limit — ${formatSum(limit)}: oshsa, takliflar to'xtaydi.`,
        });
    } else {
        notifyCommission(masterId, { due: accrued.due, message: `Komissiya yozildi: ${formatSum(accrued.amount)}`, telegram: false });
    }
};

/**
 * Ustaning hisobi: qarz, limit, rekvizitlar, jami summalar va yozuvlar
 */
const loadMasterLedger = async (masterId, { limit = 100 } = {}) => {
    const [profile, totals, entries] = await Promise.all([
        query('SELECT commission_due FROM master_profiles WHERE user_id = $1', [masterId]),
        query(
            `SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'commission'), 0) as commission_total,
                    COALESCE(-SUM(amount) FILTER (WHERE kind = 'payment'), 0) as paid_total,
                    COALESCE(SUM(amount) FILTER (WHERE kind = 'adjustment'), 0) as adjustments_total,
                    COALESCE(-SUM(amount) FILTER (WHERE kind = 'bonus'), 0) as bonus_total,
                    MAX(created_at) FILTER (WHERE kind = 'payment') as last_payment_at
             FROM master_ledger WHERE master_id = $1`,
            [masterId]
        ),
        query(
            `SELECT l.id, l.kind, l.amount, l.order_id, l.percent, l.base_amount, l.method, l.note, l.created_at,
                    o.title as order_title, o.materials_price
             FROM master_ledger l LEFT JOIN orders o ON o.id = l.order_id
             WHERE l.master_id = $1
             ORDER BY l.created_at DESC
             LIMIT $2`,
            [masterId, limit]
        ),
    ]);
    if (!profile.rows[0]) return null;
    const due = Number(profile.rows[0].commission_due);
    const t = totals.rows[0];
    return {
        due,
        limit: config.COMMISSION_DEBT_LIMIT,
        percent: config.COMMISSION_PERCENT,
        catalog_percent: config.CATALOG_COMMISSION_PERCENT,
        blocked: isOverLimit(due),
        payment_info: config.COMMISSION_PAYMENT_INFO || null,
        totals: {
            commission: Number(t.commission_total),
            paid: Number(t.paid_total),
            adjustments: Number(t.adjustments_total),
            bonus: Number(t.bonus_total),
            last_payment_at: t.last_payment_at,
        },
        entries: entries.rows.map((row) => ({
            ...row,
            amount: Number(row.amount),
            base_amount: row.base_amount === null ? null : Number(row.base_amount),
            percent: row.percent === null ? null : Number(row.percent),
            materials_price: row.materials_price === null || row.materials_price === undefined ? null : Number(row.materials_price),
        })),
    };
};

module.exports = {
    PAYMENT_METHODS,
    formatSum,
    isOverLimit,
    addLedgerEntry,
    accrueCommission,
    afterAccrual,
    notifyCommission,
    loadMasterLedger,
    commissionPercentFor,
};
