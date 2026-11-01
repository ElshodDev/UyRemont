import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Gift, Wrench, Zap, ArrowRight } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { api } from '../lib/api';
import { formatSum } from '../lib/commission';
import { rememberRef, forgetRef } from '../lib/referral';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

/**
 * Taklif havolasi (/r/KOD): kod eslab qolinadi va ro'yxatdan o'tishda yuboriladi.
 * Mehmon tanlaydi: usta topish yoki usta bo'lish
 */
export default function ReferralLandingPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const [info, setInfo] = useState(undefined);

  useEffect(() => {
    rememberRef(code);
    api(`/referrals/${encodeURIComponent(code)}`)
      .then(({ data }) => setInfo(data))
      .catch(() => {
        forgetRef();
        setInfo(null);
      });
  }, [code]);

  if (info === undefined) return <PageLoader />;

  return (
    <main className="w-full flex-1">
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white px-4 pt-10 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/15 flex items-center justify-center"><Gift className="w-7 h-7" aria-hidden="true" /></div>
          <h1 className="mt-4 text-[1.75rem] leading-tight sm:text-4xl font-extrabold">
            {info?.name ? t('{name} sizni Usta24 ga taklif qildi', { name: info.name }) : t('Sizni Usta24 ga taklif qilishdi')}
          </h1>
          <p className="mt-3 text-white/85">{t('Uy, avto va texnika ustalari — tasdiqlangan, narxi va sharhlari bilan.')}</p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-10 space-y-3">
        {user && (
          <p className="card p-4 text-sm text-slate-600">{t('Siz allaqachon ro\'yxatdan o\'tgansiz: taklif faqat yangi hisoblar uchun.')}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/" className="card shadow-lg p-5 hover:border-blue-300 transition flex flex-col gap-2">
            <span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><Zap className="w-6 h-6" aria-hidden="true" /></span>
            <span className="font-extrabold text-slate-900 text-lg">{t('Usta kerakmi?')}</span>
            <span className="text-sm text-slate-600">{t('Eng yaqin ustani bir tugma bilan chaqiring yoki katalogdan tanlang.')}</span>
            <span className="mt-auto pt-2 text-sm font-bold text-blue-600 inline-flex items-center gap-1">{t('Usta topish')} <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
          </Link>
          <Link to="/usta-bolish" className="card shadow-lg p-5 hover:border-blue-300 transition flex flex-col gap-2">
            <span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Wrench className="w-6 h-6" aria-hidden="true" /></span>
            <span className="font-extrabold text-slate-900 text-lg">{t('Ustamisiz?')}</span>
            <span className="text-sm text-slate-600">
              {info?.welcome_bonus > 0
                ? t('1 daqiqada ro\'yxatdan o\'ting va buyurtmalar oling. Birinchi ishingizda {bonus} bonus.', { bonus: formatSum(info.welcome_bonus) })
                : t('1 daqiqada ro\'yxatdan o\'ting va buyurtmalar oling.')}
            </span>
            <span className="mt-auto pt-2 text-sm font-bold text-blue-600 inline-flex items-center gap-1">{t('Usta bo\'lish')} <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
          </Link>
        </div>
      </div>
    </main>
  );
}
