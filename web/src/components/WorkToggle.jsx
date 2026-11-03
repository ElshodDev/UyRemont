import React, { useState } from 'react';
import { Power, Moon } from 'lucide-react';
import Spinner from './Spinner';
import { useDispatch } from '../context/DispatchContext';
import { t } from '../i18n';

/**
 * Usta ish rejimi: ikkita katta tugma - "Ishga chiqish" va "Dam olish". Hozirgi holat belgilangan.
 * Ishga chiqish shartlari bajarilmagan bo'lsa (masalan, pasport tekshirilmoqda) "Ishga chiqish" yopiq.
 * @param {{ size?: 'lg' | 'sm' }} props
 */
export default function WorkToggle({ size = 'lg' }) {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(null);
  if (!dispatch?.state) return null;

  const { isOnline } = dispatch;
  const canGoOnline = dispatch.state.requirements?.can_go_online;

  const set = async (online) => {
    if (online === isOnline) return;
    setBusy(online ? 'on' : 'off');
    if (online) await dispatch.goOnline();
    else await dispatch.goOffline();
    setBusy(null);
  };

  const big = size === 'lg';
  // Katta: telefonda belgi matn ustida (tor ekranda matn bir qatorda qoladi)
  const base = `flex items-center justify-center rounded-2xl font-black whitespace-nowrap transition disabled:opacity-50 ${
    big ? 'min-h-16 py-2 flex-col gap-1 sm:flex-row sm:gap-2 text-base sm:text-lg' : 'min-h-11 gap-2 text-sm'
  }`;

  return (
    <div role="group" aria-label={t('Ish rejimi')} className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => set(true)}
        disabled={Boolean(busy) || (!isOnline && !canGoOnline)}
        aria-pressed={isOnline}
        className={`${base} ${isOnline
          ? 'bg-emerald-500 text-white ring-2 ring-white shadow-lg'
          : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'}`}
      >
        {busy === 'on' ? <Spinner className="w-5 h-5" /> : <Power className={big ? 'w-6 h-6' : 'w-4 h-4'} aria-hidden="true" />}
        {t('Ishga chiqish')}
      </button>
      <button
        type="button"
        onClick={() => set(false)}
        disabled={Boolean(busy)}
        aria-pressed={!isOnline}
        className={`${base} ${!isOnline
          ? 'bg-slate-700 text-white ring-2 ring-white shadow-lg'
          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
      >
        {busy === 'off' ? <Spinner className="w-5 h-5" /> : <Moon className={big ? 'w-6 h-6' : 'w-4 h-4'} aria-hidden="true" />}
        {t('Dam olish')}
      </button>
    </div>
  );
}
