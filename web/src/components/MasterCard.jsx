import React from 'react';
import { Star, BadgeCheck, MapPin } from 'lucide-react';
import { formatPrice, formatRating } from '../lib/format';
import Avatar from './Avatar';
import FavoriteButton from './FavoriteButton';
import { t, specName } from '../i18n';

export const specializationLabel = (master) => (
  master.specializations?.map((s) => specName(s)).join(', ') || t('Usta')
);

/**
 * Ixcham usta kartochkasi: kartochkaning o'zi profilni ochadi,
 * yurakcha va "Buyurtma berish" alohida tugmalar.
 */
export default function MasterCard({ master, onView, onOrder }) {
  const name = master.name || t('Usta');
  const reviews = Number(master.reviews_count) || 0;
  const years = Number(master.experience_years) || 0;
  const hasPrice = Number(master.hourly_rate) > 0;

  return (
    <article className="card relative p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-slate-300 hover:shadow-md transition">
      {/* Butun kartochka profilga olib boradi; ichidagi tugmalar ustida turadi (z-10) */}
      <button
        type="button"
        onClick={() => onView(master)}
        aria-label={t('{name} profilini ko\'rish', { name })}
        className="absolute inset-0 rounded-2xl"
      />

      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <Avatar src={master.avatar_url} name={name} className="w-14 h-14 rounded-2xl text-xl flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-bold text-slate-900 truncate">{name}</h3>
            {master.is_verified && (
              <BadgeCheck className="w-4 h-4 text-blue-600 flex-shrink-0" aria-label={t('Tasdiqlangan usta')} role="img" />
            )}
            {master.is_available === false && (
              <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                {t('Band')}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-blue-600 truncate mt-0.5">{specializationLabel(master)}</p>

          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-slate-500">
            {reviews > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold text-slate-800" aria-label={`${t('Reyting {rating}', { rating: formatRating(master.rating) })}, ${t('{n} ta sharh', { n: reviews })}`}>
                <Star className="w-3.5 h-3.5 fill-current text-amber-500" aria-hidden="true" />
                {formatRating(master.rating)}
                <span className="font-normal text-slate-500" aria-hidden="true">({reviews})</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">{t('Yangi usta')}</span>
            )}
            {years > 0 && (
              <span className="whitespace-nowrap">
                <span aria-hidden="true" className="text-slate-300 mr-1.5">·</span>
                {t('{n} yil', { n: years })}
              </span>
            )}
            {/* Tuman ikonka bilan: qator sig'masa keyingi qatorga o'zi tushadi */}
            {master.district && (
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap ml-1">
                <MapPin className="w-3 h-3 text-slate-400" aria-hidden="true" />
                {t(master.district)}
              </span>
            )}
          </p>
        </div>

        {/* Telefonda yurakcha yuqori o'ng burchakda */}
        <FavoriteButton master={master} className="relative z-10 -mt-1.5 -mr-1.5 flex-shrink-0 sm:hidden" />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 sm:border-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center flex-shrink-0">
        <p className="text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
          {hasPrice ? t('{price}dan', { price: formatPrice(master.hourly_rate) }) : (
            <span className="font-semibold text-slate-500">{t('Narx kelishiladi')}</span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <FavoriteButton master={master} className="relative z-10 hidden sm:inline-flex" />
          <button
            type="button"
            onClick={() => onOrder(master)}
            className="btn btn-primary btn-sm relative z-10 font-bold"
            aria-label={t('{name}ga buyurtma berish', { name })}
          >
            {t('Buyurtma berish')}
          </button>
        </div>
      </div>
    </article>
  );
}

export function MasterCardSkeleton() {
  return (
    <div className="card p-3.5 sm:p-4 animate-pulse flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4" aria-hidden="true">
      <div className="flex gap-3 flex-1">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-1/3" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
        <div className="h-4 bg-slate-200 rounded w-24" />
        <div className="h-10 bg-slate-200 rounded-lg w-32" />
      </div>
    </div>
  );
}
