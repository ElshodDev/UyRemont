// =============================================
// Ko'rinish (yorug' / qorong'i / tizim bo'yicha)
// Tanlov brauzerda saqlanadi; dastlabki holat index.html dagi skriptda qo'llanadi (oq "miltillash" bo'lmasligi uchun)
// =============================================

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'usta24_theme';
export const THEME_OPTIONS = [
  { id: 'system', label: 'Telefon bo\'yicha' },
  { id: 'light', label: 'Yorug\'' },
  { id: 'dark', label: 'Qorong\'i' }
];
const THEME_COLORS = { light: '#ffffff', dark: '#131c2e' };
const EVENT = 'usta24:theme';

const media = () => (typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null);

export const getThemePreference = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEME_OPTIONS.some((o) => o.id === value) ? value : 'system';
  } catch {
    return 'system';
  }
};

const resolve = (preference) => (preference === 'system'
  ? (media()?.matches ? 'dark' : 'light')
  : preference);

export const applyTheme = (preference = getThemePreference()) => {
  const resolved = resolve(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
  return resolved;
};

export const setThemePreference = (preference) => {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Saqlab bo'lmasa ham joriy sahifada qo'llanadi
  }
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: preference }));
};

/**
 * Joriy tanlov va qo'llangan ko'rinish. Telefon sozlamasi o'zgarsa ham kuzatadi.
 */
export function useTheme() {
  const [preference, setPreference] = useState(getThemePreference);
  const [resolved, setResolved] = useState(() => resolve(getThemePreference()));

  useEffect(() => {
    const onChange = () => {
      const current = getThemePreference();
      setPreference(current);
      setResolved(applyTheme(current));
    };
    const mq = media();
    mq?.addEventListener?.('change', onChange);
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      mq?.removeEventListener?.('change', onChange);
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return { preference, resolved, setPreference: setThemePreference };
}
