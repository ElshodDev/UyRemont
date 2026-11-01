import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import Avatar from './Avatar';
import { specializationLabel } from './MasterCard';
import { api } from '../lib/api';
import { formatRating } from '../lib/format';
import { useFavorites } from '../context/FavoritesContext';

/**
 * Bosh sahifa: sevimli ustalar qatori (bir bosishda qayta buyurtma)
 */
export default function FavoritesStrip({ onView, onOrder }) {
  const favorites = useFavorites();
  const [masters, setMasters] = useState([]);

  // Server tasdiqlagandan keyin qayta yuklanadi (yurakcha bosilishi bilan emas)
  useEffect(() => {
    if (!favorites?.count) {
      setMasters([]);
      return;
    }
    api('/favorites').then(({ data }) => setMasters(data)).catch(() => {});
  }, [favorites?.version]);

  const visible = masters.filter((m) => favorites.isFavorite(m.id));
  if (!visible.length) return null;

  return (
    <section className="mb-8" aria-labelledby="favorites-strip-title">
      <div className="flex items-center justify-between mb-3">
        <h2 id="favorites-strip-title" className="font-bold text-slate-900 flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500 fill-current" /> Sevimli ustalaringiz
        </h2>
        <Link to="/favorites" className="link text-xs min-h-9 inline-flex items-center">Barchasi</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        {visible.map((m) => (
          <div key={m.id} className="card p-3 w-64 flex-shrink-0 flex flex-col gap-3">
            <button type="button" onClick={() => onView(m)} className="flex items-center gap-3 text-left min-w-0">
              <Avatar src={m.avatar_url} name={m.name} className="w-12 h-12 rounded-xl text-lg flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 truncate">{m.name}</span>
                <span className="block text-xs text-blue-600 truncate">{specializationLabel(m)}</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                  <Star className="w-3 h-3 fill-current" /> {formatRating(m.rating)}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => onOrder(m)} className="btn btn-sm btn-primary w-full min-h-10">
              Buyurtma berish
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
