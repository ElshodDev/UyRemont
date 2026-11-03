// Tezkor chaqiruv qoidalari matni (/rules va /ustalar sahifalari uchun umumiy).
// Raqamlar serverdagi sozlamadan keladi: GET /api/dispatch/config
// Matnlar chaqirilgan paytda joriy tilda yasaladi (modul yuklanganda emas)
import { t } from '../i18n/index.js';

/**
 * @param {object} config /api/dispatch/config javobi
 * @returns {string[]}
 */
export const buildClientRules = (config) => [
  t('Bir vaqtning o\'zida faqat bitta faol tezkor chaqiruv berish mumkin.'),
  t('Usta qidirilayotgan paytda bekor qilish bepul. Usta qabul qilgandan keyin {min} daqiqa ichida ham bepul bekor qilasiz; undan keyin "kech bekor qilish" qayd etiladi.', { min: config.free_cancel_min }),
  t('Ish boshlangandan keyin chaqiruvni bekor qilib bo\'lmaydi — usta bilan kelishing.'),
  t('Usta {min} daqiqa ichida topilmasa, chaqiruv yopiladi va qayta chaqirish taklif qilinadi.', { min: config.search_timeout_min }),
  t('Chiqish narxi oldindan ko\'rsatiladi; ish narxi usta muammoni ko\'rgach kelishiladi.'),
  t('Telefon raqamlar faqat usta chaqiruvni qabul qilgandan keyin ko\'rinadi.'),
  t('Sevimli ustangiz qidiruv radiusida bo\'sh bo\'lsa, taklif birinchi unga yuboriladi (ustani sevimlilarga yurakcha orqali qo\'shasiz).'),
  t('Ish tugagach ustani halol baholang — bu boshqa mijozlarga yordam beradi.')
];

/**
 * @param {object} config /api/dispatch/config javobi
 * @returns {string[]}
 */
export const buildMasterRules = (config) => [
  config.require_verified
    ? t('Tezkor chaqiruvlar faqat ish rejimini yoqqan, administrator tasdiqlagan ustalarga yuboriladi.')
    : t('Tezkor chaqiruvlar ish rejimini yoqqan va pasport ma\'lumotlarini kiritgan ustalarga yuboriladi. Administrator pasportni rad etsa, qayta yubormaguncha ishga chiqib bo\'lmaydi.'),
  t('Reyting {rating} dan past bo\'lsa (kamida {reviews} ta sharhdan keyin) ishga chiqib bo\'lmaydi.', { rating: config.min_rating, reviews: config.min_reviews_for_rating }),
  t('Taklifga javob berish uchun {sec} soniya beriladi. Ketma-ket {max} ta taklifga javob bermasangiz, ish rejimingiz avtomatik o\'chiriladi.', { sec: config.offer_timeout_sec, max: config.max_missed_offers }),
  t('Rad etish ham javob hisoblanadi, lekin qabul qilish foizingizga ta\'sir qiladi.'),
  t('Ish rejimida joylashuvingiz har 15 soniyada yangilanadi. GPS ishlamasa, xaritada joyingizni belgilang.'),
  t('Joylashuvi {min} daqiqadan ko\'p yangilanmagan ustaga takliflar yuborilmaydi.', { min: config.location_stale_min }),
  t('Faol ish bor paytda yangi tezkor takliflar kelmaydi.'),
  t('Qabul qilingan chaqiruvdan voz kechsangiz, sabab ko\'rsatiladi va statistikada qayd etiladi; chaqiruv boshqa ustaga beriladi.'),
  t('Bosqichlarni o\'z vaqtida belgilang: "Yetib keldim" → "Ishni boshlash" → "Yakunlash" (ish haqi va material alohida).'),
  t('Platforma komissiyasi — ish haqining {percent}% (siz sotib olgan material summasidan olinmaydi). U har bir yakunlangan tezkor chaqiruvdan keyin «Komissiya hisobi» ga yoziladi.', { percent: config.commission_percent }),
  ...(config.commission_debt_limit > 0
    ? [t('Komissiya qarzi {limit} so\'mdan oshsa, to\'lamaguningizcha ishga chiqib bo\'lmaydi va takliflar kelmaydi.', { limit: Number(config.commission_debt_limit).toLocaleString('ru-RU') })]
    : [])
];
