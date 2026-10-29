// =============================================
// UyRemont - Buyurtma rasmlari (mijoz muammoni rasmga oladi, usta oldindan ko'radi)
// Rasm avval "qoralama" sifatida yuklanadi, buyurtma yaratilganda unga biriktiriladi.
// =============================================

const fs = require('fs/promises');
const path = require('path');
const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { ORDER_PHOTO_DIR } = require('../middleware/upload');
const { saveUploadedImage } = require('../utils/images');
const { assertUuid, isUuid } = require('../utils/validators');

const MAX_PHOTOS_PER_ORDER = 3;
// Biriktirilmagan rasmlar soni chegarasi (bir foydalanuvchi uchun, 24 soat ichida)
const MAX_DRAFTS_PER_USER = 12;
const DRAFT_TTL_HOURS = 24;

const removeFiles = (fileNames) => Promise.all(
    fileNames.map((name) => fs.unlink(path.join(ORDER_PHOTO_DIR, path.basename(name))).catch(() => {}))
);

/**
 * Buyurtmaga biriktirilmay qolgan eski qoralamalarni o'chirish
 */
const cleanupDrafts = async () => {
    const result = await query(
        `DELETE FROM order_photos
         WHERE id IN (
             SELECT id FROM order_photos
             WHERE order_id IS NULL AND created_at < NOW() - ($1 * INTERVAL '1 hour')
             LIMIT 100
         )
         RETURNING file_name`,
        [DRAFT_TTL_HOURS]
    );
    await removeFiles(result.rows.map((row) => row.file_name));
};

/**
 * Body dagi photo_ids ni tekshirish (ko'pi bilan 3 ta UUID)
 */
const parsePhotoIds = (value) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > MAX_PHOTOS_PER_ORDER || !value.every(isUuid)) {
        throw new HttpError(400, `Ko'pi bilan ${MAX_PHOTOS_PER_ORDER} ta rasm biriktirish mumkin`);
    }
    return [...new Set(value)];
};

/**
 * Qoralama rasmlarni yangi buyurtmaga biriktirish (buyurtma yaratish tranzaksiyasi ichida)
 * @returns {Promise<string[]>} biriktirilgan rasm ID lari
 */
const attachPhotos = async (client, { orderId, userId, photoIds }) => {
    if (photoIds.length === 0) return [];
    const result = await client.query(
        `UPDATE order_photos SET order_id = $1
         WHERE id = ANY($2::uuid[]) AND uploaded_by = $3 AND order_id IS NULL
         RETURNING id`,
        [orderId, photoIds, userId]
    );
    return result.rows.map((row) => row.id);
};

const listPhotoIds = async (orderId) => {
    const result = await query(
        'SELECT id FROM order_photos WHERE order_id = $1 ORDER BY created_at ASC',
        [orderId]
    );
    return result.rows.map((row) => row.id);
};

/**
 * Rasm qoralamasini yuklash
 * POST /api/orders/photos (multipart: image)
 */
const uploadDraftPhoto = async (req, res, next) => {
    let saved = null;
    try {
        if (!req.file) throw new HttpError(400, 'Rasm tanlanmagan');
        cleanupDrafts().catch(() => {});

        const drafts = await query(
            `SELECT COUNT(*)::int as count FROM order_photos
             WHERE uploaded_by = $1 AND order_id IS NULL AND created_at > NOW() - ($2 * INTERVAL '1 hour')`,
            [req.user.id, DRAFT_TTL_HOURS]
        );
        if (drafts.rows[0].count >= MAX_DRAFTS_PER_USER) {
            throw new HttpError(429, 'Juda ko\'p rasm yuklandi. Avval buyurtmani yuboring yoki keyinroq urinib ko\'ring');
        }

        // Tekshiriladi, qayta kodlanadi, EXIF (GPS) o'chiriladi va yopiq papkaga saqlanadi
        saved = await saveUploadedImage(req.file.buffer, { dir: ORDER_PHOTO_DIR });
        const result = await query(
            `INSERT INTO order_photos (uploaded_by, file_name) VALUES ($1, $2)
             RETURNING id, created_at`,
            [req.user.id, saved.fileName]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (saved) await removeFiles([saved.fileName]);
        next(error);
    }
};

/**
 * Hali biriktirilmagan rasmni o'chirish
 * DELETE /api/orders/photos/:photoId
 */
const deleteDraftPhoto = async (req, res, next) => {
    try {
        const photoId = assertUuid(req.params.photoId, 'Rasm topilmadi');
        const result = await query(
            `DELETE FROM order_photos WHERE id = $1 AND uploaded_by = $2 AND order_id IS NULL
             RETURNING file_name`,
            [photoId, req.user.id]
        );
        if (!result.rows[0]) throw new HttpError(404, 'Rasm topilmadi');
        await removeFiles([result.rows[0].file_name]);
        res.status(200).json({ success: true, message: 'Rasm o\'chirildi' });
    } catch (error) {
        next(error);
    }
};

/**
 * Buyurtma rasmini ko'rish: mijoz, biriktirilgan usta, taklif olgan usta, ochiq buyurtmani ko'ra oladigan usta yoki admin
 * GET /api/orders/:id/photos/:photoId
 */
const getOrderPhoto = async (req, res, next) => {
    try {
        const orderId = assertUuid(req.params.id, 'Buyurtma topilmadi');
        const photoId = assertUuid(req.params.photoId, 'Rasm topilmadi');
        const { id: userId, role } = req.user;

        const result = await query(
            `SELECT p.file_name, o.client_id, o.master_id, o.status, o.mode,
                    EXISTS (
                        SELECT 1 FROM dispatch_offers d
                        WHERE d.order_id = o.id AND d.master_id = $3 AND d.status IN ('pending', 'accepted')
                    ) as has_offer
             FROM order_photos p JOIN orders o ON o.id = p.order_id
             WHERE p.id = $1 AND p.order_id = $2`,
            [photoId, orderId, userId]
        );
        const photo = result.rows[0];
        if (!photo) throw new HttpError(404, 'Rasm topilmadi');

        const allowed = role === 'admin'
            || photo.client_id === userId
            || photo.master_id === userId
            || (role === 'master' && photo.has_offer)
            || (role === 'master' && photo.mode === 'catalog' && photo.status === 'pending' && !photo.master_id);
        if (!allowed) throw new HttpError(403, 'Bu rasmni ko\'rishga ruxsatingiz yo\'q');

        res.set('Cache-Control', 'private, max-age=3600');
        res.type('image/webp');
        res.sendFile(path.join(ORDER_PHOTO_DIR, path.basename(photo.file_name)), (error) => {
            if (error && !res.headersSent) next(new HttpError(404, 'Rasm fayli topilmadi'));
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Foydalanuvchi yuklagan barcha rasmlarni o'chirish (hisob o'chirilganda)
 */
const deleteUserPhotos = async (client, userId) => {
    const result = await client.query(
        'DELETE FROM order_photos WHERE uploaded_by = $1 RETURNING file_name',
        [userId]
    );
    return result.rows.map((row) => row.file_name);
};

module.exports = {
    MAX_PHOTOS_PER_ORDER,
    parsePhotoIds,
    attachPhotos,
    listPhotoIds,
    uploadDraftPhoto,
    deleteDraftPhoto,
    getOrderPhoto,
    deleteUserPhotos,
    removeFiles,
};
