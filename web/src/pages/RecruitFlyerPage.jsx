import React, { useEffect, useState } from 'react';
import { CheckCircle2, Scissors, Smartphone, ClipboardList, ShieldCheck } from 'lucide-react';
import PrintSheet from '../components/PrintSheet';
import { FLYER, FlyerLogo, FlyerToolbar } from '../components/flyer/FlyerParts';
import { PageLoader } from '../components/Spinner';
import { ErrorState } from '../components/EmptyState';
import { api, BACKEND_URL } from '../lib/api';
import { shortUrl } from '../lib/print';
import { useSpecializations } from '../lib/useSpecializations';
import { mainVerticals } from '../data/catalog';

const STRIPS = 7;

/**
 * Usta jalb qilish varaqasi (A4): bozorlar, qurilish mollari do'konlari va avtoservislar yoniga yopishtiriladi.
 * QR kod ustalar uchun qo'llanmaga (/ustalar) olib boradi, pastida yirtib olinadigan qirqimlar.
 */
export default function RecruitFlyerPage() {
  const [config, setConfig] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState('');
  const { specializations } = useSpecializations();

  const load = () => {
    setError('');
    api('/dispatch/config').then(({ data }) => setConfig(data)).catch((err) => setError(err.message));
    api('/support/contacts').then(({ data }) => setContacts(data)).catch(() => setContacts({}));
  };
  useEffect(load, []);

  if (error) return <main className="max-w-3xl mx-auto px-4 py-10 w-full flex-1"><ErrorState message={error} onRetry={load} /></main>;
  if (!config) return <PageLoader />;

  const qrSrc = `${BACKEND_URL}/api/qr/ustalar?format=svg`;
  const link = shortUrl(window.location.origin, '/ustalar');
  const groups = mainVerticals
    .map((v) => ({ name: v.name, items: specializations.filter((s) => s.vertical === v.id).map((s) => s.name_uz) }))
    .filter((g) => g.items.length > 0);

  const benefits = [
    'Yaqin atrofingizdagi buyurtmalar telefoningizga keladi',
    'Xohlagan paytda ishlaysiz, xohlagan paytda dam olasiz',
    `Ro'yxatdan o'tish bepul, komissiya faqat bajarilgan ishdan (${config.commission_percent}%)`,
    'Shaxsiy sahifa, sharhlar va QR kod — mijozlar sizni o\'zi topadi'
  ];
  const steps = [
    { icon: Smartphone, title: 'Skanerlang', text: 'Telefon kamerasini QR kodga qarating' },
    { icon: ClipboardList, title: 'Profil to\'ldiring', text: 'Ism, soha, tuman, ishlaringiz rasmlari' },
    { icon: ShieldCheck, title: 'Tasdiqdan o\'ting', text: 'Pasport rasmini yuklang — buyurtmalar keladi' }
  ];
  const contactLine = [contacts?.phone, contacts?.telegram && `Telegram: @${contacts.telegram}`].filter(Boolean).join('   ·   ');

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full flex-1 print:p-0 print:max-w-none">
      <FlyerToolbar
        title="Usta jalb qilish varaqasi"
        description="A4 qog'ozga chop eting va bozorlar, qurilish mollari do'konlari, avtoservislar yoniga yopishtiring. Pastki qirqimlarni usta yirtib oladi."
      />

      <PrintSheet label="Usta jalb qilish varaqasi">
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: FLYER.gradient, color: '#ffffff', padding: '9mm 14mm 8mm' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FlyerLogo size={13} light />
              <span style={{ fontSize: '11pt', fontWeight: 700, opacity: 0.85 }}>{shortUrl(window.location.origin)}</span>
            </div>
            <p style={{ marginTop: '6mm', fontSize: '38pt', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.02em' }}>Ustamisiz?</p>
            <p style={{ marginTop: '2mm', fontSize: '24pt', fontWeight: 800, lineHeight: 1.15 }}>Mijozlar sizni o'zi topadi</p>
          </div>

          <div style={{ flex: 1, minHeight: 0, padding: '7mm 14mm 0', display: 'flex', flexDirection: 'column', gap: '5mm' }}>
            <div style={{ display: 'flex', gap: '9mm', alignItems: 'stretch' }}>
              <ul style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4mm', listStyle: 'none', margin: 0, padding: 0 }}>
                {benefits.map((text) => (
                  <li key={text} style={{ display: 'flex', gap: '3mm', fontSize: '13pt', fontWeight: 600, lineHeight: 1.3, color: FLYER.ink }}>
                    <CheckCircle2 color={FLYER.green} size={22} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: '0.5mm' }} aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
              <div style={{ width: '58mm', flexShrink: 0, textAlign: 'center', border: `0.6mm solid ${FLYER.blue}`, borderRadius: '5mm', padding: '3.5mm' }}>
                <img src={qrSrc} alt={`QR kod: ${link}`} style={{ width: '48mm', height: '48mm', display: 'block', margin: '0 auto' }} />
                <p style={{ marginTop: '2mm', fontSize: '11pt', fontWeight: 800, color: FLYER.blue }}>Skanerlang</p>
                <p style={{ fontSize: '9pt', fontWeight: 600, color: FLYER.muted, wordBreak: 'break-all' }}>{link}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm' }}>
              {steps.map(({ icon: Icon, title, text }, i) => (
                <div key={title} style={{ background: FLYER.soft, borderRadius: '4mm', padding: '4mm' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2.5mm' }}>
                    <span style={{ width: '8mm', height: '8mm', borderRadius: '50%', background: FLYER.blue, color: '#fff', fontWeight: 900, fontSize: '11pt', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <Icon color={FLYER.blue} size={20} strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <p style={{ marginTop: '2.5mm', fontSize: '12pt', fontWeight: 800, color: FLYER.ink }}>{title}</p>
                  <p style={{ marginTop: '1mm', fontSize: '9.5pt', color: FLYER.muted, lineHeight: 1.3 }}>{text}</p>
                </div>
              ))}
            </div>

            {groups.length > 0 && (
              <div>
                <p style={{ fontSize: '12pt', fontWeight: 800, color: FLYER.ink }}>Qaysi ustalar kerak:</p>
                <div style={{ marginTop: '2mm', display: 'flex', flexDirection: 'column', gap: '1.6mm' }}>
                  {groups.map((g) => (
                    <p key={g.name} style={{ fontSize: '9.5pt', lineHeight: 1.35, color: FLYER.muted }}>
                      <strong style={{ color: FLYER.ink }}>{g.name}:</strong> {g.items.join(', ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {contactLine && (
              <p style={{ fontSize: '11pt', fontWeight: 700, color: FLYER.ink }}>
                Savollar bo'yicha: <span style={{ color: FLYER.blue }}>{contactLine}</span>
              </p>
            )}
          </div>

          <div style={{ marginTop: '4mm', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', padding: '0 4mm', color: FLYER.faint }}>
              <Scissors size={14} color={FLYER.faint} aria-hidden="true" />
              <div style={{ flex: 1, borderTop: `0.3mm dashed ${FLYER.faint}` }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STRIPS}, 1fr)`, height: '41mm' }}>
              {Array.from({ length: STRIPS }, (_, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: i === 0 ? 'none' : `0.3mm dashed ${FLYER.faint}`, padding: '2.5mm 1.5mm',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
                  }}
                >
                  <img src={qrSrc} alt="" style={{ width: '19mm', height: '19mm' }} />
                  <p style={{ marginTop: '1.5mm', fontSize: '10pt', fontWeight: 900, color: FLYER.ink }}>Usta24</p>
                  <p style={{ fontSize: '7.5pt', fontWeight: 600, color: FLYER.muted, lineHeight: 1.2 }}>ustalar uchun ish</p>
                  <p style={{ marginTop: '1mm', fontSize: '6.5pt', fontWeight: 700, color: FLYER.blue, wordBreak: 'break-all', lineHeight: 1.15 }}>{link}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PrintSheet>
    </main>
  );
}
