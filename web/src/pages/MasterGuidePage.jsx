import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Wrench, Zap, Clock, Percent, QrCode, UserPlus, ClipboardList, ShieldCheck, Power, CheckCircle,
  Lightbulb, HelpCircle, ChevronDown, Printer, BookOpen, LifeBuoy
} from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api } from '../lib/api';
import { buildMasterRules } from '../lib/rules';
import { useAuth } from '../context/AuthContext';

const BENEFITS = (config) => [
  { icon: Zap, title: 'Buyurtmalar o\'zi keladi', text: 'Ish rejimini yoqasiz — eng yaqin mijozlarning chaqiruvlari telefoningizga keladi. Mijoz qidirib yurish shart emas.' },
  { icon: Clock, title: 'Vaqtingiz o\'z qo\'lingizda', text: 'Xohlagan paytda ishga chiqasiz, band bo\'lsangiz ish rejimini o\'chirasiz.' },
  { icon: Percent, title: `Faqat bajarilgan ishdan ${config.commission_percent}%`, text: 'Ro\'yxatdan o\'tish, profil va shaxsiy sahifa bepul. Komissiya faqat tezkor chaqiruv orqali yakunlangan ishning ish haqidan olinadi, materiallardan emas.' },
  { icon: QrCode, title: 'Shaxsiy sahifa va QR kod', text: 'Sharhlaringiz, ishlaringiz rasmlari va o\'z havolangiz. Uni Telegram\'da, vizitkada va mashinangizda ulashasiz.' }
];

const STEPS = (config) => [
  {
    icon: UserPlus,
    title: 'Ro\'yxatdan o\'ting',
    text: 'Telefon raqamingiz bilan kiring (kod SMS yoki Telegram orqali keladi) va «Usta bo\'lib qo\'shilish» ni tanlang.'
  },
  {
    icon: ClipboardList,
    title: 'Profilni to\'ldiring',
    text: 'Ism, mutaxassisliklar (bir nechtasini tanlash mumkin), tuman, tajriba, narx va o\'zingiz haqingizda 2–3 gap. Ishlaringizdan 3–6 ta rasm qo\'shing.'
  },
  {
    icon: ShieldCheck,
    title: 'Hujjat yuklang',
    text: 'Profil sahifasidagi tasdiqlash bo\'limiga pasport yoki ID karta rasmini (majburiy) va hujjat bilan selfi yuklab, tekshiruvga yuboring. Odatda 24 soat ichida ko\'rib chiqiladi, natija saytda keladi.'
  },
  {
    icon: Power,
    title: 'Ishga chiqing',
    text: '«Ish rejimi» sahifasida «Ishga chiqish» tugmasini bosing va joylashuvga ruxsat bering. Shundan keyin takliflar kela boshlaydi.'
  },
  {
    icon: CheckCircle,
    title: 'Buyurtmani bajaring',
    text: `Taklif kelganda ${config.offer_timeout_sec} soniya ichida qabul qiling → Navigator bilan boring → «Yetib keldim» → narxni mijoz bilan kelishib «Ishni boshlash» → «Yakunlash» (ish haqi va material alohida) → mijozni baholang.`
  }
];

const TIPS = [
  'Portfolio\'ga ishlaringizning aniq, yorug\' rasmlarini qo\'shing: mijozlar ustani ko\'pincha rasmga qarab tanlaydi.',
  'Ishlay olmaydigan paytingizda ish rejimini o\'chiring: javobsiz qolgan takliflar ish rejimini avtomatik o\'chiradi.',
  'Ish tugagach, mijozdan sharh qoldirishni so\'rang. Masofa teng bo\'lsa, taklif reytingi yuqori ustaga birinchi boriladi.',
  'Ish narxini boshlashdan oldin aniq kelishing: nizolarning ko\'pi shu yerdan boshlanadi.',
  'O\'z havolangiz va QR kodingizni ulashing: mijoz to\'g\'ridan-to\'g\'ri sizning profilingizni ochib buyurtma beradi.'
];

const FAQ = (config) => [
  ['Ro\'yxatdan o\'tish pullikmi?', 'Yo\'q. Ro\'yxatdan o\'tish, profil, portfolio va shaxsiy havola bepul.'],
  ['Komissiya qancha?', `Tezkor chaqiruvlar bo'yicha ish haqining ${config.commission_percent}%. Siz sotib olgan materiallar alohida yoziladi va ulardan komissiya olinmaydi. Ish uchun to'lovni mijoz sizga to'g'ridan-to'g'ri qiladi.`],
  ['Komissiyani qanday to\'layman?', `Har bir yakunlangan tezkor ishdan keyin komissiya «Komissiya hisobi» sahifasiga yoziladi. U yerdagi rekvizitlarga o'tkazasiz, administrator qabul qilgach qarz kamayadi.${config.commission_debt_limit > 0 ? ` Qarz ${Number(config.commission_debt_limit).toLocaleString('ru-RU')} so'mdan oshsa, to'lamaguningizcha yangi takliflar kelmaydi.` : ''}`],
  ['Ish narxini kim belgilaydi?', 'Mijoz chiqish narxini oldindan ko\'radi. Ish narxini esa muammoni ko\'rgach, mijoz bilan joyida kelishasiz.'],
  ['Mijozning telefon raqamini qachon ko\'raman?', 'Chaqiruvni qabul qilganingizdan keyin. Ungacha raqamlar ikki tomonga ham ko\'rinmaydi.'],
  ['Bir nechta sohada ishlasam bo\'ladimi?', 'Ha. Profilda bir nechta mutaxassislikni tanlang: takliflar hammasi bo\'yicha keladi.'],
  ['Profilim tasdiqlanmasa nima qilaman?', 'Administrator sababini yozadi. Kamchilikni tuzatib (masalan, aniqroq rasm yuklab), qayta tekshiruvga yuboring.'],
  ['Hujjatlarimni kim ko\'radi?', 'Faqat administrator. Ular ochiq havola orqali berilmaydi, mijozlarga ko\'rsatilmaydi va hisob o\'chirilganda o\'chiriladi.']
];

/**
 * Ustalar uchun qo'llanma: nega Usta24, qanday boshlash, qoidalar, maslahatlar, savollar.
 * Usta jalb qilish uchun Telegram guruhlarda ulashiladi (havola ko'rinishi backendda: GET /ustalar)
 */
export default function MasterGuidePage() {
  const navigate = useNavigate();
  const { user, requireAuth } = useAuth();
  const [config, setConfig] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api('/dispatch/config').then(({ data }) => setConfig(data)).catch((err) => setError(err.message));
  };
  useEffect(load, []);
  useEffect(() => {
    api('/support/contacts').then(({ data }) => setContacts(data)).catch(() => setContacts(null));
  }, []);

  useEffect(() => {
    document.title = 'Ustalar uchun — Usta24';
    return () => {
      document.title = 'Usta24 — Usta topish endi oson!';
    };
  }, []);

  if (error) return <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1"><ErrorState message={error} onRetry={load} /></main>;
  if (!config) return <PageLoader />;

  const isMaster = user?.role === 'master';
  const start = () => requireAuth((current) => navigate(current.role === 'master' ? '/master/work' : '/master/setup'));

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full flex-1 space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 dark:ring-1 dark:ring-white/10 text-white p-6 sm:p-10">
        <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wide">
          <Wrench className="w-4 h-4" aria-hidden="true" /> Ustalar uchun
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-black leading-tight max-w-2xl">Usta24 da ishlang — mijozlar sizni o'zi topadi</h1>
        <p className="mt-3 text-white/85 max-w-xl">
          Yaqin atrofingizdagi buyurtmalar telefoningizga keladi. Ro'yxatdan o'tish bepul, komissiya faqat bajarilgan ishdan.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={start} className="btn btn-lg bg-snow text-ink font-extrabold hover:bg-primary-50">
            {isMaster ? 'Ish rejimiga o\'tish' : 'Usta bo\'lib ro\'yxatdan o\'tish'}
          </button>
          <a href="#qanday-boshlash" className="btn btn-lg bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/25">
            Qanday boshlash
          </a>
        </div>
      </section>

      <section aria-labelledby="benefits-title">
        <h2 id="benefits-title" className="sr-only">Nega Usta24</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BENEFITS(config).map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5 flex gap-4">
              <span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0" aria-hidden="true"><Icon className="w-5 h-5" /></span>
              <div>
                <h3 className="font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600 mt-1">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="qanday-boshlash" className="card p-5 sm:p-7 scroll-mt-24" aria-labelledby="steps-title">
        <h2 id="steps-title" className="text-xl font-extrabold text-slate-900">Qanday boshlash — 5 qadam</h2>
        <ol className="mt-5 space-y-5">
          {STEPS(config).map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-4">
              <span className="relative w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Icon className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-ink text-[11px] font-black flex items-center justify-center">{i + 1}</span>
              </span>
              <div className="pt-0.5">
                <h3 className="font-bold text-slate-900">{i + 1}. {title}</h3>
                <p className="text-sm text-slate-600 mt-1">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <button type="button" onClick={start} className="btn btn-primary">
            {isMaster ? 'Ish rejimiga o\'tish' : 'Hozir boshlash'}
          </button>
          {isMaster && <Link to="/master/profile" className="btn btn-secondary">Profilim</Link>}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section id="qoidalar" className="card p-5 sm:p-6 scroll-mt-24" aria-labelledby="rules-title">
          <h2 id="rules-title" className="font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" aria-hidden="true" /> Tezkor chaqiruv qoidalari
          </h2>
          <ol className="mt-3 space-y-2.5 text-sm text-slate-700 list-decimal pl-5">
            {buildMasterRules(config).map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
          <Link to="/rules" className="link text-sm mt-3 inline-block">Mijozlar uchun qoidalar ham →</Link>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="tips-title">
          <h2 id="tips-title" className="font-bold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" aria-hidden="true" /> Ko'proq buyurtma olish uchun
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
          {isMaster && (
            <Link to="/master/varaqa" className="btn btn-soft mt-4 w-full sm:w-auto">
              <Printer className="w-4 h-4" /> Varaqa va vizitkangizni chop eting
            </Link>
          )}
        </section>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="faq-title">
        <h2 id="faq-title" className="font-bold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" aria-hidden="true" /> Ko'p beriladigan savollar
        </h2>
        <div className="mt-3 divide-y divide-slate-100">
          {FAQ(config).map(([question, answer]) => (
            <details key={question} className="group py-3">
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-semibold text-slate-800 min-h-9">
                {question}
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="text-sm text-slate-600 mt-2">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-3">
          <LifeBuoy className="w-6 h-6 text-blue-600 flex-shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-bold text-slate-900">Savolingiz bormi?</h2>
            <p className="text-sm text-slate-600">
              {contacts?.phone || contacts?.telegram ? 'Qo\'ng\'iroq qiling yoki Telegram\'da yozing.' : 'Yordam sahifasida bizga yozing.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {contacts?.phone && <a href={`tel:${contacts.phone.replace(/[^+\d]/g, '')}`} className="btn btn-secondary">{contacts.phone}</a>}
          {contacts?.telegram && <a href={`https://t.me/${contacts.telegram}`} target="_blank" rel="noreferrer" className="btn btn-secondary">@{contacts.telegram}</a>}
          {user && !contacts?.phone && !contacts?.telegram && <Link to="/support" className="btn btn-secondary">Yordam</Link>}
          <Link to="/ustalar/varaqa" className="btn btn-ghost">
            <Printer className="w-4 h-4" /> Do'stlaringiz uchun varaqa
          </Link>
        </div>
      </section>
    </main>
  );
}
