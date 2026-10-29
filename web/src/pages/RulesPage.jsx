import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, User, Wrench, Zap, Radar, Car, Home, CheckCircle, Star } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';

const FLOW = [
  { icon: Zap, title: 'Chaqiruv', text: 'Mijoz xizmat turini va manzilni tanlaydi, chiqish narxini oldindan ko\'radi.' },
  { icon: Radar, title: 'Qidiruv', text: 'Tizim eng yaqin liniyadagi ustaga taklif yuboradi. Rad etilsa yoki javob bo\'lmasa — keyingi ustaga.' },
  { icon: Car, title: 'Usta yo\'lda', text: 'Mijoz ustani xaritada jonli kuzatadi va taxminiy yetib kelish vaqtini ko\'radi.' },
  { icon: Home, title: 'Yetib keldi', text: 'Usta muammoni ko\'rib, ish narxini mijoz bilan kelishadi va ishni boshlaydi.' },
  { icon: CheckCircle, title: 'Yakun', text: 'Usta yakuniy summani kiritadi, to\'lov ustaga to\'g\'ridan-to\'g\'ri amalga oshiriladi.' },
  { icon: Star, title: 'Baholash', text: 'Mijoz ustani, usta mijozni baholaydi. Reytinglar keyingi buyurtmalarga ta\'sir qiladi.' }
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
  const clientRules = [
    'Bir vaqtning o\'zida faqat bitta faol tezkor chaqiruv berish mumkin.',
    `Usta qidirilayotgan paytda bekor qilish bepul. Usta qabul qilgandan keyin ${config.free_cancel_min} daqiqa ichida ham bepul bekor qilasiz; undan keyin "kech bekor qilish" qayd etiladi.`,
    'Ish boshlangandan keyin chaqiruvni bekor qilib bo\'lmaydi — usta bilan kelishing.',
    `Usta ${config.search_timeout_min} daqiqa ichida topilmasa, chaqiruv yopiladi va qayta chaqirish taklif qilinadi.`,
    'Chiqish narxi oldindan ko\'rsatiladi; ish narxi usta muammoni ko\'rgach kelishiladi.',
    'Telefon raqamlar faqat usta chaqiruvni qabul qilgandan keyin ko\'rinadi.',
    'Ish tugagach ustani halol baholang — bu boshqa mijozlarga yordam beradi.'
  ];
  const masterRules = [
    `Tezkor chaqiruvlar faqat liniyadagi${config.require_verified ? ', administrator tasdiqlagan' : ''} ustalarga yuboriladi.`,
    `Reyting ${config.min_rating} dan past bo'lsa (kamida ${config.min_reviews_for_rating} ta sharhdan keyin) liniyaga chiqib bo'lmaydi.`,
    `Taklifga javob berish uchun ${config.offer_timeout_sec} soniya beriladi. Ketma-ket ${config.max_missed_offers} ta taklifga javob bermasangiz, liniyadan avtomatik chiqarilasiz.`,
    'Rad etish ham javob hisoblanadi, lekin qabul qilish foizingizga ta\'sir qiladi.',
    'Liniyada bo\'lganingizda joylashuvingiz har 15 soniyada yangilanadi. GPS ishlamasa, xaritada joyingizni belgilang.',
    `Joylashuvi ${config.location_stale_min} daqiqadan ko'p yangilanmagan ustaga takliflar yuborilmaydi.`,
    'Faol ish bor paytda yangi tezkor takliflar kelmaydi.',
    'Qabul qilingan chaqiruvdan voz kechsangiz, sabab ko\'rsatiladi va statistikada qayd etiladi; chaqiruv boshqa ustaga beriladi.',
    'Bosqichlarni o\'z vaqtida belgilang: "Yetib keldim" → "Ishni boshlash" → "Yakunlash" (yakuniy summa bilan).',
    `Platforma komissiyasi — yakuniy summaning ${config.commission_percent}%.`
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600"><BookOpen className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Ishlash qoidalari</h1>
          <p className="text-xs text-slate-500">Tezkor chaqiruv (taksi rejimi) mijozlar va ustalar uchun qanday ishlaydi</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900 mb-4">Qanday ishlaydi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FLOW.map(({ icon: Icon, title, text }, i) => (
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
          Qidiruv radiusi bosqichma-bosqich kengayadi: avval {r1} km, keyin {r2} km va {r3} km. Taklif har doim eng yaqin bo'sh ustaga, teng masofada esa reytingi yuqoriroq ustaga yuboriladi.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><User className="w-5 h-5 text-blue-600" /> Mijozlar uchun</h2>
          <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5">
            {clientRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Wrench className="w-5 h-5 text-emerald-600" /> Ustalar uchun</h2>
          <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5">
            {masterRules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>
      </div>

      <div className="text-center">
        <Link to="/call" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold shadow-lg shadow-orange-500/25">
          <Zap className="w-5 h-5" /> Usta chaqirish
        </Link>
      </div>
    </main>
  );
}
