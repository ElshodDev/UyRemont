import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, MapPin, Star, MessageSquareText, Images, MousePointerClick } from 'lucide-react';
import PrintSheet from '../components/PrintSheet';
import { FLYER, FlyerLogo, FlyerToolbar } from '../components/flyer/FlyerParts';
import { PageLoader } from '../components/Spinner';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { api, BACKEND_URL } from '../lib/api';
import { shortUrl } from '../lib/print';
import { t, specName } from '../i18n';

// Varaq matnlari ham joriy tilda: ruscha tanlagan usta ruscha varaqa chop etadi
const LAYOUTS = () => [
  ['flyer', t('Varaqa (A4)')],
  ['cards', t('Vizitkalar (10 ta)')]
];
const CARDS = 10;

const reviewsLine = (master) => `${Number(master.rating).toFixed(1)} · ${t('{n} ta sharh', { n: Number(master.reviews_count) })}`;

const ratingLine = (master) => [
  Number(master.reviews_count) > 0 ? reviewsLine(master) : t('Yangi usta'),
  Number(master.completed_orders) > 0 ? t('{n} ta bajarilgan ish', { n: Number(master.completed_orders) }) : null
].filter(Boolean).join(' · ');

// Shahar va tuman bazadagi o'zbekcha qiymat: ko'rsatishda tarjima qilinadi
const placeLine = (master) => [master.city, master.district].filter(Boolean).map((place) => t(place)).join(', ');

function Flyer({ master, qrSrc, link }) {
  const specs = master.specializations.map((s) => specName(s));
  const perks = [
    { icon: MessageSquareText, text: t('Sharhlar va reyting') },
    { icon: Images, text: t('Ishlarim rasmlari') },
    { icon: MousePointerClick, text: t('Bir tugmada buyurtma') }
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: FLYER.gradient, padding: '10mm 14mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FlyerLogo size={13} light />
        <span style={{ color: '#ffffff', fontSize: '11pt', fontWeight: 700, opacity: 0.9 }}>{t('Ishonchli usta — bir tugmada')}</span>
      </div>

      <div style={{ flex: 1, padding: '11mm 16mm 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        {master.is_verified && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1.5mm', padding: '1.5mm 4mm', borderRadius: '99mm', background: '#dcfce7', color: '#166534', fontSize: '11pt', fontWeight: 800 }}>
            <BadgeCheck size={18} color={FLYER.green} aria-hidden="true" /> {t('Tasdiqlangan usta')}
          </span>
        )}
        <p style={{ marginTop: '5mm', fontSize: master.name.length > 22 ? '28pt' : '36pt', fontWeight: 900, color: FLYER.ink, lineHeight: 1.05, letterSpacing: '-0.02em' }}>{master.name}</p>
        {specs.length > 0 && (
          <p style={{ marginTop: '3mm', fontSize: '16pt', fontWeight: 700, color: FLYER.blue }}>{specs.slice(0, 4).join(' · ')}</p>
        )}
        <p style={{ marginTop: '3mm', fontSize: '13pt', fontWeight: 600, color: FLYER.muted, display: 'inline-flex', alignItems: 'center', gap: '2mm' }}>
          {Number(master.reviews_count) > 0 && <Star size={18} color={FLYER.amber} fill={FLYER.amber} aria-hidden="true" />}
          {ratingLine(master)}
        </p>
        {placeLine(master) && (
          <p style={{ marginTop: '1.5mm', fontSize: '12pt', color: FLYER.muted, display: 'inline-flex', alignItems: 'center', gap: '1.5mm' }}>
            <MapPin size={16} color={FLYER.muted} aria-hidden="true" /> {placeLine(master)}
          </p>
        )}

        <div style={{ marginTop: '9mm', padding: '6mm', borderRadius: '7mm', border: `0.8mm solid ${FLYER.blue}` }}>
          <img src={qrSrc} alt={t('QR kod: {link}', { link })} style={{ width: '88mm', height: '88mm', display: 'block' }} />
        </div>
        <p style={{ marginTop: '5mm', fontSize: '17pt', fontWeight: 900, color: FLYER.ink }}>{t('Telefon kamerasi bilan skanerlang')}</p>
        <p style={{ marginTop: '1mm', fontSize: '13pt', fontWeight: 700, color: FLYER.blue }}>{link}</p>

        <div style={{ marginTop: '8mm', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm', width: '100%' }}>
          {perks.map(({ icon: Icon, text }) => (
            <div key={text} style={{ background: FLYER.soft, borderRadius: '4mm', padding: '4mm 2mm', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm' }}>
              <Icon size={22} color={FLYER.blue} aria-hidden="true" />
              <span style={{ fontSize: '10.5pt', fontWeight: 700, color: FLYER.ink }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '6mm 14mm', borderTop: `0.3mm solid ${FLYER.line}`, display: 'flex', justifyContent: 'space-between', fontSize: '9.5pt', color: FLYER.muted }}>
        <span>{t('Usta24 — uy, avto va texnika ustalari')}</span>
        <span style={{ fontWeight: 700 }}>{shortUrl(window.location.origin)}</span>
      </div>
    </div>
  );
}

function BusinessCard({ master, qrSrc, link }) {
  const specs = master.specializations.map((s) => specName(s)).slice(0, 2).join(' · ');
  return (
    <div style={{ width: '85mm', height: '55mm', boxSizing: 'border-box', border: `0.2mm dashed ${FLYER.faint}`, position: 'relative', overflow: 'hidden', display: 'flex' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5mm', background: FLYER.gradient }} />
      <div style={{ flex: 1, minWidth: 0, padding: '6mm 2mm 3.5mm 5mm', display: 'flex', flexDirection: 'column' }}>
        <FlyerLogo size={6} />
        <p style={{ marginTop: '2.5mm', fontSize: '12pt', fontWeight: 900, color: FLYER.ink, lineHeight: 1.1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{master.name}</p>
        {specs && <p style={{ marginTop: '1mm', fontSize: '8pt', fontWeight: 700, color: FLYER.blue, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{specs}</p>}
        <p style={{ marginTop: '0.8mm', fontSize: '7pt', color: FLYER.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {Number(master.reviews_count) > 0 ? `★ ${reviewsLine(master)}` : t('Yangi usta')}
        </p>
        <p style={{ marginTop: 'auto', fontSize: '7pt', fontWeight: 700, color: FLYER.ink }}>{t('Usta24 orqali chaqiring')}</p>
        <p style={{ fontSize: '6.5pt', fontWeight: 700, color: FLYER.blue, wordBreak: 'break-all', lineHeight: 1.15 }}>{link}</p>
      </div>
      <div style={{ width: '33mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '2mm' }}>
        <img src={qrSrc} alt="" style={{ width: '29mm', height: '29mm' }} />
      </div>
    </div>
  );
}

function CardsSheet({ master, qrSrc, link }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 85mm)', gridAutoRows: '55mm' }}>
        {Array.from({ length: CARDS }, (_, i) => <BusinessCard key={i} master={master} qrSrc={qrSrc} link={link} />)}
      </div>
    </div>
  );
}

/**
 * Ustaning shaxsiy varaqasi va vizitkalari: QR kod ustaning ommaviy sahifasiga (/u/<nom>) olib boradi
 */
export default function MasterFlyerPage() {
  const [master, setMaster] = useState(null);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState('flyer');

  const load = () => {
    setError('');
    setMaster(null);
    api('/masters/me/link')
      .then(({ data }) => api(`/masters/u/${encodeURIComponent(data.slug)}`))
      .then(({ data }) => setMaster(data))
      .catch((err) => setError(err.status === 404 ? 'no_profile' : err.message));
  };
  useEffect(load, []);

  if (error === 'no_profile') {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1">
        <EmptyState
          icon="🪪"
          title={t('Avval profilingizni to\'ldiring')}
          description={t('Varaqa va vizitkada ismingiz, sohalaringiz va shaxsiy havolangiz chiqadi.')}
          action={<Link to="/master/profile" className="btn btn-primary">{t('Profilga o\'tish')}</Link>}
        />
      </main>
    );
  }
  if (error) return <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1"><ErrorState message={error} onRetry={load} /></main>;
  if (!master) return <PageLoader />;

  const qrSrc = `${BACKEND_URL}/api/masters/u/${master.public_slug}/qr?format=svg`;
  const link = shortUrl(window.location.origin, `/u/${master.public_slug}`);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 print:p-0 print:max-w-none">
      <FlyerToolbar
        title={t('Varaqa va vizitka')}
        description={t('QR kod sizning sahifangizga olib boradi: mijoz sharhlaringizni ko\'rib, to\'g\'ridan-to\'g\'ri buyurtma beradi. Eshik, mashina oynasi yoki do\'konga yopishtiring, vizitkalarni mijozlarga bering.')}
      >
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit" role="radiogroup" aria-label={t('Varaqa turi')}>
          {LAYOUTS().map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={layout === id}
              onClick={() => setLayout(id)}
              className={`min-h-9 px-3 rounded-lg text-sm font-bold ${layout === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {layout === 'cards' && <p className="hint">{t('Vizitkalar standart o\'lchamda (85×55 mm): qalinroq qog\'ozga chop etib, chiziqlar bo\'yicha qirqing.')}</p>}
      </FlyerToolbar>

      <PrintSheet label={layout === 'cards' ? t('Vizitkalar') : t('Varaqa')}>
        {layout === 'cards'
          ? <CardsSheet master={master} qrSrc={qrSrc} link={link} />
          : <Flyer master={master} qrSrc={qrSrc} link={link} />}
      </PrintSheet>
    </main>
  );
}
