import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Star, Wallet, Zap } from 'lucide-react';
import Spinner from './Spinner';
import OrderPhotos from './OrderPhotos';
import { formatPrice, formatRating } from '../lib/format';

/**
 * Qisqa ovozli signal (brauzer ruxsat bergan bo'lsa)
 */
function playAlert() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // ovoz o'chirilgan bo'lishi mumkin
  }
  navigator.vibrate?.([200, 100, 200]);
}

/**
 * Ustaga kelgan taklif: vaqt tugaguncha qabul qilish yoki rad etish
 */
export default function OfferModal({ offer, onAccept, onDecline }) {
  const total = offer.timeout_sec || 20;
  const [left, setLeft] = useState(() => Math.max(0, Math.round((new Date(offer.expires_at) - Date.now()) / 1000)));
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    playAlert();
  }, [offer.offer_id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft(Math.max(0, Math.round((new Date(offer.expires_at) - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [offer.expires_at]);

  const act = async (kind) => {
    setBusy(kind);
    try {
      await (kind === 'accept' ? onAccept() : onDecline());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] bg-ink/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="offer-title">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-slate-100">
          <div
            className={`h-full transition-all duration-300 ${left <= 5 ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${(left / total) * 100}%` }}
          />
        </div>
        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
              <Zap className="w-3.5 h-3.5" /> Yangi buyurtma
            </span>
            <span className={`text-2xl font-black tabular-nums ${left <= 5 ? 'text-red-600' : 'text-slate-900'}`}>{left}s</span>
          </div>

          <h3 id="offer-title" className="text-xl font-extrabold text-slate-900">
            {offer.specialization_icon} {offer.title}
          </h3>
          {offer.description && <p className="text-sm text-slate-600 mt-1 line-clamp-3">{offer.description}</p>}
          {offer.photos?.length > 0 && (
            <div className="mt-3">
              <OrderPhotos orderId={offer.order_id} photoIds={offer.photos} thumbClassName="w-16 h-16" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-[11px] text-slate-400 flex items-center gap-1"><Navigation className="w-3 h-3" /> Masofa</span>
              <span className="font-bold text-slate-900">{Number(offer.distance_km).toFixed(1)} km · ~{offer.eta_min} daq</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-[11px] text-slate-400 flex items-center gap-1"><Wallet className="w-3 h-3" /> Chiqish narxi</span>
              <span className="font-bold text-slate-900">{formatPrice(offer.call_fee)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 col-span-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Manzil</span>
              <span className="font-semibold text-slate-800">{[offer.district, offer.address].filter(Boolean).join(', ')}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
            Mijoz: <strong className="text-slate-700">{offer.client_name}</strong>
            <Star className="w-3.5 h-3.5 text-amber-500 fill-current ml-1" /> {formatRating(offer.client_rating)}
          </p>

          <div className="grid grid-cols-3 gap-2 mt-5">
            <button
              onClick={() => act('decline')}
              disabled={Boolean(busy)}
              className="btn btn-secondary min-h-14 rounded-2xl font-bold"
            >
              {busy === 'decline' ? <Spinner className="w-4 h-4" /> : 'Rad etish'}
            </button>
            <button
              onClick={() => act('accept')}
              disabled={Boolean(busy) || left === 0}
              className="btn btn-success btn-lg col-span-2"
            >
              {busy === 'accept' ? <Spinner className="w-5 h-5 text-white" /> : 'Qabul qilish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
