import React from 'react';
import { MapPin } from 'lucide-react';
import { districtsList, ALL_DISTRICTS } from '../../data/catalog';
import { RATING_OPTIONS, EXPERIENCE_OPTIONS } from '../../lib/catalogFilters';
import { t } from '../../i18n';

function Segmented({ label, options, value, onChange, suffix }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid gap-1 p-1 rounded-xl bg-slate-100" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue || 'all'}
            type="button"
            role="radio"
            aria-checked={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={`min-h-9 rounded-lg text-xs font-bold transition ${
              value === optionValue ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {optionValue ? `${optionLabel}${suffix || ''}` : t(optionLabel)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ id, label, hint, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 min-h-11 py-1.5 cursor-pointer">
      <input id={id} type="checkbox" className="mt-0.5 w-5 h-5 accent-blue-600 flex-shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Katalog filtrlari maydonlari. Kompyuterda yon panelda (darhol qo'llanadi),
 * telefonda pastdan ochiladigan oynada (qoralama, "Ko'rsatish" bilan qo'llanadi)
 * @param {{ value: object, onChange: (partial: object) => void, idPrefix: string }} props
 */
export default function FilterFields({ value, onChange, idPrefix }) {
  const priceInput = (key, label) => (
    <input
      id={`${idPrefix}-${key}`}
      className="input tabular-nums"
      inputMode="numeric"
      placeholder={label}
      aria-label={t('Narx: {label}', { label })}
      value={value[key]}
      onChange={(e) => onChange({ [key]: e.target.value.replace(/\D/g, '').slice(0, 9) })}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor={`${idPrefix}-district`}>{t('Tuman')}</label>
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <select
            id={`${idPrefix}-district`}
            className="input pl-9"
            value={value.district || ALL_DISTRICTS}
            onChange={(e) => onChange({ district: e.target.value === ALL_DISTRICTS ? '' : e.target.value })}
          >
            {districtsList.map((d) => <option key={d} value={d}>{t(d)}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="label">{t('Boshlang\'ich narx (so\'m)')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {priceInput('min_price', t('dan'))}
          {priceInput('max_price', t('gacha'))}
        </div>
      </fieldset>

      <Segmented label={t('Reyting')} options={RATING_OPTIONS} value={value.rating} onChange={(rating) => onChange({ rating })} />
      <Segmented label={t('Tajriba (yil)')} options={EXPERIENCE_OPTIONS} value={value.exp} onChange={(exp) => onChange({ exp })} />

      <div className="divide-y divide-slate-100 -my-1.5">
        <Toggle id={`${idPrefix}-verified`} label={t('Faqat tasdiqlangan')} hint={t('Hujjatlari administrator tomonidan tekshirilgan')} checked={value.verified} onChange={(verified) => onChange({ verified })} />
        <Toggle id={`${idPrefix}-available`} label={t('Hozir bo\'sh')} checked={value.available} onChange={(available) => onChange({ available })} />
        <Toggle id={`${idPrefix}-reviews`} label={t('Sharhi bor')} checked={value.reviews} onChange={(reviews) => onChange({ reviews })} />
      </div>
    </div>
  );
}
