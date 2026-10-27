import React, { useEffect, useState } from 'react';
import { Star, Phone, ShieldCheck, MapPin, Briefcase, CheckCircle } from 'lucide-react';
import Modal from './Modal';
import Spinner from './Spinner';
import StarRating from './StarRating';
import Avatar from './Avatar';
import { specializationLabel } from './MasterCard';
import { api, assetUrl } from '../lib/api';
import { formatDate, formatPhone, formatPrice, formatRating } from '../lib/format';

export default function MasterProfileModal({ masterId, onClose, onOrder }) {
  const [master, setMaster] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api(`/masters/${masterId}`, { signal: controller.signal })
      .then(({ data }) => setMaster(data))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, [masterId]);

  return (
    <Modal onClose={onClose} size="lg">
      {!master && !error && (
        <div className="py-16 flex justify-center"><Spinner className="w-6 h-6 text-blue-600" label="Yuklanmoqda..." /></div>
      )}
      {error && <p className="py-10 text-center text-sm text-red-600">{error}</p>}

      {master && (
        <>
          <div className="flex items-center gap-4 mb-4 pr-8">
            <Avatar src={master.avatar_url} name={master.name} className="w-20 h-20 rounded-2xl text-3xl flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
                <span className="truncate">{master.name}</span>
                {master.is_verified && <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" title="Tasdiqlangan" />}
              </h3>
              <p className="text-sm font-semibold text-blue-600">{specializationLabel(master)}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center text-amber-500 text-xs font-bold">
                  <Star className="w-4 h-4 fill-current mr-1" />
                  {formatRating(master.rating)}
                </div>
                <span className="text-xs text-slate-400">({master.reviews_count} ta baholash)</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-slate-900 mb-1">Usta haqida:</h4>
              <p className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {master.bio || 'Ma\'lumot qo\'shilmagan.'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { icon: Briefcase, label: 'Tajriba', value: `${master.experience_years || 0} yil` },
                { icon: MapPin, label: 'Tuman', value: master.district || '—' },
                { icon: CheckCircle, label: 'Bajarilgan', value: `${master.completed_orders} ta` },
                { icon: Star, label: 'Narx', value: formatPrice(master.hourly_rate) }
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">{value}</span>
                </div>
              ))}
            </div>

            {master.portfolio.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Bajarilgan ishlar (Portfolio):</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {master.portfolio.map((item) => (
                    <a key={item.id} href={assetUrl(item.image_url)} target="_blank" rel="noreferrer" className="group">
                      <img
                        src={assetUrl(item.image_url)}
                        alt={item.description || 'ish namunasi'}
                        loading="lazy"
                        className="rounded-xl h-28 w-full object-cover border border-slate-200 group-hover:opacity-90"
                      />
                      {item.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{item.description}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Mijozlar sharhlari:</h4>
              {master.recent_reviews.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl">Hozircha sharhlar yo'q.</p>
              ) : (
                <div className="space-y-2">
                  {master.recent_reviews.map((review) => (
                    <div key={review.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">{review.client_name || 'Mijoz'}</span>
                        <StarRating value={review.rating} size="w-3.5 h-3.5" />
                      </div>
                      {review.comment && <p className="text-xs text-slate-600 mt-1">{review.comment}</p>}
                      <p className="text-[10px] text-slate-400 mt-1">{formatDate(review.created_at, false)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs text-blue-700 font-semibold block">To'g'ridan-to'g'ri raqam:</span>
                <span className="text-base font-extrabold text-blue-900">{formatPhone(master.phone)}</span>
              </div>
              <a
                href={`tel:${master.phone}`}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700"
              >
                <Phone className="w-3.5 h-3.5" />
                Qo'ng'iroq
              </a>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => onOrder(master)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20"
            >
              Ushbu ustaga buyurtma berish
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
