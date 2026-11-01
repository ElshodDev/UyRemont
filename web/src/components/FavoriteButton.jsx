import React from 'react';
import { Heart } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import { t } from '../i18n';

/**
 * Yurakcha: ustani sevimlilarga qo'shish / olib tashlash
 * variant="icon" - dumaloq tugma, variant="full" - matnli tugma
 */
export default function FavoriteButton({ master, variant = 'icon', className = '' }) {
  const favorites = useFavorites();
  if (!favorites || !master?.id) return null;
  const active = favorites.isFavorite(master.id);
  const label = active ? t('Sevimlilardan olib tashlash') : t('Sevimlilarga qo\'shish');

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={() => favorites.toggle(master)}
        aria-pressed={active}
        aria-label={label}
        className={`btn btn-secondary ${active ? 'text-rose-600 border-rose-200' : ''} ${className}`}
      >
        <Heart className={`w-4 h-4 ${active ? 'fill-current text-rose-500' : ''}`} />
        {active ? t('Sevimlida') : t('Sevimlilarga')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        favorites.toggle(master);
      }}
      aria-pressed={active}
      aria-label={`${master.name || t('Usta')}: ${label.toLowerCase()}`}
      title={label}
      className={`w-10 h-10 rounded-full inline-flex items-center justify-center transition ${
        active ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'
      } ${className}`}
    >
      <Heart className={`w-5 h-5 ${active ? 'fill-current' : ''}`} />
    </button>
  );
}
