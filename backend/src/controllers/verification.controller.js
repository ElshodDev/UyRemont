// =============================================
// UyRemont - Ustani tasdiqlash: usta hujjat yuklab so'rov yuboradi, administrator navbatdan tasdiqlaydi
// =============================================

const fs = require('fs/promises');
const path = require('path');
const { query } = require('../config/database');
const { HttpError } = require('../middleware/errorHandler');
const { MASTER_DOC_DIR } = require('../middleware/upload');
const { saveUploadedImage } = require('../utils/images');
const { logAdminAction } = require('../services/audit.service');
const { emitToUser, triggerDispatch } = require('../services/dispatch.service');
const { notifyUser } = require('../services/telegram/notify');
const { escapeHtml, urlButton, keyboard } = require('../services/telegram/client');
const { assertUuid, requiredString } = require('../utils/validators');
const { containsContact } = require('../utils/contacts');
const {
    encryptPii, decryptPii, hashPii, normalizePassport, isValidPassport, maskPassport,
} = require('../utils/pii');
const { tr } = require('../i18n');

const DOCUMENT_KINDS = ['passport', 'selfie', 'certificate'];
const MAX_DOCUMENTS = 6;

/**
 * Tasdiqlash holati: none | pending | verified | rejected
 */
const verificationStatus = (profile) => {
    if (profile.is_verified) return 'verified';
    const requested = profile.verification_requested_at && new Date(profile.verification_requested_at).getTime();
    const rejected = profile.verification_rejected_at && new Date(profile.verification_rejected_at).getTime();
    if (requested && (!rejected || rejected < requested)) return 'pending';
    if (rejected) return 'rejected';
    return 'none';
};

const removeDocumentFiles = (fileNames) => Promise.all(
    fileNames.map((name) => fs.unlink(path.join(MASTER_DOC_DIR, path.basename(name))).catch(() => {}))
);

const loadProfile = async (userId) => {
    const result = await query(
        `SELECT mp.*, u.name,
                (SELECT COUNT(*)::int FROM master_specializations ms WHERE ms.master_id = mp.id) as specializations_count
         FROM master_profiles mp JOIN users u ON u.id = mp.user_id
         WHERE mp.user_id = $1`,
        [userId]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Usta profili topilmadi');
    return result.rows[0];
};

const listDocuments = async (userId) => (await query(
    'SELECT id, kind, created_at FROM master_documents WHERE user_id = $1 ORDER BY created_at',
    [userId]
)).rows;

const sendDocument = (res, next, fileName) => {
    res.set('Cache-Control', 'private, no-store');
    res.type('image/webp');
    res.sendFile(path.join(MASTER_DOC_DIR, path.basename(fileName)), (error) => {
        if (error && !res.headersSent) next(new HttpError(404, 'Fayl topilmadi'));
    });
};

// ---------- Shaxs: ism, familiya, pasport ----------

// Lotin/kirill harflari, tutuq belgisi (ʻ ' ‘ ’), chiziqcha va bo'shliq
const NAME_PATTERN = /^[\p{L}ʻ'‘’`\- ]{2,60}$/u;

const parseName = (value, field, invalidMessage) => {
    const name = requiredString(value, { min: 2, max: 60, field }).replace(/\s+/g, ' ');
    if (!NAME_PATTERN.test(name) || containsContact(name)) throw new HttpError(400, invalidMessage);
    return name;
};

const loadIdentity = async (userId) => (await query('SELECT * FROM master_identity WHERE user_id = $1', [userId])).rows[0] || null;

// Ustaga faqat yashirilgan pasport ko'rsatiladi
const identityView = (row) => (row
    ? { first_name: row.first_name, last_name: row.last_name, passport_masked: maskPassport(decryptPii(row.passport_encrypted)) }
    : null);

/**
 * GET /api/masters/me/identity
 */
const getMyIdentity = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, data: identityView(await loadIdentity(req.user.id)) });
    } catch (error) {
        next(error);
    }
};

/**
 * Usta bo'lishda shaxsiy ma'lumotlar (mijoz hisobidan ham - usta profili keyin yaratiladi)
 * PUT /api/masters/me/identity
 * Body: { first_name, last_name, passport } - passport: AA1234567 (bo'shliq va chiziqcha mumkin)
 */
const saveMyIdentity = async (req, res, next) => {
    try {
        if (req.user.role === 'admin') throw new HttpError(400, 'Administrator hisobi usta profiliga ega bo\'la olmaydi');
        const firstName = parseName(req.body.first_name, 'Ism', 'Ismni to\'g\'ri yozing (faqat harflar)');
        const lastName = parseName(req.body.last_name, 'Familiya', 'Familiyani to\'g\'ri yozing (faqat harflar)');
        const passport = normalizePassport(req.body.passport);
        if (!isValidPassport(passport)) {
            throw new HttpError(400, 'Pasport seriyasi va raqamini to\'g\'ri kiriting: 2 ta harf va 7 ta raqam (masalan, AA1234567)');
        }
        const hash = hashPii(passport);

        const existing = await loadIdentity(req.user.id);
        const verified = (await query('SELECT is_verified FROM master_profiles WHERE user_id = $1', [req.user.id])).rows[0]?.is_verified;
        if (verified && existing && existing.passport_hash !== hash) {
            throw new HttpError(400, 'Tasdiqlangan profilda pasportni o\'zgartirib bo\'lmaydi. Administratorga murojaat qiling');
        }
        const taken = await query('SELECT 1 FROM master_identity WHERE passport_hash = $1 AND user_id <> $2', [hash, req.user.id]);
        if (taken.rows[0]) throw new HttpError(409, 'Bu pasport boshqa hisobga biriktirilgan. Yordam xizmatiga murojaat qiling');

        const saved = await query(
            `INSERT INTO master_identity (user_id, first_name, last_name, passport_encrypted, passport_hash)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                 passport_encrypted = EXCLUDED.passport_encrypted, passport_hash = EXCLUDED.passport_hash, updated_at = NOW()
             RETURNING *`,
            [req.user.id, firstName, lastName, encryptPii(passport), hash]
        );
        // Profilda va katalogda "Ism Familiya"
        await query('UPDATE users SET name = $2 WHERE id = $1', [req.user.id, `${firstName} ${lastName}`]);
        res.status(200).json({ success: true, message: 'Ma\'lumotlar saqlandi', data: identityView(saved.rows[0]) });
    } catch (error) {
        next(error);
    }
};

// ---------- Usta ----------

/**
 * GET /api/masters/me/verification
 */
const getMyVerification = async (req, res, next) => {
    try {
        const profile = await loadProfile(req.user.id);
        const documents = await listDocuments(req.user.id);
        res.status(200).json({
            success: true,
            data: {
                status: verificationStatus(profile),
                note: profile.verification_note,
                requested_at: profile.verification_requested_at,
                documents,
                requirements: {
                    has_name: Boolean(profile.name),
                    has_identity: Boolean(await loadIdentity(req.user.id)),
                    has_specializations: profile.specializations_count > 0,
                    has_passport: documents.some((d) => d.kind === 'passport'),
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/masters/me/documents (multipart: image, kind)
 */
const uploadDocument = async (req, res, next) => {
    let saved = null;
    try {
        const kind = String(req.body.kind || '');
        if (!DOCUMENT_KINDS.includes(kind)) throw new HttpError(400, 'Hujjat turini tanlang');
        if (!req.file) throw new HttpError(400, 'Rasm tanlanmagan');
        const profile = await loadProfile(req.user.id);
        if (profile.is_verified) throw new HttpError(400, 'Profilingiz allaqachon tasdiqlangan');

        const count = await query('SELECT COUNT(*)::int as total FROM master_documents WHERE user_id = $1', [req.user.id]);
        if (count.rows[0].total >= MAX_DOCUMENTS) throw new HttpError(400, `Ko'pi bilan ${MAX_DOCUMENTS} ta hujjat`);

        // EXIF (GPS) o'chiriladi, fayl ochiq papkada emas
        saved = await saveUploadedImage(req.file.buffer, { dir: MASTER_DOC_DIR });
        const result = await query(
            'INSERT INTO master_documents (user_id, kind, file_name) VALUES ($1, $2, $3) RETURNING id, kind, created_at',
            [req.user.id, kind, saved.fileName]
        );
        res.status(201).json({ success: true, message: 'Hujjat yuklandi', data: result.rows[0] });
    } catch (error) {
        if (saved) await removeDocumentFiles([saved.fileName]);
        next(error);
    }
};

/**
 * GET /api/masters/me/documents/:id - usta o'z hujjatini ko'radi
 */
const getMyDocument = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Hujjat topilmadi');
        const result = await query('SELECT file_name FROM master_documents WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (!result.rows[0]) throw new HttpError(404, 'Hujjat topilmadi');
        sendDocument(res, next, result.rows[0].file_name);
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/masters/me/documents/:id
 */
const deleteDocument = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Hujjat topilmadi');
        const result = await query(
            'DELETE FROM master_documents WHERE id = $1 AND user_id = $2 RETURNING file_name',
            [id, req.user.id]
        );
        if (!result.rows[0]) throw new HttpError(404, 'Hujjat topilmadi');
        await removeDocumentFiles([result.rows[0].file_name]);
        res.status(200).json({ success: true, message: 'Hujjat o\'chirildi' });
    } catch (error) {
        next(error);
    }
};

/**
 * Tekshirishga yuborish
 * POST /api/masters/me/verification
 */
const submitVerification = async (req, res, next) => {
    try {
        const profile = await loadProfile(req.user.id);
        const status = verificationStatus(profile);
        if (status === 'verified') throw new HttpError(400, 'Profilingiz allaqachon tasdiqlangan');
        if (status === 'pending') throw new HttpError(400, 'So\'rovingiz allaqachon ko\'rib chiqilmoqda');
        const documents = await listDocuments(req.user.id);
        const missing = [];
        if (!profile.name) missing.push('ism');
        if (!(await loadIdentity(req.user.id))) missing.push('pasport seriya va raqami');
        if (profile.specializations_count === 0) missing.push('mutaxassislik');
        if (!documents.some((d) => d.kind === 'passport')) missing.push('pasport (ID karta) rasmi');
        if (missing.length) throw new HttpError(400, `Yuborishdan oldin qo'shing: ${missing.join(', ')}`);

        await query('UPDATE master_profiles SET verification_requested_at = NOW() WHERE user_id = $1', [req.user.id]);

        // Administratorlarga xabar
        const admins = await query('SELECT id FROM users WHERE role = \'admin\' AND is_active = TRUE');
        admins.rows.forEach((admin) => {
            notifyUser(
                admin.id,
                (lang) => tr(lang, '🧾 <b>Yangi usta tekshiruvga yubordi</b>: {name}', { name: escapeHtml(profile.name) }),
                (lang) => keyboard([[urlButton(tr(lang, 'Tekshirish'), '/admin?section=verifications')]])
            ).catch(() => {});
        });

        res.status(200).json({ success: true, message: 'So\'rov yuborildi. Odatda 24 soat ichida ko\'rib chiqiladi', data: { status: 'pending' } });
    } catch (error) {
        next(error);
    }
};

// ---------- Administrator ----------

/**
 * Tasdiq kutayotgan ustalar navbati
 * GET /api/admin/verifications?status=pending|rejected|none
 */
const listVerifications = async (req, res, next) => {
    try {
        const status = ['pending', 'rejected', 'none'].includes(req.query.status) ? req.query.status : 'pending';
        const result = await query(
            `SELECT u.id, u.name, u.phone, u.created_at, mp.district, mp.experience_years, mp.bio, mp.hourly_rate,
                    mp.is_verified, mp.verification_requested_at, mp.verification_rejected_at, mp.verification_note,
                    (SELECT COUNT(*)::int FROM portfolio_items p WHERE p.master_id = mp.id) as portfolio_count,
                    COALESCE((SELECT JSON_AGG(jsonb_build_object('id', s.id, 'name_uz', s.name_uz, 'icon', s.icon) ORDER BY s.id)
                              FROM master_specializations ms JOIN specializations s ON s.id = ms.specialization_id
                              WHERE ms.master_id = mp.id), '[]') as specializations,
                    COALESCE((SELECT JSON_AGG(jsonb_build_object('id', d.id, 'kind', d.kind) ORDER BY d.created_at)
                              FROM master_documents d WHERE d.user_id = u.id), '[]') as documents,
                    mi.first_name as identity_first_name, mi.last_name as identity_last_name, mi.passport_encrypted
             FROM master_profiles mp JOIN users u ON u.id = mp.user_id
             LEFT JOIN master_identity mi ON mi.user_id = u.id
             WHERE u.role = 'master' AND u.is_active = TRUE AND mp.is_verified = FALSE
             ORDER BY mp.verification_requested_at ASC NULLS LAST, u.created_at DESC
             LIMIT 200`
        );
        // Administrator pasport raqamini hujjat rasmi bilan solishtiradi (to'liq ko'rinadi)
        const rows = result.rows.map(({ passport_encrypted: encrypted, ...row }) => ({
            ...row,
            status: verificationStatus(row),
            passport_number: encrypted ? decryptPii(encrypted) : null,
        }));
        const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
        res.status(200).json({ success: true, data: rows.filter((row) => row.status === status), counts });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/admin/documents/:id
 */
const getDocument = async (req, res, next) => {
    try {
        const id = assertUuid(req.params.id, 'Hujjat topilmadi');
        const result = await query('SELECT file_name FROM master_documents WHERE id = $1', [id]);
        if (!result.rows[0]) throw new HttpError(404, 'Hujjat topilmadi');
        sendDocument(res, next, result.rows[0].file_name);
    } catch (error) {
        next(error);
    }
};

const loadMasterForDecision = async (userId) => {
    const result = await query(
        `SELECT u.id, u.name FROM users u JOIN master_profiles mp ON mp.user_id = u.id
         WHERE u.id = $1 AND u.role = 'master'`,
        [userId]
    );
    if (!result.rows[0]) throw new HttpError(404, 'Usta topilmadi');
    return result.rows[0];
};

/**
 * POST /api/admin/verifications/:userId/approve
 */
const approveMaster = async (req, res, next) => {
    try {
        const userId = assertUuid(req.params.userId, 'Usta topilmadi');
        const master = await loadMasterForDecision(userId);
        await query(
            `UPDATE master_profiles SET is_verified = TRUE, verification_rejected_at = NULL, verification_note = NULL
             WHERE user_id = $1`,
            [userId]
        );
        await logAdminAction(req, { action: 'master.approve', targetUserId: userId });
        emitToUser(userId, 'verification_updated', { status: 'verified' });
        notifyUser(
            userId,
            (lang) => tr(
                lang,
                '✅ <b>Profilingiz tasdiqlandi!</b>\n{name}, endi «Ishga chiqish» tugmasini bosib tezkor buyurtmalar olishingiz mumkin.',
                { name: escapeHtml(master.name || '') }
            ),
            (lang) => keyboard([[urlButton(tr(lang, 'Ishga chiqish'), '/master/work')]])
        ).catch(() => {});
        triggerDispatch();
        res.status(200).json({ success: true, message: 'Usta tasdiqlandi' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/admin/verifications/:userId/reject
 * Body: { note } - ustaga ko'rsatiladigan sabab
 */
const rejectMaster = async (req, res, next) => {
    try {
        const userId = assertUuid(req.params.userId, 'Usta topilmadi');
        const note = requiredString(req.body.note, { min: 5, max: 500, field: 'Sabab' });
        await loadMasterForDecision(userId);
        await query(
            `UPDATE master_profiles SET is_verified = FALSE, verification_rejected_at = NOW(), verification_note = $2
             WHERE user_id = $1`,
            [userId, note]
        );
        await logAdminAction(req, { action: 'master.reject', targetUserId: userId, details: { note } });
        emitToUser(userId, 'verification_updated', { status: 'rejected', note });
        notifyUser(
            userId,
            (lang) => tr(
                lang,
                '⚠️ <b>Profilingiz hali tasdiqlanmadi</b>\nSabab: {note}\n\nKamchilikni tuzatib, qayta yuboring.',
                { note: escapeHtml(note) }
            ),
            (lang) => keyboard([[urlButton(tr(lang, 'Profilni ochish'), '/master/profile')]])
        ).catch(() => {});
        res.status(200).json({ success: true, message: 'Ustaga sabab yuborildi' });
    } catch (error) {
        next(error);
    }
};

/**
 * Hisob o'chirilganda hujjatlar
 */
const deleteUserDocuments = async (client, userId) => {
    const result = await client.query('DELETE FROM master_documents WHERE user_id = $1 RETURNING file_name', [userId]);
    return result.rows.map((row) => row.file_name);
};

module.exports = {
    verificationStatus,
    getMyVerification,
    uploadDocument,
    getMyDocument,
    deleteDocument,
    submitVerification,
    listVerifications,
    getDocument,
    approveMaster,
    rejectMaster,
    deleteUserDocuments,
    removeDocumentFiles,
    getMyIdentity,
    saveMyIdentity,
};
