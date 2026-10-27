// =============================================
// Formatlash va holat yorliqlari
// =============================================

export const formatPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 'Kelishiladi';
  return `${Math.round(num).toLocaleString('ru-RU')} so'm`;
};

export const formatRating = (value) => Number(value || 0).toFixed(1);

export const formatDate = (value, withTime = true) => {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime && { hour: '2-digit', minute: '2-digit' })
  });
};

export const formatPhone = (phone) => {
  if (!phone) return '';
  const m = phone.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
};

export const ORDER_STATUSES = {
  pending: { label: 'Kutilmoqda', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  searching: { label: 'Usta qidirilmoqda', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'Qabul qilindi', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  arrived: { label: 'Usta yetib keldi', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  in_progress: { label: 'Bajarilmoqda', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed: { label: 'Yakunlandi', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Bekor qilindi', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  expired: { label: 'Usta topilmadi', className: 'bg-slate-100 text-slate-600 border-slate-200' }
};

export const ROLE_LABELS = {
  client: 'Mijoz',
  master: 'Usta',
  admin: 'Administrator'
};

/**
 * Backenddagi TRANSITIONS jadvaliga mos: joriy foydalanuvchi bajara oladigan amallar
 */
export function getOrderActions(order, user) {
  // Tezkor chaqiruv amallari InstantOrderPanel komponentida
  if (!order || !user || order.mode === 'instant') return [];
  const isClient = order.client_id === user.id;
  const isMaster = order.master_id === user.id;
  const isAdmin = user.role === 'admin';
  const isOpen = order.status === 'pending' && !order.master_id;
  const actions = [];

  switch (order.status) {
    case 'pending':
      if (isMaster || (user.role === 'master' && isOpen && !isClient) || (isAdmin && order.master_id)) {
        actions.push({ status: 'accepted', label: isOpen ? 'Buyurtmani olish' : 'Qabul qilish', tone: 'primary' });
      }
      if (isClient || isMaster || isAdmin) {
        actions.push({ status: 'cancelled', label: isMaster ? 'Rad etish' : 'Bekor qilish', tone: 'danger', confirm: true });
      }
      break;
    case 'accepted':
      if (isMaster || isAdmin) actions.push({ status: 'in_progress', label: 'Ishni boshlash', tone: 'primary' });
      if (isClient || isMaster || isAdmin) {
        actions.push({ status: 'cancelled', label: 'Bekor qilish', tone: 'danger', confirm: true });
      }
      break;
    case 'in_progress':
      if (isClient || isMaster || isAdmin) {
        actions.push({ status: 'completed', label: 'Ish yakunlandi', tone: 'success', confirm: true });
      }
      break;
    default:
      break;
  }
  return actions;
}
