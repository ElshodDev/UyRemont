// =============================================
// UyRemont - Tezkor chaqiruv (taxi rejimi) qoidalari
// Barcha qiymatlar bitta joyda: backend mantiqi va /api/dispatch/config shu yerdan oladi
// =============================================

const numberFromEnv = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const PLATFORM_COMMISSION_PERCENT = numberFromEnv('PLATFORM_COMMISSION_PERCENT', 10);

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
    // Platforma komissiyasi tezkor chaqiruvdan (ish haqidan, foizda)
    COMMISSION_PERCENT: PLATFORM_COMMISSION_PERCENT,
    // Oddiy (katalog) buyurtma komissiyasi: mijoz ustani o'zi tanlagan. Berilmasa - PLATFORM_COMMISSION_PERCENT; 0 - olinmaydi
    CATALOG_COMMISSION_PERCENT: numberFromEnv('CATALOG_COMMISSION_PERCENT', PLATFORM_COMMISSION_PERCENT),
    // Mijoz oddiy buyurtmani yakunlasa, usta yakuniy summani shu soat ichida kiritadi (aks holda yangi buyurtma ololmaydi)
    PRICE_ENTRY_HOURS: numberFromEnv('PRICE_ENTRY_HOURS', 24),
    // Komissiya qarzi shu summadan (so'm) oshsa, usta to'lamaguncha ishga chiqa olmaydi va taklif olmaydi. 0 - cheklov yo'q
    COMMISSION_DEBT_LIMIT: numberFromEnv('COMMISSION_DEBT_LIMIT', 200000),
    // Ustalarga ko'rsatiladigan to'lov rekvizitlari (karta raqami, egasi, izohga nima yozish)
    COMMISSION_PAYMENT_INFO: (process.env.COMMISSION_PAYMENT_INFO || '').trim().slice(0, 500),
    // Liniyaga chiqish uchun minimal reyting (kamida MIN_REVIEWS_FOR_RATING ta sharh bo'lganda)
    MIN_RATING: 4.0,
    MIN_REVIEWS_FOR_RATING: 5,
    // Tezkor buyurtmalar faqat admin tasdiqlagan ustalarga
    REQUIRE_VERIFIED: process.env.DISPATCH_REQUIRE_VERIFIED !== 'false',
    // Yetib kelish vaqtini taxminlash uchun shahar ichidagi o'rtacha tezlik
    CITY_SPEED_KMH: 25,
    // Dispetcher qadami (faqat qidiruvdagi chaqiruv yoki faol taklif bo'lganda)
    TICK_MS: 2000,
    // Ish bo'lmaganda bazani tekshirish oralig'i: bulutli baza (Neon) "uxlab" qolishi mumkin bo'lsin
    IDLE_CHECK_MS: 10 * 60 * 1000,
};
