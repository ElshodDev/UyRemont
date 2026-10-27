// =============================================
// UyRemont - Tezkor chaqiruv dispetcheri
// Yandex Taxi kabi: buyurtma eng yaqin onlayn ustaga navbat bilan taklif qilinadi.
// Holat bazada saqlanadi, shuning uchun server qayta ishga tushsa ham qidiruv davom etadi.
// =============================================

const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const config = require('../config/dispatch');

let io = null;
let timer = null;
let ticking = false;
let tickRequested = false;

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// Bir nechta server nusxasi bo'lsa, faqat bittasi dispetcherlik qiladi
const DISPATCH_LOCK_KEY = 732451;

/**
 * Ikki nuqta orasidagi masofa (km), Haversine formulasi bo'yicha SQL ifoda
 */
const distanceSql = (latParam, lngParam) => `(
    6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(mp.lat - ${latParam}) / 2), 2)
        + COS(RADIANS(${latParam})) * COS(RADIANS(mp.lat))
        * POWER(SIN(RADIANS(mp.lng - ${lngParam}) / 2), 2)
    ))
)`;

const etaMinutes = (distanceKm) => Math.max(3, Math.round((Number(distanceKm) / config.CITY_SPEED_KMH) * 60));

const emitToUser = (userId, event, payload) => {
    if (io && userId) io.to(`user_${userId}`).emit(event, payload);
};

const emitOrderUpdate = (order, extra = {}) => {
    if (!io) return;
    const payload = { order_id: order.id, status: order.status, ...extra };
    io.to(`order_${order.id}`).emit('order_updated', payload);
    emitToUser(order.client_id, 'order_updated', payload);
    if (order.master_id) emitToUser(order.master_id, 'order_updated', payload);
};

/**
 * Taklif qilish mumkin bo'lgan ustalar uchun umumiy shartlar
 * $1 - lat, $2 - lng, $3 - specialization_id, $4 - order_id, $5 - client_id
 */
const ELIGIBLE_MASTERS_SQL = `
    FROM users u
    JOIN master_profiles mp ON mp.user_id = u.id
    WHERE u.role = 'master' AND u.is_active = TRUE
      AND mp.is_online = TRUE AND mp.is_available = TRUE
      AND mp.lat IS NOT NULL AND mp.lng IS NOT NULL
      AND mp.location_updated_at > NOW() - (${config.LOCATION_STALE_MIN} * INTERVAL '1 minute')
      ${config.REQUIRE_VERIFIED ? 'AND mp.is_verified = TRUE' : ''}
      AND u.id <> $5
      AND EXISTS (
          SELECT 1 FROM master_specializations ms
          WHERE ms.master_id = mp.id AND ms.specialization_id = $3
      )
      AND NOT EXISTS (
          SELECT 1 FROM dispatch_offers d WHERE d.order_id = $4 AND d.master_id = u.id
      )
      AND NOT EXISTS (
          SELECT 1 FROM dispatch_offers d WHERE d.master_id = u.id AND d.status = 'pending'
      )
      AND NOT EXISTS (
          SELECT 1 FROM orders ao
          WHERE ao.master_id = u.id AND ao.mode = 'instant'
            AND ao.status IN ('accepted', 'arrived', 'in_progress')
      )
`;

/**
 * Buyurtma uchun eng yaqin mos ustani topish
 */
const findCandidate = async (client, order, radiusKm) => {
    const result = await client.query(
        `SELECT * FROM (
            SELECT u.id, u.name, mp.rating, ${distanceSql('$1', '$2')} as distance_km
            ${ELIGIBLE_MASTERS_SQL}
         ) c
         WHERE c.distance_km <= $6
         ORDER BY c.distance_km ASC, c.rating DESC
         LIMIT 1`,
        [order.lat, order.lng, order.specialization_id, order.id, order.client_id, radiusKm]
    );
    return result.rows[0] || null;
};

/**
 * Yaqin atrofdagi onlayn ustalar soni va eng yaqinigacha masofa (mijoz uchun taxmin)
 */
const estimateNearby = async ({ lat, lng, specializationId, clientId }) => {
    const maxRadius = config.SEARCH_RADII_KM[config.SEARCH_RADII_KM.length - 1];
    const result = await query(
        `SELECT COUNT(*)::int as total, MIN(c.distance_km) as nearest_km FROM (
            SELECT ${distanceSql('$1', '$2')} as distance_km
            ${ELIGIBLE_MASTERS_SQL}
         ) c
         WHERE c.distance_km <= $6`,
        [lat, lng, specializationId, NIL_UUID, clientId || NIL_UUID, maxRadius]
    );
    const { total, nearest_km: nearestKm } = result.rows[0];
    return {
        online_masters: total,
        nearest_km: nearestKm === null ? null : Number(Number(nearestKm).toFixed(1)),
        eta_min: nearestKm === null ? null : etaMinutes(nearestKm),
    };
};

/**
 * Ustaga yuboriladigan taklif ma'lumotlari
 */
const buildOfferPayload = async (offerId) => {
    const result = await query(
        `SELECT d.id as offer_id, d.order_id, d.expires_at, d.distance_km,
                o.title, o.description, o.address, o.district, o.lat, o.lng, o.call_fee,
                s.name_uz as specialization_name, s.icon as specialization_icon,
                c.name as client_name, c.client_rating, c.client_ratings_count
         FROM dispatch_offers d
         JOIN orders o ON o.id = d.order_id
         JOIN users c ON c.id = o.client_id
         LEFT JOIN specializations s ON s.id = o.specialization_id
         WHERE d.id = $1`,
        [offerId]
    );
    const offer = result.rows[0];
    if (!offer) return null;
    return {
        ...offer,
        // Mijozning faqat ismi ko'rsatiladi
        client_name: (offer.client_name || 'Mijoz').split(' ')[0],
        eta_min: etaMinutes(offer.distance_km),
        timeout_sec: config.OFFER_TIMEOUT_SEC,
    };
};

/**
 * Muddati o'tgan takliflarni yopish; ketma-ket javobsiz qoldirgan ustani liniyadan chiqarish
 */
const expireOffers = async (client) => {
    const expired = await client.query(
        `UPDATE dispatch_offers SET status = 'expired', responded_at = NOW()
         WHERE status = 'pending' AND expires_at <= NOW()
         RETURNING id, order_id, master_id`
    );

    const closed = [];
    for (const offer of expired.rows) {
        const streak = await client.query(
            `UPDATE master_profiles
             SET missed_offers_streak = missed_offers_streak + 1,
                 is_online = CASE WHEN missed_offers_streak + 1 >= $2 THEN FALSE ELSE is_online END
             WHERE user_id = $1
             RETURNING missed_offers_streak, is_online`,
            [offer.master_id, config.MAX_MISSED_OFFERS]
        );
        closed.push({ ...offer, forcedOffline: Boolean(streak.rows[0] && !streak.rows[0].is_online) });
    }
    return closed;
};

/**
 * Bitta qidiruvdagi buyurtma uchun keyingi ustaga taklif yuborish
 */
const dispatchOrder = async (client, order) => {
    const radii = config.SEARCH_RADII_KM;
    const currentIndex = Math.max(0, radii.indexOf(Number(order.search_radius_km)));

    for (let i = currentIndex; i < radii.length; i += 1) {
        const candidate = await findCandidate(client, order, radii[i]);
        if (!candidate) continue;

        const offerId = uuidv4();
        try {
            await client.query('SAVEPOINT create_offer');
            await client.query(
                `INSERT INTO dispatch_offers (id, order_id, master_id, distance_km, expires_at)
                 VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 second'))`,
                [offerId, order.id, candidate.id, Number(candidate.distance_km).toFixed(2), config.OFFER_TIMEOUT_SEC]
            );
            await client.query('RELEASE SAVEPOINT create_offer');
        } catch (error) {
            // Parallel ravishda boshqa taklif yaratilgan bo'lsa keyingi qadamda qayta urinadi
            await client.query('ROLLBACK TO SAVEPOINT create_offer');
            if (error.code === '23505') return null;
            throw error;
        }
        await client.query(
            'UPDATE master_profiles SET offers_total = offers_total + 1 WHERE user_id = $1',
            [candidate.id]
        );
        if (Number(order.search_radius_km) !== radii[i]) {
            await client.query('UPDATE orders SET search_radius_km = $1 WHERE id = $2', [radii[i], order.id]);
        }
        return { offerId, masterId: candidate.id, radius: radii[i] };
    }

    // Hech kim topilmadi: maksimal radiusda kutish yoki qidiruvni tugatish
    const maxRadius = radii[radii.length - 1];
    const searchAgeMs = Date.now() - new Date(order.search_started_at).getTime();
    if (searchAgeMs >= config.SEARCH_TIMEOUT_MIN * 60 * 1000) {
        const expired = await client.query(
            `UPDATE orders SET status = 'expired', cancelled_at = NOW(), cancelled_by = 'system'
             WHERE id = $1 AND status = 'searching' RETURNING *`,
            [order.id]
        );
        return expired.rows[0] ? { expiredOrder: expired.rows[0] } : null;
    }
    if (Number(order.search_radius_km) !== maxRadius) {
        await client.query('UPDATE orders SET search_radius_km = $1 WHERE id = $2', [maxRadius, order.id]);
        return { radius: maxRadius, waiting: true };
    }
    return null;
};

/**
 * Dispetcher qadami: muddati o'tgan takliflar va qidiruvdagi buyurtmalar
 */
const tick = async () => {
    if (ticking) {
        tickRequested = true;
        return;
    }
    ticking = true;
    const notifications = [];
    try {
        await withTransaction(async (client) => {
            const lock = await client.query('SELECT pg_try_advisory_xact_lock($1) as locked', [DISPATCH_LOCK_KEY]);
            if (!lock.rows[0].locked) return;

            const closedOffers = await expireOffers(client);
            closedOffers.forEach((offer) => notifications.push({ closedOffer: offer }));

            const searching = await client.query(
                `SELECT o.* FROM orders o
                 WHERE o.mode = 'instant' AND o.status = 'searching'
                   AND NOT EXISTS (
                       SELECT 1 FROM dispatch_offers d WHERE d.order_id = o.id AND d.status = 'pending'
                   )
                 ORDER BY o.search_started_at ASC
                 LIMIT 50
                 FOR UPDATE OF o SKIP LOCKED`
            );

            for (const order of searching.rows) {
                const outcome = await dispatchOrder(client, order);
                if (outcome) notifications.push({ order, ...outcome });
            }
        });

        // Xabarlar tranzaksiya muvaffaqiyatli yakunlangandan keyin yuboriladi
        for (const item of notifications) {
            if (item.closedOffer) {
                const { id, master_id: masterId, forcedOffline } = item.closedOffer;
                emitToUser(masterId, 'offer_closed', { offer_id: id, reason: 'expired' });
                if (forcedOffline) {
                    emitToUser(masterId, 'dispatch_offline', {
                        reason: `Ketma-ket ${config.MAX_MISSED_OFFERS} ta buyurtmaga javob bermaganingiz uchun liniyadan chiqarildingiz`,
                    });
                }
            } else if (item.offerId) {
                const payload = await buildOfferPayload(item.offerId);
                if (payload) emitToUser(item.masterId, 'order_offer', payload);
                emitToUser(item.order.client_id, 'search_update', {
                    order_id: item.order.id, radius_km: item.radius, offered: true,
                });
            } else if (item.expiredOrder) {
                emitOrderUpdate(item.expiredOrder);
            } else if (item.waiting) {
                emitToUser(item.order.client_id, 'search_update', {
                    order_id: item.order.id, radius_km: item.radius, offered: false,
                });
            }
        }
    } catch (error) {
        console.error('❌ Dispetcher xatosi:', error.message);
    } finally {
        ticking = false;
        if (tickRequested) {
            tickRequested = false;
            setImmediate(tick);
        }
    }
};

/**
 * Darhol navbatdan tashqari qadam (yangi buyurtma, rad etish va h.k.)
 */
const triggerDispatch = () => setImmediate(tick);

/**
 * Faol taklifni bekor qilish (buyurtma bekor qilinganda)
 */
const cancelPendingOffers = async (client, orderId) => {
    const result = await client.query(
        `UPDATE dispatch_offers SET status = 'cancelled', responded_at = NOW()
         WHERE order_id = $1 AND status = 'pending'
         RETURNING id, master_id`,
        [orderId]
    );
    return result.rows;
};

const startDispatcher = (socketServer) => {
    io = socketServer;
    if (timer) return;
    timer = setInterval(tick, config.TICK_MS);
    timer.unref();
    triggerDispatch();
};

const stopDispatcher = () => {
    if (timer) clearInterval(timer);
    timer = null;
};

module.exports = {
    startDispatcher,
    stopDispatcher,
    triggerDispatch,
    estimateNearby,
    buildOfferPayload,
    cancelPendingOffers,
    emitOrderUpdate,
    emitToUser,
    etaMinutes,
    getIo: () => io,
};
