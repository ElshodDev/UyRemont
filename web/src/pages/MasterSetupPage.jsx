import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Wrench, ImagePlus, Trash2, ShieldCheck, Star, Check, Circle } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import PublicLinkCard from '../components/PublicLinkCard';
import VerificationCard from '../components/VerificationCard';
import Spinner from '../components/Spinner';
import { api, assetUrl } from '../lib/api';
import { useSpecializations } from '../lib/useSpecializations';
import { formatRating } from '../lib/format';
import { mainVerticals, districtsList } from '../data/catalog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t, specName } from '../i18n';

const inputClass = 'input';

function PortfolioManager({ onCount }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [items, setItems] = useState(null);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);

  useEffect(() => {
    if (items) onCount?.(items.length);
  }, [items, onCount]);

  useEffect(() => {
    api('/masters/portfolio/my')
      .then(({ data }) => setItems(data))
      .catch((err) => {
        setItems([]);
        toast.error(err.message);
      });
  }, [toast]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t('Rasm hajmi 8 MB dan oshmasligi kerak'));
      return;
    }
    const body = new FormData();
    body.append('image', file);
    body.append('description', description);
    setUploading(true);
    try {
      const { data } = await api('/masters/portfolio', { method: 'POST', body });
      setItems((list) => [data, ...list]);
      setFile(null);
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      toast.success(t('Rasm qo\'shildi'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    const item = confirmItem;
    setDeleting(item.id);
    try {
      await api(`/masters/portfolio/${item.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((i) => i.id !== item.id));
      toast.success(t('Rasm o\'chirildi'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
      setConfirmItem(null);
    }
  };

  return (
    <section id="portfolio" className="card p-5 sm:p-6 scroll-mt-24">
      <h2 className="font-bold text-slate-900 mb-1">{t('Portfolio')}</h2>
      <p className="text-xs text-slate-500 mb-4">{t('Bajargan ishlaringiz rasmlari mijozlar ishonchini oshiradi (JPG, PNG, WEBP, 8 MB gacha). Rasmdagi joylashuv (GPS) ma\'lumotlari avtomatik o\'chiriladi.')}</p>

      <form onSubmit={upload} className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold"
        />
        <input
          className={`${inputClass} flex-1`}
          placeholder={t('Qisqa tavsif (ixtiyoriy)')}
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="btn btn-primary px-4 font-bold"
        >
          {uploading ? <Spinner className="w-4 h-4 text-white" /> : <><ImagePlus className="w-4 h-4" /> {t('Yuklash')}</>}
        </button>
      </form>

      {items === null ? (
        <Spinner label={t('Yuklanmoqda...')} />
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">{t('Hali rasmlar qo\'shilmagan.')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className="relative group">
              <img src={assetUrl(item.image_url)} alt={item.description || t('Portfolio')} className="h-32 w-full object-cover rounded-xl border border-slate-200" />
              {item.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{item.description}</p>}
              <button
                onClick={() => setConfirmItem(item)}
                disabled={deleting === item.id}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white shadow-sm"
                aria-label={t('O\'chirish')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmItem && (
        <ConfirmDialog
          title={t('Rasmni o\'chirasizmi?')}
          confirmLabel={t('O\'chirish')}
          loading={Boolean(deleting)}
          onConfirm={remove}
          onClose={() => setConfirmItem(null)}
        />
      )}
    </section>
  );
}

/**
 * "Profilni to'ldiring": 1 daqiqada ro'yxatdan o'tgan usta keyin to'ldiradigan narsalar.
 * Hammasi bajarilsa ko'rinmaydi
 */
function ProfileChecklist({ user, portfolioCount }) {
  const items = [
    { id: 'price', done: Number(user.hourly_rate) > 0, label: t('Boshlang\'ich narx'), href: '#profil-forma' },
    { id: 'experience', done: Number(user.experience_years) > 0, label: t('Tajriba'), href: '#profil-forma' },
    { id: 'bio', done: (user.bio || '').trim().length >= 30, label: t('O\'zingiz haqingizda (kamida 30 belgi)'), href: '#profil-forma' },
    { id: 'portfolio', done: portfolioCount !== null && portfolioCount >= 3, label: t('Kamida 3 ta ish rasmi'), href: '#portfolio' },
    { id: 'verified', done: Boolean(user.is_verified), label: t('Hujjatlar (tasdiqlangan belgisi)'), href: '#tasdiqlash' },
    { id: 'telegram', done: Boolean(user.telegram), label: t('Telegram (buyurtma xabarlari)'), to: '/profile#telegram' }
  ];
  if (portfolioCount === null) return null;
  const doneCount = items.filter((item) => item.done).length;
  if (doneCount === items.length) return null;
  const percent = Math.round(((doneCount + 2) / (items.length + 2)) * 100); // soha va tuman - bor

  return (
    <section className="card p-5 sm:p-6 border-blue-200" aria-labelledby="checklist-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="checklist-title" className="font-bold text-slate-900">{t('Profilni to\'ldiring')}</h2>
        <span className="text-sm font-black text-blue-700 tabular-nums">{percent}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('Profil to\'liqligi')}>
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-2">{t('To\'liq profilli ustani mijozlar ko\'proq tanlaydi.')}</p>
      <ul className="mt-3 grid sm:grid-cols-2 gap-1.5">
        {items.map((item) => {
          const content = (
            <>
              {item.done
                ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />
                : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" aria-hidden="true" />}
              <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-800 font-semibold'}>{item.label}</span>
              <span className="sr-only">{item.done ? t('bajarilgan') : t('bajarilmagan')}</span>
            </>
          );
          const className = 'flex items-center gap-2 min-h-10 px-2 rounded-lg text-sm';
          if (item.done) return <li key={item.id} className={className}>{content}</li>;
          return (
            <li key={item.id}>
              {item.to
                ? <Link to={item.to} className={`${className} hover:bg-slate-50`}>{content}</Link>
                : <a href={item.href} className={`${className} hover:bg-slate-50`}>{content}</a>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function MasterSetupPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { specializations } = useSpecializations();
  const isMaster = user.role === 'master';
  const [portfolioCount, setPortfolioCount] = useState(null);

  // Narx va tajriba ixtiyoriy: bo'sh qolsa katalogda "Narx kelishiladi" / "Yangi usta"
  const [form, setForm] = useState({
    name: user.name || '',
    bio: user.bio || '',
    experience_years: Number(user.experience_years) > 0 ? user.experience_years : '',
    hourly_rate: Number(user.hourly_rate) > 0 ? Math.round(Number(user.hourly_rate)) : '',
    district: user.district || 'Chilonzor',
    is_available: user.is_available ?? true,
    specialization_ids: user.specialization_ids || []
  });
  const [vertical, setVertical] = useState('home');
  const [saving, setSaving] = useState(false);

  // Tanlangan mutaxassislik bo'lgan bo'limni birinchi ochish
  useEffect(() => {
    const first = specializations.find((s) => form.specialization_ids.includes(s.id));
    if (first) setVertical(first.vertical);
    // faqat katalog yuklanganda
  }, [specializations]);

  // "Profilni to'ldiring" dan: forma maydonlariga o'tish
  useEffect(() => {
    if (location.hash === '#profil-forma') {
      document.getElementById('profil-forma')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const verticalSpecs = useMemo(
    () => specializations.filter((s) => s.vertical === vertical),
    [specializations, vertical]
  );

  const toggleSpec = (id) => {
    setForm((f) => ({
      ...f,
      specialization_ids: f.specialization_ids.includes(id)
        ? f.specialization_ids.filter((x) => x !== id)
        : [...f.specialization_ids, id].slice(0, 10)
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.specialization_ids.length === 0) {
      toast.error(t('Kamida bitta mutaxassislikni tanlang'));
      return;
    }
    setSaving(true);
    try {
      const { experience_years: experience, hourly_rate: rate, ...rest } = form;
      await api('/masters/profile', {
        method: 'PUT',
        body: {
          ...rest,
          ...(experience !== '' && { experience_years: Number(experience) }),
          ...(rate !== '' && { hourly_rate: Number(rate) })
        }
      });
      await refresh();
      toast.success(t('Profil yangilandi'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Yangi usta (yoki usta rejimiga qaytayotgan mijoz) - 1 daqiqalik ro'yxatdan o'tish sahifasiga
  if (!isMaster) return <Navigate to="/usta-bolish" replace />;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><Wrench className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{t('Usta profilim')}</h1>
            <p className="text-xs text-slate-500">{t('Ma\'lumotlaringiz katalogda shunday ko\'rinadi')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold">
            <Star className="w-3.5 h-3.5 fill-current" /> {formatRating(user.rating)} ({user.reviews_count || 0})
          </span>
          {user.is_verified ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> {t('Tasdiqlangan')}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-semibold">{t('Tasdiqlanmagan')}</span>
          )}
        </div>
      </div>

      <ProfileChecklist user={user} portfolioCount={portfolioCount} />
      <VerificationCard />
      <PublicLinkCard />

      <form id="profil-forma" onSubmit={submit} className="card p-5 sm:p-6 space-y-4 text-xs scroll-mt-24">
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">{t('Xizmat sohasi va mutaxassislik *')}</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {mainVerticals.map((v) => {
              const selectedInVertical = specializations.filter((s) => s.vertical === v.id && form.specialization_ids.includes(s.id)).length;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVertical(v.id)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                    vertical === v.id ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-base">{v.icon}</span>
                  <span className="text-xs truncate flex-1">{t(v.name)}</span>
                  {selectedInVertical > 0 && (
                    <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5">{selectedInVertical}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {verticalSpecs.map((s) => {
              const selected = form.specialization_ids.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSpec(s.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {s.icon} {specName(s)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">{t('Ism va familiyangiz *')}</label>
            <input
              required
              minLength={2}
              maxLength={100}
              className={inputClass}
              placeholder={t('Masalan: Davronbek Aliyev')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">{t('Tuman *')}</label>
            <select className={inputClass} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
              {districtsList.slice(1).map((d) => <option key={d} value={d}>{t(d)}</option>)}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1" htmlFor="experience-years">{t('Tajriba (yil)')}</label>
            <input
              id="experience-years"
              type="number"
              min="0"
              max="60"
              className={inputClass}
              placeholder={t('Masalan: 5')}
              value={form.experience_years}
              onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1" htmlFor="hourly-rate">{t('Boshlang\'ich narx (so\'m)')}</label>
            <input
              id="hourly-rate"
              type="number"
              min="0"
              step="5000"
              className={inputClass}
              placeholder={t('Bo\'sh qolsa: «Narx kelishiladi»')}
              value={form.hourly_rate}
              onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="font-semibold text-slate-700 block mb-1">{t('Qisqacha ma\'lumot')}</label>
          <textarea
            rows="3"
            maxLength={1000}
            className={inputClass}
            placeholder={t('Ish tajribangiz, kafolatlaringiz haqida...')}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            aria-describedby="bio-hint"
          />
          <p id="bio-hint" className="hint mt-1">
            {t('Telefon raqam yoki Telegram yozmang: mijoz raqamingizni buyurtmani qabul qilganingizdan keyin ko\'radi.')}
          </p>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-blue-600"
            checked={form.is_available}
            onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
          />
          <span>
            <span className="font-bold text-slate-800 block">{t('Hozir buyurtma qabul qilaman')}</span>
            <span className="text-slate-500">{t('O\'chirsangiz, katalogda "Band" deb ko\'rinasiz.')}</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary w-full font-bold shadow-md shadow-blue-500/20 min-h-12"
        >
          {saving ? <Spinner className="w-4 h-4 text-white" /> : t('O\'zgarishlarni saqlash')}
        </button>
      </form>

      <PortfolioManager onCount={setPortfolioCount} />
    </main>
  );
}
