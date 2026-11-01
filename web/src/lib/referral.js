// =============================================
// Taklif (referal) kodi: /r/KOD yoki ?ref=KOD orqali kelgan mehmonning kodi eslab qolinadi
// va ro'yxatdan o'tishda yuboriladi (faqat yangi hisob taklif qilgan odamga bog'lanadi)
// =============================================

const KEY = 'usta24_ref';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE = /^[A-Za-z0-9]{4,12}$/;

export function rememberRef(code) {
  if (!CODE.test(String(code || ''))) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: String(code).toUpperCase(), at: Date.now() }));
  } catch {
    // Saqlab bo'lmasa (maxfiy rejim) - taklif hisobga olinmaydi
  }
}

export function storedRef() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value?.code || Date.now() - value.at > TTL_MS) return null;
    return value.code;
  } catch {
    return null;
  }
}

export function forgetRef() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // e'tiborsiz
  }
}

/** Istalgan sahifadagi ?ref=KOD */
export function captureRefFromUrl() {
  const code = new URLSearchParams(window.location.search).get('ref');
  if (code) rememberRef(code);
}
