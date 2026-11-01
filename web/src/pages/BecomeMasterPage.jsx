import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, MapPin, Send, ShieldCheck, Sparkles, Wrench, BookOpen
} from 'lucide-react';
import Spinner, { PageLoader } from '../components/Spinner';
import { api } from '../lib/api';
import { useSpecializations } from '../lib/useSpecializations';
import { mainVerticals, districtsList, ALL_DISTRICTS } from '../data/catalog';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t, specName } from '../i18n';

// Tanlov sahifa yangilansa yoki kirish oynasida vaqt o'tsa ham saqlanib turadi
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
  const steps = [t('Soha'), t('Tuman'), t('Telefon')];
  return (
    <ol className="flex items-center gap-2 text-xs font-bold" aria-label={t('Qadamlar')}>
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

function NextStep({ to, icon: Icon, title, text }) {
  return (
    <Link to={to} className="card p-4 flex items-start gap-3 hover:border-blue-300 hover:shadow-sm transition">
      <span className="p-2 rounded-xl bg-blue-50 text-blue-700 flex-shrink-0"><Icon className="w-5 h-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-slate-900 text-sm">{title}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{text}</span>
      </span>
      <ArrowRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" aria-hidden="true" />
    </Link>
  );
}

/**
 * 1 daqiqada usta bo'lish: soha -> tuman -> telefon (kirish oynasi). Qolgan ma'lumotlar keyin.
 */
export default function BecomeMasterPage() {
  const { user, loading, requireAuth, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { specializations } = useSpecializations();

  const draft = useMemo(readDraft, []);
  const [step, setStep] = useState(draft.step === 2 ? 2 : 1);
  const [vertical, setVertical] = useState(draft.vertical || 'home');
  const [specs, setSpecs] = useState(() => draft.specs || user?.specialization_ids || []);
  const [district, setDistrict] = useState(() => draft.district || user?.district || '');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = t('1 daqiqada usta bo\'ling — Usta24');
    return () => {
      document.title = t('Usta24 — Usta topish endi oson!');
    };
  }, []);

  useEffect(() => {
    if (!done) saveDraft({ step, vertical, specs, district });
  }, [step, vertical, specs, district, done]);

  // Usta profili avval bo'lgan mijoz: eski tanlovi bilan boshlanadi
  useEffect(() => {
    if (!user || draft.specs) return;
    if (user.specialization_ids?.length && specs.length === 0) setSpecs(user.specialization_ids);
    if (user.district && !district) setDistrict(user.district);
    // faqat foydalanuvchi yuklanganda
  }, [user]);

  // Tanlangan soha bor bo'limni ochish (masalan, Avto ustasi qaytib kelganda)
  useEffect(() => {
    if (draft.vertical || specs.length === 0 || specializations.length === 0) return;
    const first = specializations.find((s) => specs.includes(s.id));
    if (first) setVertical(first.vertical);
    // faqat katalog yuklanganda
  }, [specializations]);

  const verticalSpecs = useMemo(
    () => specializations.filter((s) => s.vertical === vertical),
    [specializations, vertical]
  );
  const selectedSpecs = specializations.filter((s) => specs.includes(s.id));
  const needName = Boolean(user && !user.name);

  if (loading) return <PageLoader />;
  if (user?.role === 'admin') {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1 text-center text-sm text-slate-500">
        {t('Administrator hisobi usta profiliga ega bo\'la olmaydi.')}
      </main>
    );
  }
  if (user?.role === 'master' && !done) return <Navigate to="/master/profile" replace />;

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

  const submit = () => requireAuth(async (current) => {
    // Kirish oynasidan keyin ma'lum bo'ldi: bu hisob allaqachon usta
    if (current.role === 'master') {
      clearDraft();
      toast.success(t('Siz allaqachon ustasiz'));
      navigate('/master/profile', { replace: true });
      return;
    }
    if (current.role === 'admin') {
      toast.error(t('Administrator hisobi usta profiliga ega bo\'la olmaydi.'));
      return;
    }
    setSubmitting(true);
    try {
      await api('/masters/quick-start', {
        method: 'POST',
        body: { specialization_ids: specs, district, ...(name.trim() && { name: name.trim() }) }
      });
      clearDraft();
      setDone(true);
      window.scrollTo({ top: 0 });
      await refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  });

  if (done) {
    const linked = Boolean(user?.telegram);
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1 space-y-5">
        <section className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900">
            {user?.name ? t('Tabriklaymiz, {name}!', { name: user.name }) : t('Tabriklaymiz!')}
          </h1>
          <p className="mt-2 text-slate-600">
            {t('Siz endi Usta24 ustasisiz. Profilingiz katalogga qo\'shildi — mijozlar sizga buyurtma bera oladi.')}
          </p>
        </section>

        <section aria-labelledby="next-steps-title" className="space-y-2">
          <h2 id="next-steps-title" className="font-bold text-slate-900">{t('Ko\'proq buyurtma olish uchun')}</h2>
          {!linked && (
            <NextStep
              to="/profile#telegram"
              icon={Send}
              title={t('Telegram\'ni ulang')}
              text={t('Yangi buyurtmalar darhol telefoningizga keladi')}
            />
          )}
          <NextStep
            to="/master/profile#tasdiqlash"
            icon={ShieldCheck}
            title={t('Hujjatlaringizni yuboring')}
            text={t('«Tasdiqlangan» belgisi va tezkor chaqiruvlar shundan keyin ochiladi')}
          />
          <NextStep
            to="/master/profile#profil-forma"
            icon={Sparkles}
            title={t('Narx, tajriba va ish rasmlarini qo\'shing')}
            text={t('To\'liq profilli ustani mijozlar ko\'proq tanlaydi')}
          />
          <NextStep
            to="/ustalar"
            icon={BookOpen}
            title={t('Qanday ishlaydi')}
            text={t('Buyurtma, chaqiruv, komissiya va qoidalar — qisqacha')}
          />
        </section>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link to="/master/profile" className="btn btn-primary btn-lg flex-1">{t('Profilni to\'ldirish')}</Link>
          <Link to="/" className="btn btn-secondary btn-lg">{t('Bosh sahifa')}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full flex-1">
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white px-4 pt-6 pb-14 sm:pt-10 sm:pb-16">
        <div className="max-w-2xl mx-auto">
          <p className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wide">
            <Wrench className="w-4 h-4" aria-hidden="true" /> {t('Ustalar uchun')}
          </p>
          <h1 className="mt-2 text-[1.75rem] leading-tight sm:text-4xl font-extrabold">{t('1 daqiqada usta bo\'ling')}</h1>
          <p className="mt-2 text-white/85 text-sm sm:text-base">
            {t('Ro\'yxatdan o\'tish bepul. Buyurtmalar telefoningizga keladi, komissiya faqat bajarilgan ishdan.')}
          </p>
          <div className="mt-5"><Stepper step={step} /></div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-10 space-y-4">
        {step === 1 && (
          <section className="card shadow-lg p-4 sm:p-6" aria-labelledby="step-specs-title">
            <h2 id="step-specs-title" className="text-lg font-extrabold text-slate-900">{t('Qanday ish qilasiz?')}</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">{t('Bir nechtasini tanlashingiz mumkin')}</p>

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

            <div className="mt-3 grid gap-2 grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
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
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
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

            <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 mt-5 -mx-1 flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur p-1">
              <p className="flex-1 text-xs text-slate-500" aria-live="polite">
                {specs.length > 0 ? t('Tanlandi: {n} ta', { n: specs.length }) : t('Kamida bitta sohani tanlang')}
              </p>
              <button type="button" onClick={() => setStep(2)} disabled={specs.length === 0} className="btn btn-primary btn-lg px-6">
                {t('Davom etish')} <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="card shadow-lg p-4 sm:p-6" aria-labelledby="step-district-title">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedSpecs.map((s) => (
                <span key={s.id} className="text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg px-2 py-1">{s.icon} {specName(s)}</span>
              ))}
              <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-blue-600 hover:underline px-1 min-h-7">
                {t('O\'zgartirish')}
              </button>
            </div>

            <h2 id="step-district-title" className="text-lg font-extrabold text-slate-900">{t('Qayerda ishlaysiz?')}</h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">{t('Asosiy tumaningiz. Mijozlar katalogda tuman bo\'yicha qidiradi.')}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-labelledby="step-district-title">
              {districtsList.filter((d) => d !== ALL_DISTRICTS).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={district === d}
                  onClick={() => setDistrict(d)}
                  className={`flex items-center gap-2 px-3 min-h-12 rounded-xl border text-sm font-semibold text-left transition ${
                    district === d ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className={`w-4 h-4 flex-shrink-0 ${district === d ? 'text-blue-600' : 'text-slate-400'}`} aria-hidden="true" />
                  {t(d)}
                </button>
              ))}
            </div>

            {needName && (
              <div className="mt-4">
                <label className="label" htmlFor="master-name">{t('Ism va familiyangiz')}</label>
                <input
                  id="master-name"
                  className="input"
                  maxLength={100}
                  autoComplete="name"
                  placeholder={t('Masalan: Davronbek Aliyev')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="mt-5 flex items-center gap-2">
              <button type="button" onClick={() => setStep(1)} className="btn btn-secondary btn-lg px-4" aria-label={t('Ortga')}>
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!district || submitting || (needName && name.trim().length < 2)}
                className="btn btn-primary btn-lg flex-1"
              >
                {submitting ? <Spinner className="w-5 h-5 text-white" /> : user ? t('Usta bo\'lish') : t('Telefon raqamni tasdiqlash')}
              </button>
            </div>
            {!user && (
              <p className="hint mt-2 text-center">{t('Kod SMS yoki Telegram orqali keladi. Raqamingiz mijozlarga faqat buyurtma qabul qilganingizda ko\'rinadi.')}</p>
            )}
          </section>
        )}

        <p className="text-center text-xs text-slate-500">
          {t('Batafsil:')} <Link to="/ustalar" className="link">{t('ustalar uchun qo\'llanma')}</Link>
        </p>
      </div>
    </main>
  );
}
