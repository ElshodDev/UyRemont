// =============================================
// UyRemont - Tezkor chaqiruv (taxi rejimi) qoidalari
// Barcha qiymatlar bitta joyda: backend mantiqi va /api/dispatch/config shu yerdan oladi
// =============================================

const numberFromEnv = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

module.exports = {
    // Ustaga taklifni qabul qilish uchun beriladigan vaqt
    OFFER_TIMEOUT_SEC: numberFromEnv('DISPATCH_OFFER_TIMEOUT_SEC', 20),
    // Qidiruv radiuslari: yaqin atrofda usta topilmasa radius kengayadi
    SEARCH_RADII_KM: [3, 7, 15],
    // Shu vaqt ichida usta topilmasa buyurtma "topilmadi" holatiga o'tadi
    SEARCH_TIMEOUT_MIN: numberFromEnv('DISPATCH_SEARCH_TIMEOUT_MIN', 5),
    // Ketma-ket shuncha taklifga javob bermagan usta liniyadan chiqariladi
    MAX_MISSED_OFFERS: 3,
    // Joylashuvi shu daqiqadan eski bo'lgan ustaga taklif yuborilmaydi
    LOCATION_STALE_MIN: 10,
    // Usta qabul qilgandan keyin mijoz shu daqiqa ichida bepul bekor qila oladi
    FREE_CANCEL_MIN: 3,
    // Platforma komissiyasi (yakuniy narxdan, foizda)
    COMMISSION_PERCENT: numberFromEnv('PLATFORM_COMMISSION_PERCENT', 10),
    // Liniyaga chiqish uchun minimal reyting (kamida MIN_REVIEWS_FOR_RATING ta sharh bo'lganda)
    MIN_RATING: 4.0,
    MIN_REVIEWS_FOR_RATING: 5,
    // Tezkor buyurtmalar faqat admin tasdiqlagan ustalarga
    REQUIRE_VERIFIED: process.env.DISPATCH_REQUIRE_VERIFIED !== 'false',
    // Yetib kelish vaqtini taxminlash uchun shahar ichidagi o'rtacha tezlik
    CITY_SPEED_KMH: 25,
    // Dispetcher qadami
    TICK_MS: 2000,
};
