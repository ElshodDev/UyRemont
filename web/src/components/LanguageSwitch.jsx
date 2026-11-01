import React from 'react';
import { LANGUAGES } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

/**
 * UZ | RU almashtirgich. Kirgan foydalanuvchining tili hisobga ham yoziladi
 * (Telegram va boshqa xabarlar shu tilda keladi)
 * @param {{ size?: 'sm'|'md', className?: string }} props
 */
export default function LanguageSwitch({ size = 'md', className = '' }) {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();

  const choose = (code) => {
    if (code === lang) return;
    if (user) api('/auth/me', { method: 'PUT', body: { language: code } }).catch(() => {});
    setLang(code);
  };

  return (
    <div className={`inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 ${className}`} role="radiogroup" aria-label="Til / Язык">
      {LANGUAGES.map(([code, label, short]) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={lang === code}
          aria-label={label}
          lang={code}
          onClick={() => choose(code)}
          className={`${size === 'sm' ? 'min-h-8 px-2 text-[11px]' : 'min-h-9 px-3 text-xs'} rounded-lg font-bold transition ${
            lang === code ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {short}
        </button>
      ))}
    </div>
  );
}
