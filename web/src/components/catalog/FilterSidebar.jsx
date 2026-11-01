import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import FilterFields from './FilterFields';
import { countFilters } from '../../lib/catalogFilters';
import { t } from '../../i18n';

const PRICE_KEYS = ['min_price', 'max_price'];

/**
 * Kompyuterda yon panel: tanlov darhol qo'llanadi.
 * Narx maydonlari yozib bo'lingach (biroz kutib) qo'llanadi, har bir raqamda so'rov ketmasligi uchun.
 */
export default function FilterSidebar({ value, onChange, onClear }) {
  const [local, setLocal] = useState(value);
  const timer = useRef(null);
  const pendingPrice = useRef({});

  // Tashqaridan o'zgarsa (chip, tozalash, ortga qaytish) panel ham yangilanadi
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (partial) => {
    setLocal((current) => ({ ...current, ...partial }));
    clearTimeout(timer.current);
    if (Object.keys(partial).every((key) => PRICE_KEYS.includes(key))) {
      pendingPrice.current = { ...pendingPrice.current, ...partial };
      timer.current = setTimeout(() => {
        onChange(pendingPrice.current);
        pendingPrice.current = {};
      }, 600);
    } else {
      // Boshqa filtr tanlansa, yozilayotgan narx ham birga qo'llanadi
      onChange({ ...pendingPrice.current, ...partial });
      pendingPrice.current = {};
    }
  };

  const selected = countFilters(value);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" aria-hidden="true" />
          {t('Filtrlar')}
        </h2>
        {selected > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-bold text-blue-600 hover:text-blue-700 min-h-9 px-1">
            {t('Tozalash')}
          </button>
        )}
      </div>
      <FilterFields value={local} onChange={update} idPrefix="side" />
    </div>
  );
}
