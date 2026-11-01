// Murojaat turlari va holatlari (backend support.controller bilan mos)
export const SUPPORT_CATEGORIES = {
  master_no_show: { label: 'Usta kelmadi yoki kechikdi', roles: ['client'], needsOrder: true },
  price_dispute: { label: 'Narx bo\'yicha kelishmovchilik', roles: ['client', 'master'], needsOrder: true },
  quality: { label: 'Ish sifati yomon', roles: ['client'], needsOrder: true },
  client_no_pay: { label: 'Mijoz to\'lamadi', roles: ['master'], needsOrder: true },
  behavior: { label: 'Qo\'pol muomala yoki xavfli holat', roles: ['client', 'master'], needsOrder: true },
  app_problem: { label: 'Ilovada xatolik', roles: ['client', 'master'], needsOrder: false },
  other: { label: 'Boshqa', roles: ['client', 'master'], needsOrder: false }
};

export const SUPPORT_STATUSES = {
  open: { label: 'Yangi', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'Ko\'rib chiqilmoqda', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  resolved: { label: 'Hal qilindi', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rad etildi', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

export const categoriesFor = (role, withOrder) => Object.entries(SUPPORT_CATEGORIES)
  .filter(([, c]) => c.roles.includes(role) && (withOrder || !c.needsOrder))
  .map(([id, c]) => ({ id, ...c }));
