// =============================================
// UyRemont - Xavfsizlik sozlamalari va ishga tushishdagi tekshiruv
// =============================================

const isProduction = process.env.NODE_ENV === 'production';

const PLACEHOLDER_SECRETS = ['your_super_secret_jwt_key_here', 'changeme', 'secret'];

module.exports = {
    isProduction,
    // Kirish kodi ekranda/javobda ko'rsatiladi. FAQAT sinov uchun, aniq yoqilganda ishlaydi
    OTP_DEV_MODE: process.env.OTP_DEV_MODE === 'true',
    // Bitta raqamga sutkasiga yuboriladigan kodlar soni (kodni taxmin qilishdan himoya).
    // Sinov rejimida kodlar baribir ekranda ko'rinadi, shuning uchun limit yuqoriroq
    OTP_DAILY_LIMIT: Number(process.env.OTP_DAILY_LIMIT) || (process.env.OTP_DEV_MODE === 'true' ? 100 : 10),
    // Administratorlar uchun ikki bosqichli kirish majburiymi
    ADMIN_REQUIRE_2FA: process.env.ADMIN_REQUIRE_2FA === 'true',
    // Foydalanish shartlari versiyasi (matn o'zgarsa yangilanadi)
    TERMS_VERSION: '2026-10',

    /**
     * Xavfli sozlamalarni aniqlash. errors bo'lsa server ishga tushmaydi.
     */
    validateSecurityConfig({ smsConfigured }) {
        const errors = [];
        const warnings = [];
        const secret = process.env.JWT_SECRET || '';

        if (!secret) {
            errors.push('JWT_SECRET o\'rnatilmagan. Loyiha papkasida "npm run setup" ni ishga tushiring yoki backend/.env ni to\'ldiring');
        } else if (secret.length < 32 || PLACEHOLDER_SECRETS.includes(secret)) {
            (isProduction ? errors : warnings).push('JWT_SECRET juda qisqa yoki namunaviy. Kamida 32 belgili tasodifiy qator bo\'lishi kerak ("npm run setup" avtomatik yaratadi)');
        }

        if (isProduction && module.exports.OTP_DEV_MODE) {
            errors.push('Production rejimida OTP_DEV_MODE=true bo\'lishi mumkin emas: kirish kodlari hammaga ko\'rinadi. backend/.env da OTP_DEV_MODE=false qiling va SMS (ESKIZ_*) ni sozlang');
        } else if (module.exports.OTP_DEV_MODE) {
            warnings.push('OTP_DEV_MODE yoqilgan: kirish kodlari ekranda ko\'rinadi. Bu faqat sinov uchun - real foydalanuvchilar bilan ishlatmang');
        } else if (!smsConfigured) {
            warnings.push('SMS (ESKIZ_*) sozlanmagan va OTP_DEV_MODE o\'chiq - hech kim tizimga kira olmaydi');
        }

        if (isProduction && !module.exports.ADMIN_REQUIRE_2FA) {
            warnings.push('ADMIN_REQUIRE_2FA o\'chiq: administratorlar uchun ikki bosqichli kirishni yoqish tavsiya etiladi');
        }
        if (isProduction && !process.env.DATA_ENCRYPTION_KEY) {
            warnings.push('DATA_ENCRYPTION_KEY o\'rnatilmagan: 2FA kalitlari JWT_SECRET asosida shifrlanadi (JWT_SECRET almashtirilsa 2FA qayta sozlanishi kerak bo\'ladi)');
        }

        return { errors, warnings };
    },
};
