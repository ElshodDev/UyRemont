import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Zap, LocateFixed, MapPin, Users, Clock, Wallet, Info } from 'lucide-react';
import MapView from '../components/MapView';
import Spinner, { PageLoader } from '../components/Spinner';
import { api } from '../lib/api';
import { useSpecializations } from '../lib/useSpecializations';
import { getCurrentPosition, nearestDistrict, TASHKENT_CENTER } from '../lib/geo';
import { formatPrice } from '../lib/format';
import { mainVerticals, districtsList } from '../data/catalog';
import { useToast } from '../context/ToastContext';

const inputClass = 'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm';

export default function CallMasterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const { specializations } = useSpecializations();

  const [checkingActive, setCheckingActive] = useState(true);
  const [vertical, setVertical] = useState(searchParams.get('vertical') || 'home');
  const [specId, setSpecId] = useState(null);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [form, setForm] = useState({ address: '', district: '', description: '' });
  const [estimate, setEstimate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Faol chaqiruv bo'lsa to'g'ridan-to'g'ri uning sahifasiga
  useEffect(() => {
    api('/dispatch/active')
      .then(({ data }) => {
        if (data) navigate(`/orders/${data.id}`, { replace: true });
        else setCheckingActive(false);
      })
      .catch(() => setCheckingActive(false));
  }, [navigate]);

  // URL dagi ?spec=slug bo'yicha xizmatni oldindan tanlash
  useEffect(() => {
    const slug = searchParams.get('spec');
    const found = slug && specializations.find((s) => s.slug === slug);
    if (found) {
      setVertical(found.vertical);
      setSpecId(found.id);
    }
  }, [specializations, searchParams]);

  const verticalSpecs = useMemo(
    () => specializations.filter((s) => s.vertical === vertical),
    [specializations, vertical]
  );
  const selectedSpec = specializations.find((s) => s.id === specId);

  const pickLocation = (point) => {
    setLocation(point);
    setLocationError('');
    const district = nearestDistrict(point);
    if (district) setForm((f) => ({ ...f, district }));
  };

  const locate = async () => {
    setLocating(true);
    setLocationError('');
    try {
      const pos = await getCurrentPosition();
      pickLocation({ lat: pos.lat, lng: pos.lng });
    } catch (error) {
      setLocationError(error.message);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!checkingActive) locate();
  }, [checkingActive]);

  // Narx va yaqin atrofdagi ustalar
  useEffect(() => {
    if (!specId || !location) {
      setEstimate(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api('/dispatch/estimate', { params: { specialization_id: specId, lat: location.lat, lng: location.lng }, signal: controller.signal })
        .then(({ data }) => setEstimate(data))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [specId, location]);

  const submit = async (e) => {
    e.preventDefault();
    if (!specId) return toast.error('Xizmat turini tanlang');
    if (!location) return toast.error('Xaritada manzilingizni belgilang');
    setSubmitting(true);
    try {
      const { data } = await api('/dispatch/orders', {
        method: 'POST',
        body: { specialization_id: specId, lat: location.lat, lng: location.lng, ...form }
      });
      navigate(`/orders/${data.id}`);
    } catch (error) {
      if (error.data?.data?.order_id) navigate(`/orders/${error.data.data.order_id}`);
      else toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingActive) return <PageLoader />;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Zap className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Usta chaqirish</h1>
          <p className="text-xs text-slate-500">Eng yaqin bo'sh usta avtomatik topiladi va manzilingizga yo'l oladi</p>
        </div>
      </div>

      <form onSubmit={submit} className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 text-sm mb-3">1. Qanday usta kerak?</h2>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
              {mainVerticals.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVertical(v.id); setSpecId(null); }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                    vertical === v.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {v.icon} {v.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {verticalSpecs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpecId(s.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    specId === s.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="block text-xs font-bold text-slate-800 mt-1">{s.name_uz}</span>
                  <span className="block text-[11px] text-slate-500">Chiqish: {formatPrice(s.call_fee)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-bold text-slate-900 text-sm">2. Qayerga?</h2>
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
              >
                {locating ? <Spinner className="w-3.5 h-3.5" /> : <LocateFixed className="w-3.5 h-3.5" />}
                Mening joylashuvim
              </button>
            </div>
            <MapView
              center={location || TASHKENT_CENTER}
              markers={location ? [{ id: 'client', ...location, type: 'client', draggable: true, label: 'Usta shu yerga keladi' }] : []}
              onPick={pickLocation}
              className="h-64 sm:h-72"
            />
            <p className={`text-[11px] mt-2 ${locationError ? 'text-amber-700' : 'text-slate-400'}`}>
              {locationError || (location ? 'Markerni surib yoki xaritani bosib aniq joyni belgilang.' : 'Xaritani bosib manzilingizni belgilang.')}
            </p>
            <div className="grid sm:grid-cols-3 gap-2 mt-3">
              <select
                className={inputClass}
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              >
                <option value="">Tuman</option>
                {districtsList.slice(1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                required
                minLength={3}
                maxLength={500}
                className={`${inputClass} sm:col-span-2`}
                placeholder="Ko'cha, uy, xonadon, mo'ljal"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 text-sm mb-3">3. Muammo nimada? <span className="font-normal text-slate-400">(ixtiyoriy)</span></h2>
            <textarea
              rows="3"
              maxLength={2000}
              className={inputClass}
              placeholder="Masalan: oshxonadagi kran oqyapti, smesitelni almashtirish kerak"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </section>
        </div>

        <aside className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:sticky lg:top-24 space-y-4">
            <h2 className="font-bold text-slate-900">Chaqiruv</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2"><Wallet className="w-4 h-4" /> Chiqish narxi</span>
                <span className="font-bold text-slate-900">{selectedSpec ? formatPrice(estimate?.call_fee ?? selectedSpec.call_fee) : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2"><Users className="w-4 h-4" /> Liniyadagi ustalar</span>
                <span className="font-bold text-slate-900">{estimate ? `${estimate.online_masters} ta` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Yetib kelish</span>
                <span className="font-bold text-slate-900">{estimate?.eta_min ? `~${estimate.eta_min} daqiqa` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2"><MapPin className="w-4 h-4" /> Tuman</span>
                <span className="font-bold text-slate-900">{form.district || '—'}</span>
              </div>
            </div>

            {estimate && estimate.online_masters === 0 && (
              <p className="text-xs p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                Hozir yaqin atrofda liniyadagi usta yo'q. Chaqiruv berishingiz mumkin — usta liniyaga chiqishi bilan taklif yuboriladi.
              </p>
            )}

            <p className="text-[11px] text-slate-500 flex gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Ish narxi usta muammoni ko'rgach kelishiladi. To'lov ish tugagach ustaga to'g'ridan-to'g'ri amalga oshiriladi.
            </p>

            <button
              type="submit"
              disabled={submitting || !specId || !location}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-base shadow-lg shadow-orange-500/25 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Spinner className="w-5 h-5 text-white" /> : <><Zap className="w-5 h-5" /> Usta chaqirish</>}
            </button>
            <Link to="/rules" className="block text-center text-xs font-semibold text-blue-600 hover:text-blue-700">
              Ishlash qoidalari
            </Link>
          </div>
        </aside>
      </form>
    </main>
  );
}
