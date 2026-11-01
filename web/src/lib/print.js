// Chop etiladigan varaqalar uchun yordamchilar

/**
 * Sayt hali haqiqiy domenda emasmi (kompyuter, mahalliy tarmoq yoki vaqtinchalik tunnel).
 * Bunday manzildagi QR kodni chop etish befoyda: boshqa telefonda ochilmaydi yoki ertaga o'zgaradi.
 * @param {string} hostname masalan window.location.hostname
 */
export function isTemporaryHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === ''
    || host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host.endsWith('.trycloudflare.com')
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    || host.includes(':');
}

/**
 * Varaqada ko'rsatiladigan qisqa manzil: "usta24.uz/u/jasur"
 * @param {string} origin masalan https://usta24.uz
 * @param {string} pathname
 */
export function shortUrl(origin, pathname = '') {
  return `${String(origin).replace(/^https?:\/\//, '').replace(/\/$/, '')}${pathname}`;
}
