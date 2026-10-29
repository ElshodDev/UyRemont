import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Power, MapPin, Star, Percent, Wallet, CheckCircle, XCircle, AlertTriangle, Briefcase, ArrowRight, BookOpen
} from 'lucide-react';
import MapView from '../components/MapView';
import Spinner, { PageLoader } from '../components/Spinner';
import { useDispatch } from '../context/DispatchContext';
import { formatPrice, formatRating, ORDER_STATUSES } from '../lib/format';
import { DISTRICT_COORDS, TASHKENT_CENTER } from '../lib/geo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-4">
      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><Icon className="w-3.5 h-3.5" /> {label}</span>
      <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Requirement({ ok, children }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-700' : 'text-red-600'}`}>
      {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {children}
    </li>
  );
}

export default function MasterWorkPage() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const { state, isOnline, gps, manualLocation, currentLocation } = dispatch;
  const [toggling, setToggling] = useState(false);
  const [config, setConfig] = useState(null);

  // Sahifa ochilganda holatni yangilash
  useEffect(() => {
    dispatch.refresh();
    api('/dispatch/config').then(({ data }) => setConfig(data)).catch(() => {});
  }, []);

  if (!state) return <PageLoader />;

  const toggle = async () => {
    setToggling(true);
    if (isOnline) await dispatch.goOffline();
    else await dispatch.goOnline();
    setToggling(false);
  };

  const req = state.requirements;
  const mapCenter = currentLocation || DISTRICT_COORDS[user.district] || TASHKENT_CENTER;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-4">
      <div className={`rounded-3xl p-6 sm:p-8 text-white transition-colors ${isOnline ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-slate-700 to-slate-900'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Ish rejimi</p>
            <h1 className="text-3xl font-black mt-1">{isOnline ? 'Siz ishdasiz' : 'Siz dam olyapsiz'}</h1>
            <p className="text-sm text-white/80 mt-1 max-w-md">
              {isOnline
                ? 'Yaqin atrofdagi tezkor chaqiruvlar sizga signal bilan keladi. Taklifga javob berish vaqti cheklangan.'
                : '«Ishga chiqish» tugmasini bosing — tizim sizga eng yaqin mijozlarning chaqiruvlarini yuboradi.'}
            </p>
          </div>
          <button
            onClick={toggle}
            disabled={toggling || (!isOnline && !req.can_go_online)}
            className={`w-28 h-28 rounded-full flex flex-col items-center justify-center font-black text-sm shadow-xl transition disabled:opacity-50 flex-shrink-0 ${
              isOnline ? 'bg-white text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-500 text-white hover:bg-emerald-400'
            }`}
            aria-pressed={isOnline}
          >
            {toggling ? <Spinner className="w-6 h-6" /> : <Power className="w-8 h-8 mb-1" />}
            {isOnline ? 'Ishni to\'xtatish' : 'Ishga chiqish'}
          </button>
        </div>
        {state.missed_offers_streak > 0 && config && (
          <p className="mt-4 text-xs font-semibold bg-white/15 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" />
            Ketma-ket javobsiz takliflar: {state.missed_offers_streak} / {config.max_missed_offers}
          </p>
        )}
      </div>

      {!req.can_go_online && (
        <div className="bg-white rounded-2xl border border-red-200 p-5">
          <h2 className="font-bold text-slate-900 mb-2">Ishga chiqish uchun:</h2>
          <ul className="space-y-1.5">
            <Requirement ok={req.verified}>Profil administrator tomonidan tasdiqlangan</Requirement>
            <Requirement ok={req.has_specializations}>
              Kamida bitta mutaxassislik tanlangan — <Link to="/master/profile" className="underline">profilni tahrirlash</Link>
            </Requirement>
            <Requirement ok={req.rating_ok}>Reyting {config?.min_rating ?? 4} dan past emas</Requirement>
          </ul>
        </div>
      )}

      {state.active_job && (
        <Link
          to={`/orders/${state.active_job.id}`}
          className="block bg-blue-600 text-white rounded-2xl p-5 hover:bg-blue-700 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-100">Faol ish · {ORDER_STATUSES[state.active_job.status]?.label}</p>
              <p className="font-bold truncate">{state.active_job.title}</p>
              <p className="text-xs text-blue-100 truncate">{state.active_job.address}</p>
            </div>
            <ArrowRight className="w-5 h-5 flex-shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Briefcase} label="Bugun bajarilgan" value={state.today.jobs} />
        <Stat icon={Wallet} label="Bugungi daromad" value={formatPrice(state.today.earnings)} hint={`Sof: ${formatPrice(state.today.net)}`} />
        <Stat icon={Percent} label={`Komissiya (${config?.commission_percent ?? 10}%)`} value={formatPrice(state.today.commission)} />
        <Stat icon={Star} label="Reyting" value={formatRating(state.rating)} hint={`${state.reviews_count} ta sharh`} />
        <Stat
          icon={CheckCircle}
          label="Qabul qilish"
          value={state.acceptance_rate === null ? '—' : `${state.acceptance_rate}%`}
          hint={`${state.offers_total} ta taklifdan`}
        />
        <Stat icon={XCircle} label="Voz kechilgan ishlar" value={state.cancelled_jobs} />
      </div>

      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> Joylashuvim</h2>
            <p className="text-xs text-slate-500">
              {gps.status === 'ok' && 'GPS orqali aniqlanmoqda'}
              {gps.status === 'locating' && 'GPS qidirilmoqda...'}
              {gps.status === 'error' && `${gps.error}. Xaritani bosib joyingizni belgilang.`}
              {gps.status === 'idle' && (manualLocation ? 'Xaritada belgilangan joy' : 'Ishga chiqqanda joylashuv aniqlanadi. GPS ishlamasa, xaritada belgilang.')}
            </p>
          </div>
          {manualLocation && (
            <button onClick={() => dispatch.setManualLocation(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Belgini olib tashlash
            </button>
          )}
        </div>
        <MapView
          center={mapCenter}
          markers={currentLocation ? [{ id: 'me', ...currentLocation, type: 'me', label: 'Siz shu yerdasiz' }] : []}
          onPick={(point) => dispatch.setManualLocation(point)}
          className="h-64"
        />
      </section>

      <Link to="/rules" className="flex items-center justify-between card p-4 hover:bg-slate-50">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><BookOpen className="w-4 h-4 text-blue-600" /> Ishlash qoidalari</span>
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </Link>
    </main>
  );
}
