import React from 'react';
import { addressIcon, addressLabel } from '../lib/useSavedAddresses';
import { t } from '../i18n';

/**
 * Saqlangan manzillar: bir bosishda tanlash
 */
export default function SavedAddressChips({ addresses, selectedId, onSelect, className = '' }) {
  if (!addresses.length) return null;
  return (
    <div className={`flex gap-2 overflow-x-auto no-scrollbar ${className}`} role="group" aria-label={t('Saqlangan manzillar')}>
      {addresses.map((address) => {
        const active = selectedId === address.id;
        return (
          <button
            key={address.id}
            type="button"
            onClick={() => onSelect(address)}
            aria-pressed={active}
            title={address.address}
            className={`chip border max-w-[14rem] ${active ? 'chip-active border-blue-600' : 'bg-white border-slate-200'}`}
          >
            <span aria-hidden="true">{addressIcon(address.label)}</span>
            <span className="truncate">{addressLabel(address.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
