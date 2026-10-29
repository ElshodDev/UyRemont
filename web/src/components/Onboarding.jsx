import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClipboardPen, Car, HandCoins, Zap, ArrowRight } from 'lucide-react';
import { useCallMaster } from '../lib/useCallMaster';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'usta24_onboarded';
const OPEN_EVENT = 'usta24:onboarding';
// Huquqiy sahifalarga to'g'ridan-to'g'ri havola bilan kelganlarga xalaqit bermaslik uchun
const SKIP_PATHS = ['/terms', '/privacy'];

const SLIDES = [
  {
    icon: ClipboardPen,
    tone: 'from-blue-500 to-indigo-600 shadow-blue-500/30',
    title: 'Muammoni yozing',
    text: 'Xizmat turini tanlang, manzilni xaritada belgilang va rasm qo\'shing. Taxminiy narxni oldindan ko\'rasiz.'
  },
  {
    icon: Car,
    tone: 'from-amber-400 to-orange-500 shadow-orange-500/30',
    title: 'Usta keladi',
    text: 'Eng yaqin bo\'sh usta chaqiruvni qabul qiladi. Uning yo\'lda kelayotganini xaritada kuzatib turasiz.'
  },
  {
    icon: HandCoins,
    tone: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
    title: 'Ish tugagach to\'laysiz',
    text: 'Narxni usta bilan joyida kelishasiz va faqat ish tugagach to\'laysiz. Keyin ustani baholaysiz.'
  }
];

const wasSeen = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
};

/** Tanishtiruvni qayta ko'rsatish (masalan, "Qanday ishlaydi?" tugmasidan) */
export const openOnboarding = () => window.dispatchEvent(new Event(OPEN_EVENT));

/**
 * Birinchi ochilishda 3 ta tanishtiruv ekrani: o'tkazib yuborish mumkin, telefonda surib almashtiriladi
 */
export default function Onboarding() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const callMaster = useCallMaster();
  const [open, setOpen] = useState(() => !wasSeen() && !SKIP_PATHS.includes(window.location.pathname));
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const show = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // saqlanmasa keyingi safar yana ko'rsatiladi
    }
  };

  const go = (next) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open || SKIP_PATHS.includes(location.pathname)) return null;

  const slide = SLIDES[index];
  const Icon = slide.icon;
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[65] bg-white flex flex-col outline-none sm:bg-ink/60 sm:backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-roledescription="tanishtiruv"
      aria-label="Usta24 qanday ishlaydi"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="flex-1 sm:flex-none w-full sm:max-w-md bg-white sm:rounded-3xl sm:shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-sm font-black text-slate-900">Usta<span className="text-blue-600">24</span></span>
          <button type="button" onClick={close} className="btn btn-ghost px-3">
            O'tkazib yuborish
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-6" aria-live="polite">
          <div key={index} className="animate-fade-up flex flex-col items-center">
            <div className={`w-36 h-36 sm:w-32 sm:h-32 rounded-[2.5rem] bg-gradient-to-br ${slide.tone} shadow-2xl flex items-center justify-center text-white mb-8`}>
              <Icon className="w-16 h-16 sm:w-14 sm:h-14" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{index + 1}-qadam / {SLIDES.length}</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3">{slide.title}</h2>
            <p className="text-base text-slate-600 leading-relaxed max-w-xs">{slide.text}</p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="flex justify-center gap-2" role="tablist" aria-label="Qadamlar">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}-qadam: ${s.title}`}
                onClick={() => go(i)}
                className="w-6 h-11 flex items-center justify-center"
              >
                <span className={`block h-2 rounded-full transition-all ${i === index ? 'w-6 bg-blue-600' : 'w-2 bg-slate-300'}`} />
              </button>
            ))}
          </div>

          {isLast ? (
            <div className="space-y-2">
              {(!user || user.role === 'client') && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    callMaster();
                  }}
                  className="btn btn-accent btn-lg w-full"
                >
                  <Zap className="w-5 h-5" /> Usta chaqirish
                </button>
              )}
              <button type="button" onClick={close} className="btn btn-secondary w-full min-h-12">
                Avval ustalarni ko'rib chiqaman
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    navigate('/master/setup');
                  }}
                  className="btn btn-ghost w-full text-xs"
                >
                  Men ustaman — buyurtma olmoqchiman
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => go(index + 1)} className="btn btn-primary btn-lg w-full">
              Keyingi <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
