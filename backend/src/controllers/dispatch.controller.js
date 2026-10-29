// =============================================
// UyRemont - Tezkor chaqiruv (taxi rejimi) Controller
// =============================================

const { randomUUID: uuidv4 } = require('crypto');
const { query, withTransaction } = require('../config/database');
const config = require('../config/dispatch');
const { HttpError } = require('../middleware/errorHandler');
const {
    assertUuid,
    optionalString,
    requiredString,
    optionalNumber,
} = require('../utils/validators');
const {
    triggerDispatch,
    estimateNearby,
    buildOfferPayload,
    cancelPendingOffers,
    emitOrderUpdate,
    emitToUser,
    etaMinutes,
    getIo,
} = require('../services/dispatch.service');
const { logAdminAction } = require('../services/audit.service');

const ACTIVE_INSTANT_STATUSES = ['searching', 'accepted', 'arrived', 'in_progress'];
const CLIENT_CANCEL_REASONS = ['Rejalar o\'zgardi', 'Usta uzoq kutdirmoqda', 'Usta bilan kelisha olmadik', 'Xato buyurtma berdim', 'Boshqa sabab'];
const MASTER_CANCEL_REASONS = ['Manzilga yetib bora olmayman', 'Mijoz javob bermayapti', 'Kerakli asbob/material yo\'q', 'Boshqa sabab'];

/**
 * Koordinatalarni tekshirish
 */
const parseLocation = (body) => {
    const lat = optionalNumber(body.lat, { min: -90, max: 90, field: 'Kenglik (lat)' });
    const lng = optionalNumber(body.lng, { min: -180, max: 180, field: 'Uzunlik (lng)' });
    if (lat === null || lng === null) {
        throw new HttpError(400, 'Joylashuv aniqlanmagan. Xaritada manzilni belgilang');
    }
    return { lat, lng };
};

/**
 * Ustaning liniyaga chiqish shartlari
 */
const getRequirements = (profile) => {
    const ratingOk = profile.reviews_count < config.MIN_REVIEWS_FOR_RATING
        || Number(profile.rating) >= config.MIN_RATING;
    const requirements = {
        verified: !config.REQUIRE_VERIFIED || profile.is_verified,
        has_specializations: profile.specializations_count > 0,
        rating_ok: ratingOk,
        active: profile.is_active,
    };
    return { ...requirements, can_go_online: Object.values(requirements).every(Boolean) };
};

const loadMasterProfile = async (userId) => {
    const result = await query(
        `SELECT mp.*, u.is_active,
                (SELECT COUNT(*)::int FROM master_specializations ms WHERE ms.master_id = mp.id) as specializations_count
         FROM master_profiles mp JOIN users u ON u.id = mp.user_id
         WHERE mp.user_id = $1`,
        [userId]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Usta profili topilmadi');
    return result.rows[0];
};

/**
 * Qoidalar va sozlamalar (frontend "Ishlash qoidalari" sahifasi uchun)
 * GET /api/dispatch/config
 */
const getConfig = (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            offer_timeout_sec: config.OFFER_TIMEOUT_SEC,
            search_radii_km: config.SEARCH_RADII_KM,
            search_timeout_min: config.SEARCH_TIMEOUT_MIN,
            max_missed_offers: config.MAX_MISSED_OFFERS,
            free_cancel_min: config.FREE_CANCEL_MIN,
            commission_percent: config.COMMISSION_PERCENT,
            min_rating: config.MIN_RATING,
            min_reviews_for_rating: config.MIN_REVIEWS_FOR_RATING,
            require_verified: config.REQUIRE_VERIFIED,
            location_stale_min: config.LOCATION_STALE_MIN,
            client_cancel_reasons: CLIENT_CANCEL_REASONS,
            master_cancel_reasons: MASTER_CANCEL_REASONS,
        },
    });
};

/**
 * Chaqiruv narxi va yaqin atrofdagi ustalar
 * GET /api/dispatch/estimate?specialization_id=&lat=&lng=
 */
const getEstimate = async (req, res, next) => {
    try {
        const specializationId = optionalNumber(req.query.specialization_id, {
            min: 1, max: 100000, integer: true, field: 'Mutaxassislik',
        });
        if (!specializationId) throw new HttpError(400, 'Xizmat turini tanlang');
        const { lat, lng } = parseLocation(req.query);

        const spec = await query(
            'SELECT id, name_uz, icon, call_fee FROM specializations WHERE id = $1 AND is_active = TRUE',
            [specializationId]
        );
        if (!spec.rows[0]) throw new HttpError(404, 'Xizmat turi topilmadi');

        const nearby = await estimateNearby({ lat, lng, specializationId, clientId: req.user?.id });

        res.status(200).json({
            success: true,
            data: { call_fee: Number(spec.rows[0].call_fee), ...nearby },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta chaqirish (tezkor buyurtma)
 * POST /api/dispatch/orders
 * Body: { specialization_id, lat, lng, address, district, title?, description? }
 */
const createInstantOrder = async (req, res, next) => {
    try {
        const clientId = req.user.id;
        const specializationId = optionalNumber(req.body.specialization_id, {
            min: 1, max: 100000, integer: true, field: 'Mutaxassislik',
        });
        if (!specializationId) throw new HttpError(400, 'Xizmat turini tanlang');
        const { lat, lng } = parseLocation(req.body);
        const address = requiredString(req.body.address, { min: 3, max: 500, field: 'Manzil' });
        const district = optionalString(req.body.district, { max: 100, field: 'Tuman' });
        const description = optionalString(req.body.description, { max: 2000, field: 'Tavsif' });
        const customTitle = optionalString(req.body.title, { max: 200, field: 'Sarlavha' });

        const spec = await query(
            'SELECT id, name_uz, call_fee FROM specializations WHERE id = $1 AND is_active = TRUE',
            [specializationId]
        );
        if (!spec.rows[0]) throw new HttpError(404, 'Xizmat turi topilmadi');

        // Qoida: bir vaqtda bitta faol tezkor buyurtma
        const active = await query(
            `SELECT id FROM orders
             WHERE client_id = $1 AND mode = 'instant' AND status = ANY($2::text[])
             LIMIT 1`,
            [clientId, ACTIVE_INSTANT_STATUSES]
        );
        if (active.rows[0]) {
            return res.status(409).json({
                success: false,
                message: 'Sizda faol chaqiruv bor. Avval uni yakunlang yoki bekor qiling',
                data: { order_id: active.rows[0].id },
            });
        }

        const result = await query(
            `INSERT INTO orders (
                id, client_id, specialization_id, title, description, address, district,
                lat, lng, mode, status, call_fee, search_radius_km, search_started_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'instant', 'searching', $10, $11, NOW())
             RETURNING *`,
            [
                uuidv4(), clientId, specializationId, customTitle || `${spec.rows[0].name_uz} chaqiruvi`,
                description, address, district, lat, lng, spec.rows[0].call_fee, config.SEARCH_RADII_KM[0],
            ]
        );

        triggerDispatch();

        res.status(201).json({
            success: true,
            message: 'Usta qidirilmoqda',
            data: result.rows[0],
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mijozning faol tezkor buyurtmasi
 * GET /api/dispatch/active
 */
const getActiveOrder = async (req, res, next) => {
    try {
        const column = req.user.role === 'master' ? 'master_id' : 'client_id';
        const result = await query(
            `SELECT id, status FROM orders
             WHERE ${column} = $1 AND mode = 'instant' AND status = ANY($2::text[])
             ORDER BY created_at DESC LIMIT 1`,
            [req.user.id, ACTIVE_INSTANT_STATUSES]
        );
        res.status(200).json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        next(error);
    }
};

/**
 * Tezkor buyurtmani bekor qilish
 * POST /api/dispatch/orders/:id/cancel
 * Body: { reason }
 * - Mijoz: qidiruvda yoki usta yo'lda/yetib kelganda. Qabuldan FREE_CANCEL_MIN daqiqa o'tsa "kech bekor qilish"
 * - Usta: qabul qilgandan keyin rad etsa, buyurtma qayta qidiruvga qaytadi
 */
const cancelInstantOrder = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Buyurtma topilmadi');
        const reason = optionalString(req.body.reason, { max: 300, field: 'Sabab' });
        const { id: userId, role } = req.user;

        const outcome = await withTransaction(async (client) => {
            const orderResult = await client.query(
                'SELECT * FROM orders WHERE id = $1 AND mode = \'instant\' FOR UPDATE',
                [id]
            );
            const order = orderResult.rows[0];
            if (!order) throw new HttpError(404, 'Buyurtma topilmadi');

            const actor = role === 'admin' ? 'admin'
                : order.client_id === userId ? 'client'
                    : order.master_id === userId ? 'master' : null;
            if (!actor) throw new HttpError(403, 'Ruxsat yo\'q');

            if (!ACTIVE_INSTANT_STATUSES.includes(order.status)) {
                throw new HttpError(400, 'Bu buyurtmani bekor qilib bo\'lmaydi');
            }
            if (order.status === 'in_progress' && actor !== 'admin') {
                throw new HttpError(400, 'Ish boshlangan. Bekor qilish uchun usta bilan kelishing yoki qo\'llab-quvvatlashga murojaat qiling');
            }

            // Usta rad etsa: buyurtma yangi usta qidirishga qaytadi
            if (actor === 'master') {
                if (!reason) throw new HttpError(400, 'Bekor qilish sababini ko\'rsating');
                await client.query(
                    'UPDATE master_profiles SET cancelled_jobs = cancelled_jobs + 1 WHERE user_id = $1',
                    [userId]
                );
                const reopened = await client.query(
                    `UPDATE orders
                     SET status = 'searching', master_id = NULL, accepted_at = NULL, arrived_at = NULL,
                         search_started_at = NOW(), search_radius_km = $2
                     WHERE id = $1 RETURNING *`,
                    [id, config.SEARCH_RADII_KM[0]]
                );
                return { order: reopened.rows[0], previousMasterId: userId, reopened: true };
            }

            const lateCancel = actor === 'client'
                && order.accepted_at
                && Date.now() - new Date(order.accepted_at).getTime() > config.FREE_CANCEL_MIN * 60 * 1000;

            const offers = await cancelPendingOffers(client, id);
            const cancelled = await client.query(
                `UPDATE orders
                 SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2,
                     cancel_reason = $3, late_cancel = $4
                 WHERE id = $1 RETURNING *`,
                [id, actor, reason, Boolean(lateCancel)]
            );
            return { order: cancelled.rows[0], offers, lateCancel };
        });

        // Xabarnomalar
        if (outcome.reopened) {
            emitToUser(outcome.order.client_id, 'order_updated', {
                order_id: id,
                status: 'searching',
                message: 'Usta buyurtmani bekor qildi. Yangi usta qidirilmoqda',
            });
            const io = getIo();
            if (io) io.to(`order_${id}`).emit('order_updated', { order_id: id, status: 'searching' });
            triggerDispatch();
        } else {
            (outcome.offers || []).forEach((offer) => {
                emitToUser(offer.master_id, 'offer_closed', { offer_id: offer.id, reason: 'cancelled' });
            });
            emitOrderUpdate(outcome.order, { cancelled_by: outcome.order.cancelled_by });
        }

        if (role === 'admin' && outcome.order.cancelled_by === 'admin') {
            await logAdminAction(req, { action: 'order.cancel', targetOrderId: id, details: { reason } });
        }

        res.status(200).json({
            success: true,
            message: outcome.reopened
                ? 'Buyurtmadan voz kechdingiz. U boshqa ustaga beriladi'
                : outcome.lateCancel
                    ? 'Buyurtma bekor qilindi (kech bekor qilish qayd etildi)'
                    : 'Buyurtma bekor qilindi',
            data: outcome.order,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ustaning ish rejimi ma'lumotlari: liniya holati, bugungi statistika, faol ish va taklif
 * GET /api/dispatch/me
 */
const getMasterState = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const profile = await loadMasterProfile(userId);

        const [statsResult, activeResult, offerResult] = await Promise.all([
            query(
                `SELECT COUNT(*)::int as jobs,
                        COALESCE(SUM(COALESCE(final_price, budget, 0)), 0) as earnings
                 FROM orders
                 WHERE master_id = $1 AND status = 'completed'
                   AND COALESCE(completed_at, updated_at)::date = CURRENT_DATE`,
                [userId]
            ),
            query(
                `SELECT id, status, title, address FROM orders
                 WHERE master_id = $1 AND mode = 'instant' AND status = ANY($2::text[])
                 ORDER BY accepted_at DESC LIMIT 1`,
                [userId, ['accepted', 'arrived', 'in_progress']]
            ),
            query(
                `SELECT id FROM dispatch_offers
                 WHERE master_id = $1 AND status = 'pending' AND expires_at > NOW()
                 LIMIT 1`,
                [userId]
            ),
        ]);

        const earnings = Number(statsResult.rows[0].earnings);
        const commission = Math.round((earnings * config.COMMISSION_PERCENT) / 100);

        res.status(200).json({
            success: true,
            data: {
                is_online: profile.is_online,
                lat: profile.lat,
                lng: profile.lng,
                location_updated_at: profile.location_updated_at,
                rating: profile.rating,
                reviews_count: profile.reviews_count,
                acceptance_rate: profile.offers_total > 0
                    ? Math.round((profile.offers_accepted / profile.offers_total) * 100)
                    : null,
                offers_total: profile.offers_total,
                missed_offers_streak: profile.missed_offers_streak,
                cancelled_jobs: profile.cancelled_jobs,
                today: {
                    jobs: statsResult.rows[0].jobs,
                    earnings,
                    commission,
                    net: earnings - commission,
                },
                requirements: getRequirements(profile),
                active_job: activeResult.rows[0] || null,
                pending_offer: offerResult.rows[0] ? await buildOfferPayload(offerResult.rows[0].id) : null,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Liniyaga chiqish / liniyadan tushish
 * PUT /api/dispatch/online
 * Body: { online: boolean, lat?, lng? }
 */
const setOnline = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const online = req.body.online === true;
        const profile = await loadMasterProfile(userId);

        if (online) {
            const requirements = getRequirements(profile);
            if (!requirements.can_go_online) {
                const reasons = [];
                if (!requirements.verified) reasons.push('profilingiz administrator tomonidan tasdiqlanmagan');
                if (!requirements.has_specializations) reasons.push('mutaxassislik tanlanmagan');
                if (!requirements.rating_ok) reasons.push(`reytingingiz ${config.MIN_RATING} dan past`);
                throw new HttpError(403, `Liniyaga chiqib bo'lmaydi: ${reasons.join(', ')}`);
            }
            const { lat, lng } = parseLocation(req.body);
            await query(
                `UPDATE master_profiles
                 SET is_online = TRUE, is_available = TRUE, missed_offers_streak = 0,
                     lat = $2, lng = $3, location_updated_at = NOW()
                 WHERE user_id = $1`,
                [userId, lat, lng]
            );
            triggerDispatch();
        } else {
            await withTransaction(async (client) => {
                await client.query('UPDATE master_profiles SET is_online = FALSE WHERE user_id = $1', [userId]);
                // Faol taklif bo'lsa rad etilgan hisoblanadi
                await client.query(
                    `UPDATE dispatch_offers SET status = 'declined', responded_at = NOW()
                     WHERE master_id = $1 AND status = 'pending'`,
                    [userId]
                );
            });
            triggerDispatch();
        }

        res.status(200).json({
            success: true,
            message: online ? 'Siz liniyadasiz. Buyurtmalar kutilmoqda' : 'Liniyadan chiqdingiz',
            data: { is_online: online },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Ustaning joylashuvini yangilash (liniyada har 15 soniyada)
 * PUT /api/dispatch/location
 * Body: { lat, lng }
 */
const updateLocation = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { lat, lng } = parseLocation(req.body);

        const updated = await query(
            `UPDATE master_profiles SET lat = $2, lng = $3, location_updated_at = NOW()
             WHERE user_id = $1 RETURNING is_online`,
            [userId, lat, lng]
        );
        if (!updated.rows[0]) throw new HttpError(404, 'Usta profili topilmadi');

        // Yo'ldagi usta joylashuvini mijozga jonli ko'rsatish
        const active = await query(
            `SELECT id, client_id, lat, lng FROM orders
             WHERE master_id = $1 AND mode = 'instant' AND status IN ('accepted', 'arrived')
             LIMIT 1`,
            [userId]
        );
        const job = active.rows[0];
        if (job) {
            const distanceKm = haversineKm(lat, lng, job.lat, job.lng);
            const payload = {
                order_id: job.id,
                lat,
                lng,
                distance_km: Number(distanceKm.toFixed(2)),
                eta_min: etaMinutes(distanceKm),
            };
            const io = getIo();
            if (io) io.to(`order_${job.id}`).emit('master_location', payload);
            emitToUser(job.client_id, 'master_location', payload);
        }

        res.status(200).json({ success: true, data: { is_online: updated.rows[0].is_online } });
    } catch (error) {
        next(error);
    }
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
};

/**
 * Taklifni qabul qilish
 * POST /api/dispatch/offers/:offerId/accept
 */
const acceptOffer = async (req, res, next) => {
    try {
        const offerId = assertUuid(req.params.offerId, 'Taklif topilmadi');
        const userId = req.user.id;

        const order = await withTransaction(async (client) => {
            const offerResult = await client.query(
                'SELECT * FROM dispatch_offers WHERE id = $1 AND master_id = $2 FOR UPDATE',
                [offerId, userId]
            );
            const offer = offerResult.rows[0];
            if (!offer) throw new HttpError(404, 'Taklif topilmadi');
            if (offer.status !== 'pending' || new Date(offer.expires_at).getTime() < Date.now()) {
                throw new HttpError(409, 'Taklif muddati tugagan yoki bekor qilingan');
            }

            const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [offer.order_id]);
            if (!orderResult.rows[0] || orderResult.rows[0].status !== 'searching') {
                await client.query(
                    'UPDATE dispatch_offers SET status = \'cancelled\', responded_at = NOW() WHERE id = $1',
                    [offerId]
                );
                throw new HttpError(409, 'Buyurtma endi mavjud emas');
            }

            await client.query(
                'UPDATE dispatch_offers SET status = \'accepted\', responded_at = NOW() WHERE id = $1',
                [offerId]
            );
            await client.query(
                `UPDATE master_profiles
                 SET offers_accepted = offers_accepted + 1, missed_offers_streak = 0
                 WHERE user_id = $1`,
                [userId]
            );
            const updated = await client.query(
                `UPDATE orders SET status = 'accepted', master_id = $2, accepted_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [offer.order_id, userId]
            );
            return updated.rows[0];
        });

        emitOrderUpdate(order, { message: 'Usta topildi va yo\'lga chiqdi' });

        res.status(200).json({
            success: true,
            message: 'Buyurtma qabul qilindi. Mijoz manziliga yo\'l oling',
            data: order,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Taklifni rad etish
 * POST /api/dispatch/offers/:offerId/decline
 */
const declineOffer = async (req, res, next) => {
    try {
        const offerId = assertUuid(req.params.offerId, 'Taklif topilmadi');
        const result = await query(
            `UPDATE dispatch_offers SET status = 'declined', responded_at = NOW()
             WHERE id = $1 AND master_id = $2 AND status = 'pending'
             RETURNING id`,
            [offerId, req.user.id]
        );
        if (!result.rows[0]) throw new HttpError(409, 'Taklif allaqachon yopilgan');

        // Rad etish ham javob hisoblanadi: ketma-ket javobsizlar hisobi nolga tushadi
        await query('UPDATE master_profiles SET missed_offers_streak = 0 WHERE user_id = $1', [req.user.id]);
        triggerDispatch();

        res.status(200).json({ success: true, message: 'Taklif rad etildi' });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta mijozni baholaydi (ikki tomonlama reyting)
 * POST /api/dispatch/orders/:id/rate-client
 * Body: { rating }
 */
const rateClient = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Buyurtma topilmadi');
        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new HttpError(400, 'Reyting 1 dan 5 gacha bo\'lishi kerak');
        }

        const order = await withTransaction(async (client) => {
            const updated = await client.query(
                `UPDATE orders SET client_rating_by_master = $3
                 WHERE id = $1 AND master_id = $2 AND status = 'completed' AND client_rating_by_master IS NULL
                 RETURNING client_id`,
                [id, req.user.id, rating]
            );
            if (!updated.rows[0]) throw new HttpError(400, 'Mijozni faqat yakunlangan buyurtmadan keyin bir marta baholash mumkin');

            await client.query(
                `UPDATE users u SET
                    client_rating = s.avg_rating,
                    client_ratings_count = s.total
                 FROM (
                    SELECT AVG(client_rating_by_master)::DECIMAL(3,2) as avg_rating, COUNT(*)::int as total
                    FROM orders WHERE client_id = $1 AND client_rating_by_master IS NOT NULL
                 ) s
                 WHERE u.id = $1`,
                [updated.rows[0].client_id]
            );
            return updated.rows[0];
        });

        res.status(200).json({ success: true, message: 'Mijoz baholandi', data: order });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getConfig,
    getEstimate,
    createInstantOrder,
    getActiveOrder,
    cancelInstantOrder,
    getMasterState,
    setOnline,
    updateLocation,
    acceptOffer,
    declineOffer,
    rateClient,
    ACTIVE_INSTANT_STATUSES,
};
