// =============================================
// UyRemont - Referal dasturi sozlamalari (bonuslar ustalarning komissiya hisobiga yoziladi, so'm)
// =============================================

const numberFromEnv = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

module.exports = {
    // Taklif qilgan ustaga: u taklif qilgan usta birinchi ishini bajarganda
    MASTER_BONUS: numberFromEnv('REFERRAL_MASTER_BONUS', 20000),
    // Taklif qilingan ustaga: birinchi ishini bajarganda (xush kelibsiz bonusi)
    WELCOME_BONUS: numberFromEnv('REFERRAL_WELCOME_BONUS', 20000),
    // Taklif qilgan ustaga: u taklif qilgan mijozning birinchi buyurtmasini boshqa usta bajarganda
    CLIENT_BONUS: numberFromEnv('REFERRAL_CLIENT_BONUS', 5000),
    // Bonus beriladigan buyurtmaning eng kam ish haqi (soxta arzon buyurtmalardan himoya)
    MIN_LABOR: numberFromEnv('REFERRAL_MIN_LABOR', 50000),
};
