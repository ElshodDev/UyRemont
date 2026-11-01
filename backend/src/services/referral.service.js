// =============================================
// UyRemont - Referal dasturi: shaxsiy havola, taklif qilgan odamni bog'lash va bonuslar.
// Bonus ustaning komissiya hisobiga 'bonus' yozuvi sifatida tushadi (qarzni kamaytiradi, ortsa - oldindan to'lov).
// Har bir taklif qilingan odam uchun har bir hodisa bir marta (referral_rewards: UNIQUE(referee_id, event)).
// =============================================

const crypto = require('crypto');
const config = require('../config/referral');
const { query } = require('../config/database');
const { appUrl } = require('../config/app');
const { addLedgerEntry, notifyCommission, formatSum } = require('./commission.service');

// Adashtiradigan belgilarsiz (0/O, 1/I/L): telefon ekranidan qayta yozish oson
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

const normalizeCode = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '');
const isValidCode = (code) => CODE_PATTERN.test(normalizeCode(code));
const randomCode = () => Array.from(crypto.randomBytes(CODE_LENGTH), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
const referralLink = (code) => appUrl(`/r/${code}`);

/**
 * Foydalanuvchining shaxsiy kodi (birinchi so'ralganda yaratiladi)
 * @returns {Promise<string>}
 */
const ensureReferralCode = async (userId) => {
    const existing = await query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    if (existing.rows[0]?.referral_code) return existing.rows[0].referral_code;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            const updated = await query(
                `UPDATE users SET referral_code = $2 WHERE id = $1 AND referral_code IS NULL RETURNING referral_code`,
                [userId, randomCode()]
            );
            if (updated.rows[0]) return updated.rows[0].referral_code;
            // Parallel so'rov allaqachon yaratgan
            const again = await query('SELECT referral_code FROM users WHERE id = $1', [userId]);
            if (again.rows[0]?.referral_code) return again.rows[0].referral_code;
        } catch (error) {
            if (error.code !== '23505') throw error; // kod band bo'lsa - boshqasi
        }
    }
    throw new Error('Referal kodini yaratib bo\'lmadi');
};

/**
 * Kod egasi (faol foydalanuvchi). Ommaviy sahifada faqat ismi ko'rsatiladi
 */
const findReferrer = async (code, db = { query }) => {
    if (!isValidCode(code)) return null;
    const result = await db.query(
        `SELECT id, name, role FROM users
         WHERE referral_code = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [normalizeCode(code)]
    );
    return result.rows[0] || null;
};

/**
 * Yangi hisobni taklif qilgan odamga bog'lash (faqat hisob yaratilayotganda, tranzaksiya ichida)
 * @returns {Promise<string|null>} taklif qilgan odam id si
 */
const attachReferrer = async (client, newUserId, code) => {
    const referrer = await findReferrer(code, client);
    if (!referrer || referrer.id === newUserId) return null;
    await client.query(
        'UPDATE users SET referred_by = $2, referred_at = NOW() WHERE id = $1 AND referred_by IS NULL',
        [newUserId, referrer.id]
    );
    return referrer.id;
};

const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || '').slice(0, 40);

/**
 * Buyurtma yakuniy summasi bilan yakunlanganda bonuslar (komissiya yozilgan tranzaksiya ichida chaqiriladi):
 * - buyurtmani bajargan usta taklif qilingan bo'lsa (birinchi munosib ishi) - taklif qilgan ustaga va unga;
 * - buyurtma bergan mijoz taklif qilingan bo'lsa (birinchi munosib buyurtmasi) - taklif qilgan ustaga.
 * O'zaro buyurtma (taklif qilgan odam shu buyurtmaning ikkinchi tomoni) bonus bermaydi.
 * @returns {Promise<Array<{ masterId: string, due: number, message: string }>>} tranzaksiyadan keyingi xabarlar
 */
const grantReferralRewards = async (client, order) => {
    const labor = Number(order.labor_price ?? order.final_price) || 0;
    if (!order.master_id || !order.client_id || labor < config.MIN_LABOR) return [];

    const people = await client.query(
        `SELECT u.id, u.name, u.referred_by, r.is_active as referrer_active,
                EXISTS (SELECT 1 FROM master_profiles mp WHERE mp.user_id = r.id) as referrer_is_master
         FROM users u JOIN users r ON r.id = u.referred_by
         WHERE u.id = ANY($1::uuid[])`,
        [[order.master_id, order.client_id]]
    );

    const notices = [];
    for (const person of people.rows) {
        if (!person.referrer_active) continue;
        if (person.referred_by === order.master_id || person.referred_by === order.client_id) continue;

        const isMasterEvent = person.id === order.master_id;
        const event = isMasterEvent ? 'master_first_job' : 'client_first_order';
        const referrerAmount = person.referrer_is_master ? (isMasterEvent ? config.MASTER_BONUS : config.CLIENT_BONUS) : 0;
        const refereeAmount = isMasterEvent ? config.WELCOME_BONUS : 0;

        const inserted = await client.query(
            `INSERT INTO referral_rewards (referrer_id, referee_id, event, order_id, referrer_amount, referee_amount)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (referee_id, event) DO NOTHING
             RETURNING id`,
            [person.referred_by, person.id, event, order.id, referrerAmount, refereeAmount]
        );
        if (!inserted.rows[0]) continue;

        const name = firstName(person.name) || '—';
        if (referrerAmount > 0) {
            const { due } = await addLedgerEntry(client, {
                masterId: person.referred_by, kind: 'bonus', amount: -referrerAmount, orderId: order.id,
                note: `Referal: ${name}`,
            });
            notices.push({
                masterId: person.referred_by,
                due,
                message: isMasterEvent
                    ? `🎁 Siz taklif qilgan usta ${name} birinchi ishini bajardi. Komissiya hisobingizga ${formatSum(referrerAmount)} bonus yozildi`
                    : `🎁 Siz taklif qilgan mijoz ${name} birinchi buyurtmasini bajartirdi. Komissiya hisobingizga ${formatSum(referrerAmount)} bonus yozildi`,
            });
        }
        if (refereeAmount > 0) {
            const { due } = await addLedgerEntry(client, {
                masterId: person.id, kind: 'bonus', amount: -refereeAmount, orderId: order.id,
                note: 'Xush kelibsiz bonusi',
            });
            notices.push({
                masterId: person.id,
                due,
                message: `🎁 Birinchi ishingiz bilan tabriklaymiz! Komissiya hisobingizga ${formatSum(refereeAmount)} xush kelibsiz bonusi yozildi`,
            });
        }
    }
    return notices;
};

/**
 * Bonus xabarlari (saytda va Telegram'da) - tranzaksiya yakunlangandan keyin
 */
const notifyReferralRewards = (notices = []) => {
    notices.forEach(({ masterId, due, message }) => notifyCommission(masterId, { due, message }));
};

/**
 * Foydalanuvchining referal ma'lumotlari: havola, bonus shartlari, statistika va taklif qilganlar ro'yxati
 */
const loadMyReferrals = async (userId) => {
    const code = await ensureReferralCode(userId);
    const [stats, invited] = await Promise.all([
        query(
            `SELECT
                (SELECT COUNT(*)::int FROM users WHERE referred_by = $1) as invited,
                (SELECT COUNT(*)::int FROM users u JOIN master_profiles mp ON mp.user_id = u.id WHERE u.referred_by = $1) as masters,
                (SELECT COUNT(DISTINCT referee_id)::int FROM referral_rewards WHERE referrer_id = $1) as active,
                (SELECT COALESCE(SUM(referrer_amount), 0) FROM referral_rewards WHERE referrer_id = $1) as earned`,
            [userId]
        ),
        query(
            `SELECT u.name, u.referred_at,
                    EXISTS (SELECT 1 FROM master_profiles mp WHERE mp.user_id = u.id) as is_master,
                    COALESCE((SELECT SUM(rr.referrer_amount) FROM referral_rewards rr
                              WHERE rr.referee_id = u.id AND rr.referrer_id = $1), 0) as bonus,
                    EXISTS (SELECT 1 FROM referral_rewards rr WHERE rr.referee_id = u.id AND rr.referrer_id = $1) as active
             FROM users u
             WHERE u.referred_by = $1
             ORDER BY u.referred_at DESC NULLS LAST
             LIMIT 50`,
            [userId]
        ),
    ]);
    const s = stats.rows[0];
    return {
        code,
        link: referralLink(code),
        bonuses: {
            master: config.MASTER_BONUS,
            welcome: config.WELCOME_BONUS,
            client: config.CLIENT_BONUS,
            min_labor: config.MIN_LABOR,
        },
        stats: { invited: s.invited, masters: s.masters, active: s.active, earned: Number(s.earned) },
        // Maxfiylik: faqat ism (familiyasiz) va holat
        invited: invited.rows.map((row) => ({
            name: firstName(row.name) || null,
            joined_at: row.referred_at,
            is_master: row.is_master,
            active: row.active,
            bonus: Number(row.bonus),
        })),
    };
};

module.exports = {
    isValidCode,
    normalizeCode,
    referralLink,
    ensureReferralCode,
    findReferrer,
    attachReferrer,
    grantReferralRewards,
    notifyReferralRewards,
    loadMyReferrals,
    firstName,
};
