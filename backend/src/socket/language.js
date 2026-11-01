// =============================================
// UyRemont - Socket xabarlari foydalanuvchi tilida
// Har bir ulanish o'z tilining xonasida turadi (lang_uz / lang_ru). Matnli hodisa (masalan,
// commission_updated.message, dispatch_offline.reason) har bir til uchun alohida tuziladi va faqat o'sha
// tildagi ulanishlarga yuboriladi - umumiy xonalarda (order_<id>) ham har kim o'z tilida oladi.
// Foydalanuvchi tilni almashtirsa (PUT /api/auth/me) ochiq ulanishlari yangi til xonasiga o'tkaziladi.
// =============================================

const { LANGUAGES, DEFAULT_LANGUAGE, normalizeLanguage } = require('../i18n');

const languageRoom = (lang) => `lang_${lang}`;
const otherLanguageRooms = (lang) => LANGUAGES.filter((code) => code !== lang).map(languageRoom);

/**
 * Ulanishni foydalanuvchi tili xonasiga qo'shish (ulanish paytida)
 */
const joinLanguageRoom = (socket, lang) => {
    const target = normalizeLanguage(lang);
    otherLanguageRooms(target).forEach((room) => socket.leave(room));
    socket.join(languageRoom(target));
};

const socketLanguage = (socket) => LANGUAGES.find((lang) => socket.rooms.has(languageRoom(lang))) || DEFAULT_LANGUAGE;

/**
 * Foydalanuvchining barcha ochiq ulanishlarini yangi til xonasiga o'tkazish
 */
const setUserSocketsLanguage = (io, userId, lang) => {
    if (!io || !userId) return;
    const target = normalizeLanguage(lang);
    const sockets = io.in(`user_${userId}`);
    sockets.socketsLeave(otherLanguageRooms(target));
    sockets.socketsJoin(languageRoom(target));
};

/**
 * Hodisa yuborish. payload funksiya bo'lsa (lang) => payload: har bir til xonasiga o'z tilidagi nusxa.
 * @param {import('socket.io').BroadcastOperator} target - io.to(room)
 * @param {string} event
 * @param {object|((lang: string) => object)} payload
 */
const emitLocalized = (target, event, payload) => {
    if (typeof payload !== 'function') {
        target.emit(event, payload);
        return;
    }
    LANGUAGES.forEach((lang) => target.except(otherLanguageRooms(lang)).emit(event, payload(lang)));
};

module.exports = {
    languageRoom, joinLanguageRoom, socketLanguage, setUserSocketsLanguage, emitLocalized,
};
