import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import FilterFields from './FilterFields';
import Spinner from '../Spinner';
import { api } from '../../lib/api';
import { EMPTY_FILTERS, countFilters, filtersToApi } from '../../lib/catalogFilters';
import { t } from '../../i18n';

/**
 * Telefonda filtrlar oynasi (pastdan chiqadi). Tanlovlar qoralamada turadi va
 * "N ta ustani ko'rsatish" bosilganda qo'llanadi. Tugmadagi son tanlov o'zgarishi bilan yangilanadi.
 * @param {{ initial: object, baseParams: object, onApply: (filters) => void, onClose: () => void }} props
 */
export default function FilterSheet({ initial, baseParams, onApply, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [count, setCount] = useState(null);
  const [counting, setCounting] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setCounting(true);
    const timer = setTimeout(() => {
      api('/masters', { params: { ...baseParams, ...filtersToApi(draft), page: 1, limit: 1 }, signal: controller.signal })
        .then(({ data }) => {
          setCount(data.pagination.total);
          setCounting(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setCount(null);
          setCounting(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, baseParams]);

  const update = (partial) => setDraft((current) => ({ ...current, ...partial }));
  const selected = countFilters(draft);

  let applyLabel = t('Ko\'rsatish');
  if (count === 0) applyLabel = t('Mos usta yo\'q');
  else if (count !== null) applyLabel = t('{n} ta ustani ko\'rsatish', { n: count });

  return (
    <Modal onClose={onClose} labelledBy="filter-sheet-title" className="!px-0 !pb-0 sm:!pb-0">
      <div className="px-6">
        <h2 id="filter-sheet-title" className="text-lg font-extrabold text-slate-900 pr-10">
          {t('Filtrlar')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-5">
          {selected > 0 ? t('{n} ta filtr tanlangan', { n: selected }) : t('Kerakli ustani tezroq topish uchun tanlang')}
        </p>
        <FilterFields value={draft} onChange={update} idPrefix="sheet" />
      </div>

      <div className="sticky bottom-0 mt-6 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 bg-white border-t border-slate-200 grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={() => setDraft(EMPTY_FILTERS)}
          disabled={selected === 0}
          className="btn btn-secondary px-4"
        >
          {t('Tozalash')}
        </button>
        <button
          type="button"
          onClick={() => onApply(draft)}
          disabled={count === 0}
          className="btn btn-primary font-bold"
          aria-live="polite"
        >
          {counting && count === null ? <Spinner className="w-4 h-4" /> : applyLabel}
        </button>
      </div>
    </Modal>
  );
}
