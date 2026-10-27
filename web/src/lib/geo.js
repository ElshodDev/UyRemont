// =============================================
// Geolokatsiya yordamchilari
// =============================================

export const TASHKENT_CENTER = { lat: 41.3111, lng: 69.2797 };

// Tuman markazlari (xaritani boshlang'ich joylashtirish va tumanni aniqlash uchun)
export const DISTRICT_COORDS = {
  Chilonzor: { lat: 41.2756, lng: 69.2034 },
  Yunusobod: { lat: 41.364, lng: 69.2855 },
  "Mirzo Ulug'bek": { lat: 41.3385, lng: 69.3346 },
  Yakkasaroy: { lat: 41.283, lng: 69.258 },
  Mirobod: { lat: 41.293, lng: 69.283 },
  Sergeli: { lat: 41.228, lng: 69.22 },
  Uchtepa: { lat: 41.295, lng: 69.18 },
  Shayxontohur: { lat: 41.327, lng: 69.23 },
  Olmazor: { lat: 41.35, lng: 69.22 },
  Yashnobod: { lat: 41.295, lng: 69.35 }
};

export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Nuqtaga eng yaqin tuman (15 km dan uzoq bo'lsa null)
 */
export function nearestDistrict(point) {
  let best = null;
  Object.entries(DISTRICT_COORDS).forEach(([name, coords]) => {
    const distance = haversineKm(point, coords);
    if (!best || distance < best.distance) best = { name, distance };
  });
  return best && best.distance < 15 ? best.name : null;
}

const GEO_ERRORS = {
  1: 'Joylashuvga ruxsat berilmagan. Brauzer sozlamalarida ruxsat bering yoki xaritada belgilang.',
  2: 'Joylashuvni aniqlab bo\'lmadi. Xaritada belgilang.',
  3: 'Joylashuvni aniqlash juda uzoq davom etdi. Xaritada belgilang.'
};

/**
 * Brauzer orqali joriy joylashuv
 * @returns {Promise<{ lat: number, lng: number, accuracy: number }>}
 */
export function getCurrentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Brauzeringiz geolokatsiyani qo\'llab-quvvatlamaydi. Xaritada belgilang.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(GEO_ERRORS[err.code] || GEO_ERRORS[2])),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  });
}

/**
 * Yandex Navigator / Xaritalar orqali yo'nalish
 */
export const navigationUrl = (lat, lng) => `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;
