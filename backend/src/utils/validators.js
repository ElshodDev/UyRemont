// =============================================
// UyRemont - Kiruvchi ma'lumotlarni tekshirish yordamchilari
// =============================================

const { HttpError } = require('../middleware/errorHandler');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_REGEX = /^\+998[0-9]{9}$/;

/**
 * Telefon raqamni +998XXXXXXXXX ko'rinishiga keltirish
 * "+998 90 123-45-67", "998901234567", "901234567" kabi kiritishlarni qabul qiladi
 */
const normalizePhone = (value) => {
    if (typeof value !== 'string') return null;
    const digits = value.replace(/\D/g, '');
    let normalized = null;
    if (digits.length === 12 && digits.startsWith('998')) normalized = `+${digits}`;
    else if (digits.length === 9) normalized = `+998${digits}`;
    return normalized && PHONE_REGEX.test(normalized) ? normalized : null;
};

const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

const assertUuid = (value, message = 'Noto\'g\'ri ID format') => {
    if (!isUuid(value)) throw new HttpError(400, message);
    return value;
};

/**
 * Ixtiyoriy matn maydoni: bo'sh bo'lsa null qaytaradi
 */
const optionalString = (value, { max, field }) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new HttpError(400, `${field} matn bo'lishi kerak`);
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > max) throw new HttpError(400, `${field} ${max} belgidan oshmasligi kerak`);
    return trimmed;
};

const requiredString = (value, { min = 1, max, field }) => {
    const result = optionalString(value, { max, field });
    if (!result || result.length < min) {
        throw new HttpError(400, min > 1
            ? `${field} kamida ${min} belgidan iborat bo'lishi kerak`
            : `${field} majburiy`);
    }
    return result;
};

/**
 * Ixtiyoriy son: bo'sh bo'lsa null, aks holda chegaralar tekshiriladi
 */
const optionalNumber = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, field, integer = false }) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || (integer && !Number.isInteger(num)) || num < min || num > max) {
        throw new HttpError(400, `${field} ${min} va ${max} oralig'ida bo'lishi kerak`);
    }
    return num;
};

/**
 * Sahifalash parametrlari (page, limit)
 */
const parsePagination = (queryParams, { defaultLimit = 12, maxLimit = 50 } = {}) => {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(queryParams.limit, 10) || defaultLimit));
    return { page, limit, offset: (page - 1) * limit };
};

module.exports = {
    normalizePhone,
    isUuid,
    assertUuid,
    optionalString,
    requiredString,
    optionalNumber,
    parsePagination,
};
