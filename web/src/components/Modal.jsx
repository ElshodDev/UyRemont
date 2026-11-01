import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '../i18n';

/**
 * Umumiy modal oyna: telefonda pastdan chiqadi, kompyuterda markazda.
 * Fon bosilganda yoki Escape tugmasida yopiladi, yopilgach fokus oldingi elementga qaytadi.
 * portal - oyna boshqa oyna ichidan ochilsa (masalan, usta profilidan shikoyat), sahifa darajasida chiziladi.
 */
export default function Modal({ onClose, children, size = 'md', className = '', labelledBy, portal = false }) {
  const panelRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Ustma-ust oynalarda faqat eng yuqoridagisi yopiladi
      const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (open.length && open[open.length - 1] !== rootRef.current) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Ekran o'quvchi va klaviatura uchun fokusni oynaga o'tkazish
  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' };

  const dialog = (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`bg-white w-full ${widths[size]} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl relative outline-none animate-sheet-up sm:animate-fade-up ${className}`}
      >
        <span className="sm:hidden block w-10 h-1 rounded-full bg-slate-200 mx-auto -mt-2 mb-4" aria-hidden="true" />
        <button
          onClick={onClose}
          className="icon-btn absolute top-3 right-3 text-slate-400"
          aria-label={t('Yopish')}
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(dialog, document.body) : dialog;
}
