// =============================================
// UyRemont - Saqlangan manzillar ("Uy", "Ish"): usta chaqirishda bir bosishda tanlanadi
// =============================================

const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { assertUuid, optionalNumber, optionalString, requiredString } = require('../utils/validators');

const MAX_ADDRESSES = 10;
const FIELDS = 'id, label, address, district, lat, lng, created_at';

const parseCoords = (body) => {
    const lat = optionalNumber(body.lat, { min: -90, max: 90, field: 'Kenglik (lat)' });
    const lng = optionalNumber(body.lng, { min: -180, max: 180, field: 'Uzunlik (lng)' });
    // Ikkalasi birga beriladi yoki umuman berilmaydi
    return lat === null || lng === null ? { lat: null, lng: null } : { lat, lng };
};

/**
 * GET /api/addresses
 */
const listAddresses = async (req, res, next) => {
    try {
        const result = await query(
            `SELECT ${FIELDS} FROM saved_addresses WHERE user_id = $1 ORDER BY created_at ASC`,
            [req.user.id]
        );
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/addresses
 * Body: { label, address, district?, lat?, lng? }
 */
const createAddress = async (req, res, next) => {
    try {
        const label = requiredString(req.body.label, { min: 1, max: 40, field: 'Nomi' });
        const address = requiredString(req.body.address, { min: 3, max: 500, field: 'Manzil' });
        const district = optionalString(req.body.district, { max: 100, field: 'Tuman' });
        const { lat, lng } = parseCoords(req.body);

        const count = await query('SELECT COUNT(*)::int as total FROM saved_addresses WHERE user_id = $1', [req.user.id]);
        if (count.rows[0].total >= MAX_ADDRESSES) {
            throw new HttpError(400, `Ko'pi bilan ${MAX_ADDRESSES} ta manzil saqlash mumkin. Keraksizini o'chiring`);
        }

        const result = await query(
            `INSERT INTO saved_addresses (user_id, label, address, district, lat, lng)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${FIELDS}`,
            [req.user.id, label, address, district, lat, lng]
        );
        res.status(201).json({ success: true, message: 'Manzil saqlandi', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/addresses/:id
 * Body: { label?, address?, district? } (joylashuv yangi chaqiruvda belgilanadi)
 */
const updateAddress = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Manzil topilmadi');
        const label = optionalString(req.body.label, { max: 40, field: 'Nomi' });
        const address = optionalString(req.body.address, { max: 500, field: 'Manzil' });
        const district = optionalString(req.body.district, { max: 100, field: 'Tuman' });
        if (address !== null && address.length < 3) throw new HttpError(400, 'Manzil juda qisqa');

        const result = await query(
            `UPDATE saved_addresses
             SET label = COALESCE($3, label), address = COALESCE($4, address), district = COALESCE($5, district)
             WHERE id = $1 AND user_id = $2 RETURNING ${FIELDS}`,
            [id, req.user.id, label || null, address, district]
        );
        if (!result.rows[0]) throw new HttpError(404, 'Manzil topilmadi');
        res.status(200).json({ success: true, message: 'Manzil yangilandi', data: result.rows[0] });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/addresses/:id
 */
const deleteAddress = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Manzil topilmadi');
        const result = await query('DELETE FROM saved_addresses WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
        if (!result.rows[0]) throw new HttpError(404, 'Manzil topilmadi');
        res.status(200).json({ success: true, message: 'Manzil o\'chirildi' });
    } catch (error) {
        next(error);
    }
};

module.exports = { listAddresses, createAddress, updateAddress, deleteAddress, MAX_ADDRESSES };
