import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Wallet, ChevronRight, User } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDate, formatPrice } from '../lib/format';
import { useSpecializations } from '../lib/useSpecializations';
import { t, specName } from '../i18n';

/**
 * Buyurtmadagi mutaxassislik nomi joriy tilda (buyurtma API si faqat name_uz beradi,
 * ruschasi katalogdan olinadi)
 */
export const orderSpecName = (order, specializations = []) => specName(
  specializations.find((s) => s.id === order.specialization_id)
  || { name_uz: order.specialization_name, name_ru: order.specialization_name_ru }
);

/** "Tuman, manzil" (tuman ko'rsatishda tarjima qilinadi) */
export const orderPlace = (order) => [order.district && t(order.district), order.address].filter(Boolean).join(', ');

export default function OrderListItem({ order, viewerRole, action }) {
  const { specializations } = useSpecializations();
  const counterpart = viewerRole === 'client'
    ? order.master_name || (order.master_id ? t('Usta') : t('Usta biriktirilmagan'))
    : viewerRole === 'master'
      ? order.client_name || t('Mijoz')
      : `${order.client_name || t('Mijoz')} → ${order.master_name || t('ochiq')}`;

  return (
    <div className="card hover:border-slate-300 hover:shadow-sm transition">
      <Link to={`/orders/${order.id}`} className="block p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {order.mode === 'instant' && (
                <span className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md">{t('⚡ TEZKOR')}</span>
              )}
              <h3 className="font-bold text-slate-900 truncate">{order.title}</h3>
              {order.specialization_name && (
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {order.specialization_icon} {orderSpecName(order, specializations)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <User className="w-3 h-3" /> {counterpart}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusBadge status={order.status} />
            <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />
          </div>
        </div>

        {order.description && <p className="text-xs text-slate-600 mt-2 line-clamp-2">{order.description}</p>}

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{orderPlace(order)}</span>
          <span className="flex items-center gap-1"><Wallet className="w-3 h-3" />{formatPrice(order.final_price || order.budget || order.call_fee)}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(order.created_at)}</span>
        </div>
      </Link>
      {action && <div className="px-4 sm:px-5 pb-4 -mt-1">{action}</div>}
    </div>
  );
}

export function OrderListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="card p-5 animate-pulse">
          <div className="flex justify-between">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-5 bg-slate-200 rounded w-20" />
          </div>
          <div className="h-3 bg-slate-200 rounded w-1/4 mt-2" />
          <div className="h-3 bg-slate-100 rounded w-2/3 mt-4" />
        </div>
      ))}
    </div>
  );
}
