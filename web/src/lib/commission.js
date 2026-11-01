// Komissiya hisobi: yorliqlar va summa formati (usta va admin sahifalari uchun umumiy)
// Yorliqlar xaritasi o'zbekcha qoladi, ko'rsatishda t() bilan tarjima qilinadi
import { t } from '../i18n/index.js';

export const PAYMENT_METHODS = [
  ['card', 'Karta'],
  ['cash', 'Naqd'],
  ['transfer', 'Bank o\'tkazmasi'],
  ['other', 'Boshqa']
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS);

export const ENTRY_LABELS = {
  commission: 'Komissiya',
  payment: 'To\'lov',
  adjustment: 'Tuzatish',
  bonus: 'Bonus'
};

/**
 * Summa (0 ham ko'rsatiladi, formatPrice'dan farqli ravishda "Kelishiladi" emas)
 * @param {number} value
 * @param {{ sign?: boolean }} options sign=true bo'lsa "+15 000" / "−15 000"
 */
export function formatSum(value, { sign = false } = {}) {
  const num = Math.round(Number(value) || 0);
  const text = t('{sum} so\'m', { sum: Math.abs(num).toLocaleString('ru-RU') });
  if (!sign || num === 0) return num < 0 ? `−${text}` : text;
  return `${num > 0 ? '+' : '−'}${text}`;
}

/**
 * Qarz holati: matn va ohang (rang uchun)
 * @param {number} due
 * @param {number} limit 0 bo'lsa cheklov yo'q
 */
export function debtStatus(due, limit) {
  if (due <= 0) return { tone: 'ok', text: due < 0 ? t('Oldindan to\'langan: {sum}', { sum: formatSum(-due) }) : t('Qarzingiz yo\'q') };
  if (limit > 0 && due > limit) return { tone: 'blocked', text: t('Limitdan oshgan — to\'lamaguningizcha yangi takliflar kelmaydi') };
  if (limit > 0 && due >= limit * 0.8) return { tone: 'warn', text: t('Limitga yaqin — vaqtida to\'lang') };
  return { tone: 'normal', text: limit > 0 ? t('Limit {sum}: oshsa, yangi takliflar to\'xtaydi', { sum: formatSum(limit) }) : t('To\'lovni vaqtida qiling') };
}
