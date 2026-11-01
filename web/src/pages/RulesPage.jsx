import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, User, Wrench, Zap, Radar, Car, Home, CheckCircle, Star, PlayCircle } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { openOnboarding } from '../components/Onboarding';
import { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';
import { buildClientRules, buildMasterRules } from '../lib/rules';
import { t } from '../i18n';

// Matnlar chaqirilgan paytda joriy tilda olinadi
const FLOW = () => [
  { icon: Zap, title: t('Chaqiruv'), text: t('Mijoz xizmat turini va manzilni tanlaydi, chiqish narxini oldindan ko\'radi.') },
  { icon: Radar, title: t('Qidiruv'), text: t('Tizim eng yaqin bo\'sh (ish rejimidagi) ustaga taklif yuboradi. Rad etilsa yoki javob bo\'lmasa — keyingi ustaga.') },
  { icon: Car, title: t('Usta yo\'lda'), text: t('Mijoz ustani xaritada jonli kuzatadi va taxminiy yetib kelish vaqtini ko\'radi.') },
  { icon: Home, title: t('Yetib keldi'), text: t('Usta muammoni ko\'rib, ish narxini mijoz bilan kelishadi va ishni boshlaydi.') },
  { icon: CheckCircle, title: t('Ish yakuni'), text: t('Usta ish haqi va material summasini alohida kiritadi, to\'lov ustaga to\'g\'ridan-to\'g\'ri amalga oshiriladi.') },
  { icon: Star, title: t('O\'zaro baholash'), text: t('Mijoz ustani, usta mijozni baholaydi. Reytinglar keyingi buyurtmalarga ta\'sir qiladi.') }
];

export default function RulesPage() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api('/dispatch/config').then(({ data }) => setConfig(data)).catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error) return <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1"><ErrorState message={error} onRetry={load} /></main>;
  if (!config) return <PageLoader />;

  const [r1, r2, r3] = config.search_radii_km;
  const clientRules = buildClientRules(config);
  const masterRules = buildMasterRules(config);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><BookOpen className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Ishlash qoidalari')}</h1>
          <p className="text-xs text-slate-500">{t('Tezkor chaqiruv (taksi rejimi) mijozlar va ustalar uchun qanday ishlaydi')}</p>
        </div>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-slate-900">{t('Qanday ishlaydi')}</h2>
          <button type="button" onClick={openOnboarding} className="btn btn-sm btn-soft">
            <PlayCircle className="w-4 h-4" /> {t('Qisqa tanishtiruv')}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FLOW().map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="flex gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
              <div>
                <p className="text-sm font-bold text-slate-900">{i + 1}. {title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-5 p-3 rounded-xl bg-slate-50">
          {t('Qidiruv radiusi bosqichma-bosqich kengayadi: avval {r1} km, keyin {r2} km va {r3} km. Taklif har doim eng yaqin bo\'sh ustaga, teng masofada esa reytingi yuqoriroq ustaga yuboriladi.', { r1, r2, r3 })}
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> {t('Mijozlar uchun')}</h2>
          <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5">
            {clientRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Wrench className="w-5 h-5 text-emerald-600" /> {t('Ustalar uchun')}</h2>
          <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5">
            {masterRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
      </div>

      <p className="text-center text-xs text-slate-400">
        {t('Batafsil:')} <Link to="/terms" className="text-blue-600 hover:underline">{t('Foydalanish shartlari')}</Link> {t('va')}{' '}
        <Link to="/privacy" className="text-blue-600 hover:underline">{t('Maxfiylik siyosati')}</Link>
      </p>

      <div className="text-center">
        <Link to="/call" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold shadow-lg shadow-orange-500/25">
          <Zap className="w-5 h-5" /> {t('Usta chaqirish')}
        </Link>
      </div>
    </main>
  );
}
