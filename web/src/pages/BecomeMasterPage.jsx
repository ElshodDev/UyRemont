import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Camera, Lock, Phone, Wrench } from 'lucide-react';
import Spinner, { PageLoader } from '../components/Spinner';
import IdentityForm from '../components/IdentityForm';
import { api } from '../lib/api';
import { downscaleImage } from '../lib/images';
import { useSpecializations } from '../lib/useSpecializations';
import { mainVerticals, districtsList, ALL_DISTRICTS } from '../data/catalog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t, specName } from '../i18n';

// Soha va tuman tanlovi sahifa yangilansa ham saqlanadi
const DRAFT_KEY = 'usta24_become_master';
const MAX_SPECS = 10;

const readDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {};
  } catch {
    return {};
  }
};
const saveDraft = (draft) => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Saqlab bo'lmasa (maxfiy rejim) - tanlov faqat shu sahifada qoladi
  }
};
const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // e'tiborsiz
  }
};

function Stepper({ step }) {
  const steps = [t('Telefon'), t('Shaxsiy ma\'lumot'), t('Ish turi')];
  return (
    <ol className="flex items-center gap-2 text-xs font-bold flex-wrap" aria-label={t('Qadamlar')}>
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < step;
        const current = number === step;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
            <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center ${
              done ? 'bg-emerald-500 text-white' : current ? 'bg-white text-blue-700' : 'bg-white/20 text-white'
            }`}
            >
              {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : number}
            </span>
            <span className={current ? 'text-white' : 'text-white/70'}>{label}</span>
            {number < steps.length && <span className="w-4 h-px bg-white/40" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Usta bo'lish - 3 qadam: 1) telefon raqam (kirish), 2) ism, familiya, pasport seriya-raqami va rasmi,
 * 3) qaysi ish va tuman. So'ng "Ish rejimi" sahifasi: "Ishga chiqish" / "Dam olish".
 */
export default function BecomeMasterPage() {
  const { user, loading, requireAuth, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { specializations } = useSpecializations();

  const draft = useMemo(readDraft, []);
  const [identity, setIdentity] = useState(undefined); // undefined - yuklanmoqda, null - yo'q
  const [editIdentity, setEditIdentity] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [vertical, setVertical] = useState(draft.vertical || 'home');
  const [specs, setSpecs] = useState(() => draft.specs || []);
  const [district, setDistrict] = useState(() => draft.district || '');
  const [step, setStep] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = t('1 daqiqada usta bo\'ling — Usta24');
    return () => {
      document.title = t('Usta24 — Usta topish endi oson!');
    };
  }, []);

  useEffect(() => {
    if (!done) saveDraft({ vertical, specs, district });
  }, [vertical, specs, district, done]);

  // Kirgan foydalanuvchining saqlangan ma'lumotlari: shaxs (pasport) va avvalgi usta tanlovi
  useEffect(() => {
    if (!user) return;
    api('/masters/me/identity').then(({ data }) => setIdentity(data)).catch(() => setIdentity(null));
    if (!draft.specs && user.specialization_ids?.length) setSpecs(user.specialization_ids);
    if (!draft.district && user.district) setDistrict(user.district);
    // faqat foydalanuvchi o'zgarganda
  }, [user?.id]);

  // Tanlangan soha bor bo'limni ochish
  useEffect(() => {
    if (draft.vertical || specs.length === 0 || specializations.length === 0) return;
    const first = specializations.find((s) => specs.includes(s.id));
    if (first) setVertical(first.vertical);
    // faqat katalog yuklanganda
  }, [specializations]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const verticalSpecs = useMemo(
    () => specializations.filter((s) => s.vertical === vertical),
    [specializations, vertical]
  );

  if (loading) return <PageLoader />;
  if (user?.role === 'admin') {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1 text-center text-sm text-slate-500">
        {t('Administrator hisobi usta profiliga ega bo\'la olmaydi.')}
      </main>
    );
  }
  if (user?.role === 'master' && !done) return <Navigate to="/master/work" replace />;

  const currentStep = !user ? 1 : step;

  const pickPhoto = (file) => {
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const toggleSpec = (id) => {
    setSpecs((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      if (list.length >= MAX_SPECS) {
        toast.error(t('Ko\'pi bilan {n} ta soha tanlash mumkin', { n: MAX_SPECS }));
        return list;
      }
      return [...list, id];
    });
  };

  // Oxirgi qadam: usta profili, pasport rasmi va tekshiruvga yuborish - so'ng "Ish rejimi"
  const finish = async () => {
    setSubmitting(true);
    try {
      await api('/masters/quick-start', { method: 'POST', body: { specialization_ids: specs, district } });
      setDone(true);
      clearDraft();
      if (photo) {
        try {
          const form = new FormData();
          form.append('kind', 'passport');
          form.append('image', await downscaleImage(photo), 'passport.jpg');
          await api('/masters/me/documents', { method: 'POST', body: form });
          await api('/masters/me/verification', { method: 'POST' });
        } catch (err) {
          // Profil yaratildi; hujjatni "Profilim" sahifasidan qayta yuklash mumkin
          toast.error(err.message);
        }
      }
      await refresh();
      navigate('/master/work', { replace: true, state: { welcome: true } });
    } catch (err) {
      toast.error(err.message);
      setDone(false);
    } finally {
      setSubmitting(false);
    }
  };

  const photoField = (
    <div>
      <p className="label">{t('Pasport (ID karta) rasmi')}</p>
      <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition ${photo ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'}`}>
        {photoUrl
          ? <img src={photoUrl} alt={t('Pasport rasmi')} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          : <span className="w-16 h-16 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0"><Camera className="w-7 h-7" aria-hidden="true" /></span>}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-800">{photo ? t('Rasm tanlandi — almashtirish') : t('Suratga olish yoki rasm tanlash')}</span>
          <span className="block text-xs text-slate-500">{t('Ism va rasm aniq ko\'rinsin. Administrator 24 soat ichida tekshiradi.')}</span>
        </span>
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
      </label>
    </div>
  );

  return (
    <main className="w-full flex-1">
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white px-4 pt-6 pb-14 sm:pt-10 sm:pb-16">
        <div className="max-w-2xl mx-auto">
          <p className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wide">
            <Wrench className="w-4 h-4" aria-hidden="true" /> {t('Ustalar uchun')}
          </p>
          <h1 className="mt-2 text-[1.75rem] leading-tight sm:text-4xl font-extrabold">{t('Usta bo\'lib ro\'yxatdan o\'tish')}</h1>
          <p className="mt-2 text-white/85 text-sm sm:text-base">{t('3 ta oddiy qadam. Ro\'yxatdan o\'tish bepul.')}</p>
          <div className="mt-5"><Stepper step={currentStep} /></div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-10 space-y-4">
        {currentStep === 1 && (
          <section className="card shadow-lg p-5 sm:p-6 text-center space-y-4" aria-labelledby="step-phone-title">
            <span className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Phone className="w-7 h-7" aria-hidden="true" /></span>
            <h2 id="step-phone-title" className="text-xl font-extrabold text-slate-900">{t('Telefon raqamingiz')}</h2>
            <p className="text-sm text-slate-600">{t('Raqamingizga kod keladi (SMS yoki Telegram). Mijozlar raqamingizni faqat buyurtmani qabul qilganingizda ko\'radi.')}</p>
            <button type="button" onClick={() => requireAuth(() => setStep(2), { askName: false })} className="btn btn-primary btn-lg w-full">
              {t('Telefon raqam bilan kirish')}
            </button>
          </section>
        )}

        {currentStep === 2 && (
          <section className="card shadow-lg p-5 sm:p-6 space-y-4" aria-labelledby="step-identity-title">
            <div>
              <h2 id="step-identity-title" className="text-xl font-extrabold text-slate-900">{t('Shaxsiy ma\'lumotlar')}</h2>
              <p className="text-sm text-slate-600 mt-0.5">{t('Pasportdagidek yozing. Bu mijozlar ishonchi uchun kerak.')}</p>
            </div>
            {identity === undefined && <Spinner className="w-5 h-5" />}
            {identity && !editIdentity && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <Lock className="w-5 h-5 text-emerald-700 flex-shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-bold text-slate-900">{identity.first_name} {identity.last_name}</p>
                    <p className="text-slate-600 tracking-widest">{identity.passport_masked}</p>
                  </div>
                  <button type="button" onClick={() => setEditIdentity(true)} className="text-xs font-bold text-blue-600 hover:underline min-h-9 px-1">
                    {t('O\'zgartirish')}
                  </button>
                </div>
                {photoField}
                <button type="button" onClick={() => setStep(3)} disabled={!photo} className="btn btn-primary btn-lg w-full">
                  {t('Davom etish')}
                </button>
              </div>
            )}
            {(identity === null || editIdentity) && (
              <IdentityForm
                defaultName={identity ? `${identity.first_name} ${identity.last_name}` : user?.name}
                submitLabel={t('Davom etish')}
                canSubmit={Boolean(photo)}
                onSaved={(saved) => {
                  setIdentity(saved);
                  setEditIdentity(false);
                  setStep(3);
                }}
              >
                {photoField}
              </IdentityForm>
            )}
          </section>
        )}

        {currentStep === 3 && (
          <section className="card shadow-lg p-5 sm:p-6 space-y-4" aria-labelledby="step-work-title">
            <div>
              <h2 id="step-work-title" className="text-xl font-extrabold text-slate-900">{t('Qanday ish qilasiz?')}</h2>
              <p className="text-sm text-slate-600 mt-0.5">{t('Shu sohalar bo\'yicha buyurtmalar keladi. Bir nechtasini tanlashingiz mumkin.')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100">
              {mainVerticals.map((v) => {
                const count = specializations.filter((s) => s.vertical === v.id && specs.includes(s.id)).length;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVertical(v.id)}
                    aria-pressed={vertical === v.id}
                    className={`flex items-center gap-2 px-2.5 min-h-11 rounded-lg text-left text-xs sm:text-sm font-bold transition ${
                      vertical === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-lg" aria-hidden="true">{v.icon}</span>
                    <span className="truncate flex-1">{t(v.name)}</span>
                    {count > 0 && <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
              {specializations.length === 0 && <Spinner className="w-5 h-5" />}
              {verticalSpecs.map((s) => {
                const selected = specs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSpec(s.id)}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-center gap-1 px-1.5 pt-3 pb-2 min-h-[88px] rounded-xl border text-center transition ${
                      selected ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center">
                        <Check className="w-3 h-3" aria-hidden="true" />
                      </span>
                    )}
                    <span className="text-2xl leading-none" aria-hidden="true">{s.icon}</span>
                    <span className="text-xs font-semibold leading-tight line-clamp-2">{specName(s)}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="label" htmlFor="master-district">{t('Qaysi tumanda ishlaysiz?')}</label>
              <select id="master-district" className="input text-base" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="">{t('Tumanni tanlang')}</option>
                {districtsList.filter((d) => d !== ALL_DISTRICTS).map((d) => <option key={d} value={d}>{t(d)}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStep(2)} className="btn btn-secondary btn-lg px-4" aria-label={t('Ortga')}>
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={finish} disabled={specs.length === 0 || !district || submitting} className="btn btn-primary btn-lg flex-1">
                {submitting ? <Spinner className="w-5 h-5 text-white" /> : t('Ro\'yxatdan o\'tishni yakunlash')}
              </button>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-slate-500">
          {t('Batafsil:')} <Link to="/ustalar" className="link">{t('ustalar uchun qo\'llanma')}</Link>
        </p>
      </div>
    </main>
  );
}
