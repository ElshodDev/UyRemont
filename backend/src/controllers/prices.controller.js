// =============================================
// UyRemont - Taxminiy narxlar ro'yxati
// Mijoz "qancha turadi?" savoliga javobni oldindan ko'radi; administrator narxlarni tahrirlaydi
// =============================================

const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { logAdminAction } = require('../services/audit.service');
const { optionalNumber, requiredString } = require('../utils/validators');

const UNITS = ['ish', 'dona', 'kv.m', 'metr', 'komplekt', 'detal', 'soat'];
const MAX_PRICE = 1000000000;

/**
 * Mutaxassisliklar bo'yicha guruhlangan narxlar
 * @param {{ includeInactive?: boolean }} options - admin uchun yashirilgan qatorlar ham
 */
const loadPriceList = async ({ includeInactive = false } = {}) => {
    const result = await query(
        `SELECT s.id, s.slug, s.vertical, s.name_uz, s.icon, s.call_fee,
                COALESCE(
                    json_agg(json_build_object(
                        'id', p.id, 'name', p.name, 'price_min', p.price_min, 'price_max', p.price_max,
                        'unit', p.unit, 'sort_order', p.sort_order, 'is_active', p.is_active
                    ) ORDER BY p.sort_order, p.id) FILTER (WHERE p.id IS NOT NULL),
                    '[]'
                ) as items
         FROM specializations s
         LEFT JOIN price_items p ON p.specialization_id = s.id AND ($1::boolean OR p.is_active = TRUE)
         WHERE s.is_active = TRUE
         GROUP BY s.id
         ORDER BY array_position(ARRAY['home', 'auto', 'appliance', 'gadget']::text[], s.vertical::text), s.id`,
        [includeInactive]
    );
    return result.rows.map((row) => ({ ...row, call_fee: Number(row.call_fee) }));
};

/**
 * GET /api/prices (ommaviy)
 */
const getPrices = async (req, res, next) => {
    try {
        const data = await loadPriceList();
        res.set('Cache-Control', 'public, max-age=300');
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/admin/prices
 */
const getAdminPrices = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: await loadPriceList({ includeInactive: true }), units: UNITS });
    } catch (error) {
        next(error);
    }
};

const parsePriceItem = (body) => {
    const name = requiredString(body.name, { min: 2, max: 200, field: 'Ish nomi' });
    const priceMin = optionalNumber(body.price_min, { min: 0, max: MAX_PRICE, integer: true, field: 'Eng kam narx' });
    if (priceMin === null) throw new HttpError(400, 'Eng kam narxni kiriting');
    const priceMax = optionalNumber(body.price_max, { min: 0, max: MAX_PRICE, integer: true, field: 'Eng ko\'p narx' });
    if (priceMax !== null && priceMax < priceMin) {
        throw new HttpError(400, 'Eng ko\'p narx eng kam narxdan kichik bo\'lmasligi kerak');
    }
    const unit = UNITS.includes(body.unit) ? body.unit : 'ish';
    const sortOrder = optionalNumber(body.sort_order, { min: 0, max: 1000, integer: true, field: 'Tartib' }) ?? 0;
    const isActive = body.is_active === undefined ? true : body.is_active === true;
    return { name, priceMin, priceMax, unit, sortOrder, isActive };
};

/**
 * POST /api/admin/prices
 */
const createPriceItem = async (req, res, next) => {
    try {
        const specializationId = optionalNumber(req.body.specialization_id, {
            min: 1, max: 100000, integer: true, field: 'Mutaxassislik',
        });
        const spec = specializationId && await query('SELECT id FROM specializations WHERE id = $1', [specializationId]);
        if (!spec || !spec.rows[0]) throw new HttpError(400, 'Mutaxassislikni tanlang');
        const item = parsePriceItem(req.body);

        const result = await query(
            `INSERT INTO price_items (specialization_id, name, price_min, price_max, unit, sort_order, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [specializationId, item.name, item.priceMin, item.priceMax, item.unit, item.sortOrder, item.isActive]
        );
        await logAdminAction(req, { action: 'price.create', details: { id: result.rows[0].id, name: item.name } });
        res.status(201).json({ success: true, message: 'Narx qo\'shildi', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/admin/prices/:id
 */
const updatePriceItem = async (req, res, next) => {
    try {
        const id = optionalNumber(req.params.id, { min: 1, max: 1e9, integer: true, field: 'ID' });
        const item = parsePriceItem(req.body);
        const before = await query('SELECT * FROM price_items WHERE id = $1', [id]);
        if (!before.rows[0]) throw new HttpError(404, 'Narx topilmadi');

        const result = await query(
            `UPDATE price_items
             SET name = $2, price_min = $3, price_max = $4, unit = $5, sort_order = $6, is_active = $7, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, item.name, item.priceMin, item.priceMax, item.unit, item.sortOrder, item.isActive]
        );
        const old = before.rows[0];
        await logAdminAction(req, {
            action: 'price.update',
            details: {
                id,
                name: item.name,
                from: { price_min: old.price_min, price_max: old.price_max, is_active: old.is_active },
                to: { price_min: item.priceMin, price_max: item.priceMax, is_active: item.isActive },
            },
        });
        res.status(200).json({ success: true, message: 'Narx saqlandi', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/admin/prices/:id
 */
const deletePriceItem = async (req, res, next) => {
    try {
        const id = optionalNumber(req.params.id, { min: 1, max: 1e9, integer: true, field: 'ID' });
        const result = await query('DELETE FROM price_items WHERE id = $1 RETURNING id, name', [id]);
        if (!result.rows[0]) throw new HttpError(404, 'Narx topilmadi');
        await logAdminAction(req, { action: 'price.delete', details: result.rows[0] });
        res.status(200).json({ success: true, message: 'Narx o\'chirildi' });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta chiqish narxi (tezkor chaqiruvda mijoz to'laydigan minimal summa)
 * PUT /api/admin/specializations/:id/call-fee
 */
const updateCallFee = async (req, res, next) => {
    try {
        const id = optionalNumber(req.params.id, { min: 1, max: 100000, integer: true, field: 'ID' });
        const callFee = optionalNumber(req.body.call_fee, { min: 0, max: 10000000, integer: true, field: 'Chiqish narxi' });
        if (callFee === null) throw new HttpError(400, 'Chiqish narxini kiriting');
        const before = await query('SELECT call_fee, name_uz FROM specializations WHERE id = $1', [id]);
        if (!before.rows[0]) throw new HttpError(404, 'Mutaxassislik topilmadi');

        await query('UPDATE specializations SET call_fee = $2 WHERE id = $1', [id, callFee]);
        await logAdminAction(req, {
            action: 'price.call_fee',
            details: { specialization: before.rows[0].name_uz, from: Number(before.rows[0].call_fee), to: callFee },
        });
        res.status(200).json({ success: true, message: 'Chiqish narxi saqlandi', data: { id, call_fee: callFee } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getPrices,
    getAdminPrices,
    createPriceItem,
    updatePriceItem,
    deletePriceItem,
    updateCallFee,
};
