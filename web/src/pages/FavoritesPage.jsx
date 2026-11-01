import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import MasterCard, { MasterCardSkeleton } from '../components/MasterCard';
import MasterProfileModal from '../components/MasterProfileModal';
import EmptyState, { ErrorState } from '../components/EmptyState';
import { useOrderModal } from '../components/useOrderModal';
import { useFavorites } from '../context/FavoritesContext';
import { api } from '../lib/api';
import { t } from '../i18n';

/**
 * Sevimli ustalar: tez qayta buyurtma berish
 */
export default function FavoritesPage() {
  const favorites = useFavorites();
  const [masters, setMasters] = useState(null);
  const [error, setError] = useState('');
  const [profileId, setProfileId] = useState(null);
  const order = useOrderModal();

  const load = () => {
    setError('');
    api('/favorites').then(({ data }) => setMasters(data)).catch((err) => setError(err.message));
  };

  useEffect(load, []);

  // Yurakcha bosilib olib tashlansa ro'yxatdan ham yo'qoladi
  const visible = masters?.filter((m) => favorites.isFavorite(m.id));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-500"><Heart className="w-6 h-6 fill-current" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('Sevimli ustalar')}</h1>
          <p className="text-xs text-slate-500">{t('Tezkor chaqiruvda yaqin atrofda bo\'lsa, taklif birinchi ularga boradi')}</p>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!masters && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => <MasterCardSkeleton key={i} />)}
        </div>
      )}
      {visible && visible.length === 0 && (
        <EmptyState
          icon="🤍"
          title={t('Hali sevimli usta yo\'q')}
          description={t('Yoqqan ustaning kartochkasidagi yurakchani bosing — keyingi safar uni bir bosishda topasiz.')}
          action={<Link to="/" className="btn btn-primary">{t('Ustalarni ko\'rish')}</Link>}
        />
      )}
      {visible && visible.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {visible.map((m) => (
            <MasterCard key={m.id} master={m} onView={() => setProfileId(m.id)} onOrder={(master) => order.open(master)} />
          ))}
        </div>
      )}

      {profileId && (
        <MasterProfileModal
          masterId={profileId}
          onClose={() => setProfileId(null)}
          onOrder={(master) => {
            setProfileId(null);
            order.open(master);
          }}
        />
      )}
      {order.element}
    </main>
  );
}
