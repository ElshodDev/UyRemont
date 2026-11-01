// Tezkor chaqiruv qoidalari matni (/rules va /ustalar sahifalari uchun umumiy).
// Raqamlar serverdagi sozlamadan keladi: GET /api/dispatch/config

/**
 * @param {object} config /api/dispatch/config javobi
 * @returns {string[]}
 */
export const buildClientRules = (config) => [
  'Bir vaqtning o\'zida faqat bitta faol tezkor chaqiruv berish mumkin.',
  `Usta qidirilayotgan paytda bekor qilish bepul. Usta qabul qilgandan keyin ${config.free_cancel_min} daqiqa ichida ham bepul bekor qilasiz; undan keyin "kech bekor qilish" qayd etiladi.`,
  'Ish boshlangandan keyin chaqiruvni bekor qilib bo\'lmaydi — usta bilan kelishing.',
  `Usta ${config.search_timeout_min} daqiqa ichida topilmasa, chaqiruv yopiladi va qayta chaqirish taklif qilinadi.`,
  'Chiqish narxi oldindan ko\'rsatiladi; ish narxi usta muammoni ko\'rgach kelishiladi.',
  'Telefon raqamlar faqat usta chaqiruvni qabul qilgandan keyin ko\'rinadi.',
  'Sevimli ustangiz qidiruv radiusida bo\'sh bo\'lsa, taklif birinchi unga yuboriladi (ustani sevimlilarga yurakcha orqali qo\'shasiz).',
  'Ish tugagach ustani halol baholang — bu boshqa mijozlarga yordam beradi.'
];

/**
 * @param {object} config /api/dispatch/config javobi
 * @returns {string[]}
 */
export const buildMasterRules = (config) => [
  `Tezkor chaqiruvlar faqat ish rejimini yoqqan${config.require_verified ? ', administrator tasdiqlagan' : ''} ustalarga yuboriladi.`,
  `Reyting ${config.min_rating} dan past bo'lsa (kamida ${config.min_reviews_for_rating} ta sharhdan keyin) ishga chiqib bo'lmaydi.`,
  `Taklifga javob berish uchun ${config.offer_timeout_sec} soniya beriladi. Ketma-ket ${config.max_missed_offers} ta taklifga javob bermasangiz, ish rejimingiz avtomatik o'chiriladi.`,
  'Rad etish ham javob hisoblanadi, lekin qabul qilish foizingizga ta\'sir qiladi.',
  'Ish rejimida joylashuvingiz har 15 soniyada yangilanadi. GPS ishlamasa, xaritada joyingizni belgilang.',
  `Joylashuvi ${config.location_stale_min} daqiqadan ko'p yangilanmagan ustaga takliflar yuborilmaydi.`,
  'Faol ish bor paytda yangi tezkor takliflar kelmaydi.',
  'Qabul qilingan chaqiruvdan voz kechsangiz, sabab ko\'rsatiladi va statistikada qayd etiladi; chaqiruv boshqa ustaga beriladi.',
  'Bosqichlarni o\'z vaqtida belgilang: "Yetib keldim" → "Ishni boshlash" → "Yakunlash" (yakuniy summa bilan).',
  `Platforma komissiyasi — yakuniy summaning ${config.commission_percent}%.`
];
