import React, { useState } from 'react';
import { AlertTriangle, Printer, Wrench } from 'lucide-react';
import Spinner from '../Spinner';
import { isTemporaryHost } from '../../lib/print';

// Varaq ichidagi ranglar doim bir xil (tungi rejimdan qat'i nazar, printerda ham)
export const FLYER = {
  blue: '#2563eb',
  indigo: '#4338ca',
  ink: '#0f172a',
  muted: '#475569',
  faint: '#94a3b8',
  line: '#e2e8f0',
  soft: '#eff6ff',
  amber: '#f59e0b',
  green: '#16a34a',
  gradient: 'linear-gradient(135deg, #2563eb 0%, #4338ca 100%)'
};

/**
 * Usta24 belgisi (varaq uchun)
 */
export function FlyerLogo({ size = 14, light = false }) {
  const box = size * 2.3;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.6 }}>
      <span
        style={{
          width: box, height: box, borderRadius: box * 0.28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: light ? 'rgba(255,255,255,0.18)' : FLYER.gradient
        }}
      >
        <Wrench color="#ffffff" size={size * 1.3} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span style={{ fontSize: `${size * 1.45}pt`, fontWeight: 900, color: light ? '#ffffff' : FLYER.ink, letterSpacing: '-0.02em' }}>
        Usta<span style={{ color: light ? '#bfdbfe' : FLYER.blue }}>24</span>
      </span>
    </span>
  );
}

const waitForImages = () => Promise.all(
  [...document.querySelectorAll('.print-sheet img')].map((img) => (img.complete
    ? null
    : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    })))
);

/**
 * Varaq sahifasining boshqaruvi: sarlavha, ogohlantirish, chop etish tugmasi (printerga chiqmaydi)
 */
export function FlyerToolbar({ title, description, children }) {
  const [preparing, setPreparing] = useState(false);
  const temporary = isTemporaryHost(window.location.hostname);

  const print = async () => {
    setPreparing(true);
    await waitForImages();
    setPreparing(false);
    window.print();
  };

  return (
    <div className="print:hidden space-y-4 mb-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">{description}</p>
        </div>
        <button type="button" onClick={print} className="btn btn-primary" disabled={preparing}>
          {preparing ? <Spinner className="w-4 h-4 text-white" /> : <Printer className="w-4 h-4" />} Chop etish
        </button>
      </div>
      {children}
      {temporary && (
        <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2" role="note">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Sayt hozir vaqtinchalik manzilda ({window.location.host}). Bu QR kod boshqa telefonlarda ochilmaydi —
            varaqani sayt o'z domenida (masalan, usta24.uz) ishga tushgandan keyin chop eting.
          </span>
        </p>
      )}
      <p className="hint">
        Chop etish oynasida: qog'oz — A4, chekkalar (margins) — «Yo'q», «Fon rasmlari» (Background graphics) — yoqilgan.
        PDF qilib saqlab, bosmaxonaga ham berishingiz mumkin.
      </p>
    </div>
  );
}
