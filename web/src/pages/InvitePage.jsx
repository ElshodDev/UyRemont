import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Copy, Share2, Send, QrCode, Wrench, User, UserPlus, Check } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api, BACKEND_URL } from '../lib/api';
import { formatSum } from '../lib/commission';
import { formatDate } from '../lib/format';
import { copyText, shareLink, telegramShareUrl } from '../lib/share';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

function Stat({ label, value }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xl font-black text-slate-900 tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

/**
 * Do'stlarni taklif qilish: shaxsiy havola, bonus shartlari, statistika va taklif qilinganlar
 */
export default function InvitePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);

  const load = () => {
    setError('');
    api('/referrals/me').then(({ data: result }) => setData(result)).catch((err) => setError(err.message));
  };
  useEffect(load, []);

  if (error && !data) return <main className="max-w-2xl mx-auto px-4 py-10 w-full flex-1"><ErrorState message={error} onRetry={load} /></main>;
  if (!data) return <PageLoader />;

  const isMaster = user.role === 'master';
  const shareText = isMaster
    ? t('Usta24 da ishlang: buyurtmalar telefoningizga keladi, ro\'yxatdan o\'tish bepul. Mening havolam orqali qo\'shiling:')
    : t('Usta24 — uy, avto va texnika ustalari: narxi, reytingi va sharhlari bilan. Mening havolam:');

  const copy = async () => {
    if (await copyText(data.link)) toast.success(t('Havola nusxalandi'));
    else toast.error(t('Havolani nusxalab bo\'lmadi'));
  };
  const share = async () => {
    const result = await shareLink({ url: data.link, title: 'Usta24', text: shareText });
    if (result === 'copied') toast.success(t('Havola nusxalandi'));
    if (result === 'failed') toast.error(t('Havolani nusxalab bo\'lmadi'));
  };

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600"><Gift className="w-6 h-6" aria-hidden="true" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Do\'stlarni taklif qilish')}</h1>
          <p className="text-xs text-slate-500">{t('Havolangizni ulashing: do\'stlaringiz ishonchli usta topadi yoki usta bo\'lib ishlaydi.')}</p>
        </div>
      </div>

      <section className="card p-5 space-y-3" aria-labelledby="link-title">
        <h2 id="link-title" className="font-bold text-slate-900">{t('Sizning havolangiz')}</h2>
        <div className="flex items-center gap-2">
          <input
            readOnly
            className="input font-mono text-sm"
            value={data.link}
            aria-label={t('Taklif havolasi')}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" onClick={copy} className="icon-btn border border-slate-200 flex-shrink-0" aria-label={t('Nusxalash')} title={t('Nusxalash')}>
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{t('Kod: {code} — do\'stingiz havolani ochib, ro\'yxatdan o\'tishi kerak.', { code: data.code })}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" onClick={share} className="btn btn-primary font-bold">
            <Share2 className="w-4 h-4" aria-hidden="true" /> {t('Ulashish')}
          </button>
          <a href={telegramShareUrl(data.link, shareText)} target="_blank" rel="noreferrer" className="btn text-white bg-[#229ED9] hover:bg-[#1c8cc2]">
            <Send className="w-4 h-4" aria-hidden="true" /> Telegram
          </a>
          <button type="button" onClick={() => setShowQr((v) => !v)} className="btn btn-secondary" aria-expanded={showQr}>
            <QrCode className="w-4 h-4" aria-hidden="true" /> {t('QR kod')}
          </button>
        </div>
        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <img
              src={`${BACKEND_URL}/api/referrals/${data.code}/qr?format=svg`}
              alt={t('QR kod: {link}', { link: data.link })}
              className="w-48 h-48 bg-white p-2 rounded-xl border border-slate-200"
            />
            <p className="text-xs text-slate-500 text-center">{t('Do\'stingiz telefon kamerasini QR kodga qaratsin.')}</p>
          </div>
        )}
      </section>

      <section className="card p-5 space-y-3" aria-labelledby="bonus-title">
        <h2 id="bonus-title" className="font-bold text-slate-900">{t('Bonuslar')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-sm font-bold text-blue-900 flex items-center gap-1.5"><Wrench className="w-4 h-4" aria-hidden="true" /> {t('Usta taklif qiling')}</p>
            <p className="text-xs text-slate-700 mt-1">
              {t('U birinchi ishini bajarganda sizga {bonus}, unga {welcome} bonus.', { bonus: formatSum(data.bonuses.master), welcome: formatSum(data.bonuses.welcome) })}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-sm font-bold text-emerald-900 flex items-center gap-1.5"><User className="w-4 h-4" aria-hidden="true" /> {t('Mijoz taklif qiling')}</p>
            <p className="text-xs text-slate-700 mt-1">
              {t('Uning birinchi buyurtmasini boshqa usta bajarganda sizga {bonus}.', { bonus: formatSum(data.bonuses.client) })}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {t('Bonus komissiya hisobingizga yoziladi va komissiyadan chegiriladi. Ish haqi kamida {min} bo\'lgan ishlar hisobga olinadi.', { min: formatSum(data.bonuses.min_labor) })}
        </p>
        {!isMaster && (
          <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
            {t('Bonuslar ustalar uchun (komissiya hisobiga). Siz usta bo\'lsangiz, taklif qilgan do\'stlaringiz uchun bonus olasiz.')}{' '}
            <Link to="/usta-bolish" className="link">{t('Usta bo\'lish')}</Link>
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={t('Taklif qilinganlar')} value={data.stats.invited} />
        <Stat label={t('Ulardan ustalar')} value={data.stats.masters} />
        <Stat label={t('Faol (ish bajarilgan)')} value={data.stats.active} />
        <Stat label={t('Olingan bonus')} value={formatSum(data.stats.earned)} />
      </div>

      <section className="card p-5" aria-labelledby="invited-title">
        <h2 id="invited-title" className="font-bold text-slate-900">{t('Siz taklif qilganlar')}</h2>
        {data.invited.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2 flex items-center gap-2"><UserPlus className="w-4 h-4" aria-hidden="true" /> {t('Hali hech kim yo\'q. Havolani birinchi do\'stingizga yuboring!')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 mt-1">
            {data.invited.map((person, index) => (
              <li key={`${person.name}-${index}`} className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  {(person.name || '?').charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {person.name || t('Ismsiz')}
                    <span className="ml-2 text-[11px] font-bold text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">{person.is_master ? t('Usta') : t('Mijoz')}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">{person.joined_at ? formatDate(person.joined_at, false) : ''}</p>
                </div>
                {person.active ? (
                  <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1 whitespace-nowrap">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    {person.bonus > 0 ? `+${formatSum(person.bonus)}` : t('Ish bajarildi')}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 whitespace-nowrap">{t('Ro\'yxatdan o\'tdi')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
