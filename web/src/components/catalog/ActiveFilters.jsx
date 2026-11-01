import React from 'react';
import { X } from 'lucide-react';
import { activeFilterChips } from '../../lib/catalogFilters';
import { t } from '../../i18n';

/**
 * Tanlangan filtrlar chiplari: × bilan bittasini, "Hammasini tozalash" bilan barchasini olib tashlash
 */
export default function ActiveFilters({ filters, onChange, onClear }) {
  const chips = activeFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="sr-only">{t('Tanlangan filtrlar:')}</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onChange(chip.reset)}
          aria-label={t('Filtrni olib tashlash: {label}', { label: chip.label })}
          className="inline-flex items-center gap-1.5 min-h-9 pl-3 pr-2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition"
        >
          {chip.label}
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-9 px-2 text-xs font-bold text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
        >
          {t('Hammasini tozalash')}
        </button>
      )}
    </div>
  );
}
