// Komissiya hisobi: yorliqlar va summa formati (usta va admin sahifalari uchun umumiy)

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
  adjustment: 'Tuzatish'
};

/**
 * Summa (0 ham ko'rsatiladi, formatPrice'dan farqli ravishda "Kelishiladi" emas)
 * @param {number} value
 * @param {{ sign?: boolean }} options sign=true bo'lsa "+15 000" / "−15 000"
 */
export function formatSum(value, { sign = false } = {}) {
  const num = Math.round(Number(value) || 0);
  const text = `${Math.abs(num).toLocaleString('ru-RU')} so'm`;
  if (!sign || num === 0) return num < 0 ? `−${text}` : text;
  return `${num > 0 ? '+' : '−'}${text}`;
}

/**
 * Qarz holati: matn va ohang (rang uchun)
 * @param {number} due
 * @param {number} limit 0 bo'lsa cheklov yo'q
 */
export function debtStatus(due, limit) {
  if (due <= 0) return { tone: 'ok', text: due < 0 ? `Oldindan to'langan: ${formatSum(-due)}` : 'Qarzingiz yo\'q' };
  if (limit > 0 && due > limit) return { tone: 'blocked', text: 'Limitdan oshgan — to\'lamaguningizcha yangi takliflar kelmaydi' };
  if (limit > 0 && due >= limit * 0.8) return { tone: 'warn', text: 'Limitga yaqin — vaqtida to\'lang' };
  return { tone: 'normal', text: limit > 0 ? `Limit ${formatSum(limit)}: oshsa, yangi takliflar to'xtaydi` : 'To\'lovni vaqtida qiling' };
}
