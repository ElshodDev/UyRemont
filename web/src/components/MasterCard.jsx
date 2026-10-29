import React from 'react';
import { MapPin, Star, ShieldCheck, Briefcase } from 'lucide-react';
import { formatPrice, formatRating } from '../lib/format';
import Avatar from './Avatar';

export const specializationLabel = (master) => (
  master.specializations?.map((s) => s.name_uz).join(', ') || 'Usta'
);

export default function MasterCard({ master, onView, onOrder }) {
  return (
    <article className="card shadow-sm hover:shadow-md transition flex flex-col overflow-hidden">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <Avatar src={master.avatar_url} name={master.name} />
            {master.is_verified && (
              <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 ring-2 ring-white" title="Tasdiqlangan usta" aria-label="Tasdiqlangan usta">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 truncate">{master.name || 'Usta'}</h3>
            <p className="text-xs font-semibold text-blue-600 mt-0.5 line-clamp-1">{specializationLabel(master)}</p>

            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center text-amber-700 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded-md" aria-label={`Reyting ${formatRating(master.rating)}`}>
                <Star className="w-3.5 h-3.5 fill-current mr-1 text-amber-500" aria-hidden="true" />
                {formatRating(master.rating)}
              </div>
              <span className="text-xs text-slate-400">({master.reviews_count || 0} ta sharh)</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed min-h-[2.5em]">
          {master.bio || 'Usta hali o\'zi haqida ma\'lumot qo\'shmagan.'}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Hudud:</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              {master.district || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Tajriba:</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
              <Briefcase className="w-3 h-3 text-slate-400" />
              {master.experience_years || 0} yil
            </span>
          </div>
        </div>

        <div className="mt-4 p-2.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Boshlang'ich narx:</span>
            <span className="font-extrabold text-blue-600 text-sm">{formatPrice(master.hourly_rate)}</span>
          </div>
          {master.is_available ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Bo'sh
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-md font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Band
            </span>
          )}
        </div>
      </div>

      <div className="p-3 bg-slate-50/70 border-t border-slate-100 grid grid-cols-2 gap-2">
        <button
          onClick={() => onView(master)}
          aria-label={`${master.name || 'Usta'} profilini ko'rish`}
          className="btn btn-secondary w-full px-3 text-xs"
        >
          Profilni ko'rish
        </button>
        <button
          onClick={() => onOrder(master)}
          className="btn btn-primary w-full px-3 text-xs font-bold"
          aria-label={`${master.name || 'Usta'}ga buyurtma berish`}
        >
          Buyurtma berish
        </button>
      </div>
    </article>
  );
}

export function MasterCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse" aria-hidden="true">
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-200" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-slate-200 rounded w-2/3" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-1/3" />
        </div>
      </div>
      <div className="h-3 bg-slate-200 rounded mt-4" />
      <div className="h-3 bg-slate-200 rounded mt-2 w-4/5" />
      <div className="h-12 bg-slate-100 rounded-xl mt-4" />
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="h-8 bg-slate-100 rounded-xl" />
        <div className="h-8 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}
