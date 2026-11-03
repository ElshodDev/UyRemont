import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MapPin, Star, Percent, Wallet, CheckCircle, XCircle, AlertTriangle, Briefcase, ArrowRight, BookOpen, Send, Clock, PartyPopper
} from 'lucide-react';
import MapView from '../components/MapView';
import WorkToggle from '../components/WorkToggle';
import { PageLoader } from '../components/Spinner';
import { useDispatch } from '../context/DispatchContext';
import { formatRating, ORDER_STATUSES } from '../lib/format';
import { DISTRICT_COORDS, TASHKENT_CENTER } from '../lib/geo';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useLoginMethods } from '../lib/telegram';
import { debtStatus, formatSum } from '../lib/commission';
import { t } from '../i18n';

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
  const [config, setConfig] = useState(null);
  const [verification, setVerification] = useState(null);
  const loginMethods = useLoginMethods();
  const location = useLocation();
  // Ro'yxatdan o'tgandan keyin birinchi kirish
  const welcome = Boolean(location.state?.welcome);

  // Sahifa ochilganda holatni yangilash
  useEffect(() => {
    dispatch.refresh();
    api('/dispatch/config').then(({ data }) => setConfig(data)).catch(() => {});
  }, []);

  // Tasdiqlanmagan usta: pasport tekshirilmoqdami yoki hali yuborilmaganmi
  const verified = state?.requirements?.verified;
  useEffect(() => {
    if (verified !== false) return;
    api('/masters/me/verification').then(({ data }) => setVerification(data)).catch(() => {});
  }, [verified]);

  if (!state) return <PageLoader />;

  const req = state.requirements;
  const activeStatus = state.active_job && ORDER_STATUSES[state.active_job.status]?.label;
  const mapCenter = currentLocation || DISTRICT_COORDS[user.district] || TASHKENT_CENTER;
  // Tasdiqlash holati alohida kartada ko'rsatilsa, ro'yxatda takrorlanmaydi
  const showVerifiedRow = !(verified === false && verification);
  const otherBlockers = !req.has_specializations || !req.rating_ok || req.prices_ok === false || req.commission_ok === false;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-4">
      <div className={`rounded-3xl p-6 sm:p-8 text-white transition-colors ${isOnline ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-slate-700 to-slate-900'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{t('Ish rejimi')}</p>
            <h1 className="text-3xl font-black mt-1">{isOnline ? t('Siz ishdasiz') : t('Siz dam olyapsiz')}</h1>
            <p className="text-sm text-white/80 mt-1 max-w-md">
              {isOnline
                ? t('Yaqin atrofdagi tezkor chaqiruvlar sizga signal bilan keladi. Taklifga javob berish vaqti cheklangan.')
                : t('«Ishga chiqish» tugmasini bosing — tizim sizga eng yaqin mijozlarning chaqiruvlarini yuboradi.')}
            </p>
          </div>
        </div>
        <div className="mt-5"><WorkToggle /></div>
        {state.missed_offers_streak > 0 && config && (
          <p className="mt-4 text-xs font-semibold bg-white/15 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('Ketma-ket javobsiz takliflar: {n} / {max}', { n: state.missed_offers_streak, max: config.max_missed_offers })}
          </p>
        )}
      </div>

      {welcome && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
          <PartyPopper className="w-6 h-6 text-emerald-600 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold text-slate-900">{t('Tabriklaymiz! Siz Usta24 ustasisiz')}</p>
            <p className="text-sm text-slate-600 mt-0.5">{t('Profilingiz katalogga qo\'shildi: mijozlar sizga buyurtma bera oladi.')}</p>
          </div>
        </div>
      )}

      {verified === false && verification && (
        verification.status === 'pending' ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
            <Clock className="w-6 h-6 text-blue-600 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold text-slate-900">{t('Pasportingiz tekshirilmoqda')}</p>
              <p className="text-sm text-slate-600 mt-0.5">{t('Administrator tasdiqlagach «Ishga chiqish» tugmasi ochiladi. Odatda 24 soat ichida, natija Telegram\'da ham keladi.')}</p>
            </div>
          </div>
        ) : (
          <Link to="/master/profile#tasdiqlash" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3 hover:bg-amber-100 transition">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">
              <span className="block font-bold text-slate-900">
                {verification.status === 'rejected' ? t('Pasport tasdiqlanmadi — qayta yuboring') : t('Ishga chiqish uchun pasportingizni yuboring')}
              </span>
              <span className="block text-sm text-slate-600 mt-0.5">
                {verification.status === 'rejected' && verification.note
                  ? t('Sabab: {note}', { note: verification.note })
                  : t('Pasport seriya-raqami va rasmini yuklang, administrator tekshiradi.')}
              </span>
            </span>
            <ArrowRight className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          </Link>
        )
      )}

      {!req.can_go_online && (showVerifiedRow || otherBlockers) && (
        <div className="bg-white rounded-2xl border border-red-200 p-5">
          <h2 className="font-bold text-slate-900 mb-2">{t('Ishga chiqish uchun:')}</h2>
          <ul className="space-y-1.5">
            {showVerifiedRow && (
              <Requirement ok={req.verified}>
                {t('Profil administrator tomonidan tasdiqlangan')} — <Link to="/master/profile#tasdiqlash" className="underline">{t('hujjat yuklash')}</Link>
              </Requirement>
            )}
            <Requirement ok={req.has_specializations}>
              {t('Kamida bitta mutaxassislik tanlangan')} — <Link to="/master/profile" className="underline">{t('profilni tahrirlash')}</Link>
            </Requirement>
            <Requirement ok={req.rating_ok}>{t('Reyting {min} dan past emas', { min: config?.min_rating ?? 4 })}</Requirement>
            {req.prices_ok === false && (
              <Requirement ok={false}>
                {t('Mijoz yakunlagan buyurtmalarning summasi kiritilgan')} — <Link to="/orders" className="underline">{t('Buyurtmalarim')}</Link>
              </Requirement>
            )}
            {req.commission_ok === false && (
              <Requirement ok={false}>
                {t('Komissiya qarzi limitdan oshmagan')} — <Link to="/master/hisob" className="underline">{t('to\'lash')}</Link>
              </Requirement>
            )}
          </ul>
        </div>
      )}

      {loginMethods?.enabled && !user.telegram && (
        <Link to="/profile#telegram" className="flex items-center gap-3 rounded-2xl p-4 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition">
          <span className="w-10 h-10 rounded-xl bg-[#229ED9] text-white flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <Send className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-slate-900">{t('Telegram\'ni ulang')}</span>
            <span className="block text-xs text-slate-600">{t('Ilova yopiq bo\'lsa ham buyurtma Telegram\'ga keladi va o\'sha yerda qabul qilasiz')}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </Link>
      )}

      {state.active_job && (
        <Link
          to={`/orders/${state.active_job.id}`}
          className="block bg-blue-600 text-white rounded-2xl p-5 hover:bg-blue-700 transition"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-100">{t('Faol ish')}{activeStatus ? ` · ${t(activeStatus)}` : ''}</p>
              <p className="font-bold truncate">{state.active_job.title}</p>
              <p className="text-xs text-blue-100 truncate">{state.active_job.address}</p>
            </div>
            <ArrowRight className="w-5 h-5 flex-shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Briefcase} label={t('Bugun bajarilgan')} value={state.today.jobs} />
        <Stat icon={Wallet} label={t('Bugungi daromad')} value={formatSum(state.today.earnings)} hint={t('Sof: {sum}', { sum: formatSum(state.today.net) })} />
        <Stat icon={Percent} label={t('Bugungi komissiya ({percent}%)', { percent: config?.commission_percent ?? 10 })} value={formatSum(state.today.commission)} hint={t('faqat tezkor chaqiruvlar')} />
        <Stat icon={Star} label={t('Reyting')} value={formatRating(state.rating)} hint={t('{n} ta sharh', { n: state.reviews_count })} />
        <Stat
          icon={CheckCircle}
          label={t('Qabul qilish foizi')}
          value={state.acceptance_rate === null ? '—' : `${state.acceptance_rate}%`}
          hint={t('{n} ta taklifdan', { n: state.offers_total })}
        />
        <Stat icon={XCircle} label={t('Voz kechilgan ishlar')} value={state.cancelled_jobs} />
      </div>

      {state.commission && (() => {
        const { due, limit } = state.commission;
        const status = debtStatus(due, limit);
        const tone = {
          ok: 'border-emerald-200', normal: 'border-slate-200', warn: 'border-amber-300 bg-amber-50', blocked: 'border-red-300 bg-red-50'
        }[status.tone];
        return (
          <Link to="/master/hisob" className={`flex items-center gap-3 rounded-2xl border p-4 hover:shadow-sm transition bg-white ${tone}`}>
            <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Wallet className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-slate-500">{t('Komissiya qarzi')}</span>
              <span className="block text-lg font-black text-slate-900 tabular-nums">{formatSum(Math.max(0, due))}</span>
              <span className={`block text-xs ${status.tone === 'blocked' ? 'text-red-700 font-semibold' : status.tone === 'warn' ? 'text-amber-800 font-semibold' : 'text-slate-500'}`}>{status.text}</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
          </Link>
        );
      })()}

      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" /> {t('Joylashuvim')}</h2>
            <p className="text-xs text-slate-500">
              {gps.status === 'ok' && t('GPS orqali aniqlanmoqda')}
              {gps.status === 'locating' && t('GPS qidirilmoqda...')}
              {gps.status === 'error' && t('{error}. Xaritani bosib joyingizni belgilang.', { error: gps.error })}
              {gps.status === 'idle' && (manualLocation ? t('Xaritada belgilangan joy') : t('Ishga chiqqanda joylashuv aniqlanadi. GPS ishlamasa, xaritada belgilang.'))}
            </p>
          </div>
          {manualLocation && (
            <button onClick={() => dispatch.setManualLocation(null)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              {t('Belgini olib tashlash')}
            </button>
          )}
        </div>
        <MapView
          center={mapCenter}
          markers={currentLocation ? [{ id: 'me', ...currentLocation, type: 'me', label: t('Siz shu yerdasiz') }] : []}
          onPick={(point) => dispatch.setManualLocation(point)}
          className="h-64"
        />
      </section>

      <Link to="/rules" className="flex items-center justify-between card p-4 hover:bg-slate-50">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800"><BookOpen className="w-4 h-4 text-blue-600" /> {t('Ishlash qoidalari')}</span>
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </Link>
    </main>
  );
}
