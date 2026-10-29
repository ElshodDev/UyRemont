import React from 'react';
import { Moon, Smartphone, Sun } from 'lucide-react';
import { THEME_OPTIONS, useTheme } from '../lib/theme';

const ICONS = { system: Smartphone, light: Sun, dark: Moon };

/**
 * Profil sahifasi uchun: uchta variantdan biri
 */
export function ThemeSegmented() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100" role="radiogroup" aria-label="Ko'rinish">
      {THEME_OPTIONS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const active = preference === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(id)}
            className={`min-h-11 px-2 rounded-xl text-xs font-semibold inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sarlavha uchun: bosilganda yorug' va qorong'i o'rtasida almashadi
 */
export function ThemeToggleButton({ className = '' }) {
  const { resolved, setPreference } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const Icon = resolved === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className={`icon-btn ${className}`}
      aria-label={next === 'dark' ? 'Qorong\'i rejimni yoqish' : 'Yorug\' rejimni yoqish'}
      title={next === 'dark' ? 'Qorong\'i rejim' : 'Yorug\' rejim'}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
