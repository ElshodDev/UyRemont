// =============================================
// UyRemont - Ustaning ommaviy havolasi (usta24.uz/u/<slug>): usta uni Telegram'da ulashib mijoz topadi
// =============================================

const crypto = require('crypto');
const { query } = require('../config/database');
const { appUrl } = require('../config/app');
const { slugify } = require('../utils/slug');

const publicUrl = (slug) => appUrl(`/u/${slug}`);

const baseSlug = (name) => {
    const base = slugify(name) || 'usta';
    return base.length < 3 ? `usta-${base}` : base;
};

/**
 * Ustaning havolasi; bo'lmasa ismidan yaratiladi (band bo'lsa -2, -3 ... yoki tasodifiy raqam)
 * @returns {Promise<string|null>} slug yoki usta profili yo'q bo'lsa null
 */
const ensurePublicSlug = async (userId) => {
    const row = (await query(
        `SELECT mp.public_slug, u.name FROM master_profiles mp JOIN users u ON u.id = mp.user_id
         WHERE mp.user_id = $1`,
        [userId]
    )).rows[0];
    if (!row) return null;
    if (row.public_slug) return row.public_slug;

    const base = baseSlug(row.name);
    const candidates = [
        base,
        ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`),
        ...Array.from({ length: 5 }, () => `${base}-${crypto.randomInt(100, 10000)}`),
    ];
    for (const candidate of candidates) {
        try {
            const updated = await query(
                `UPDATE master_profiles SET public_slug = $2
                 WHERE user_id = $1 AND public_slug IS NULL RETURNING public_slug`,
                [userId, candidate]
            );
            if (updated.rows[0]) return updated.rows[0].public_slug;
            // Parallel so'rov allaqachon yaratgan
            const existing = await query('SELECT public_slug FROM master_profiles WHERE user_id = $1', [userId]);
            return existing.rows[0]?.public_slug || null;
        } catch (error) {
            if (error.code !== '23505') throw error;
        }
    }
    return null;
};

/**
 * Havolasi yo'q barcha ustalar uchun yaratish (db-setup paytida)
 * @returns {Promise<number>} yaratilganlar soni
 */
const backfillPublicSlugs = async () => {
    const result = await query('SELECT user_id FROM master_profiles WHERE public_slug IS NULL');
    let created = 0;
    for (const row of result.rows) {
        if (await ensurePublicSlug(row.user_id)) created += 1;
    }
    return created;
};

module.exports = { ensurePublicSlug, backfillPublicSlugs, publicUrl };
