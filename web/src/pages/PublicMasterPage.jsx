import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MasterProfileView } from '../components/MasterProfileModal';
import { PageLoader } from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import { useOrderModal } from '../components/useOrderModal';
import { api } from '../lib/api';
import { t } from '../i18n';

/**
 * Ustaning ommaviy sahifasi: usta24.uz/u/<slug> (usta havolani Telegram'da ulashadi)
 */
export default function PublicMasterPage() {
  const { slug } = useParams();
  const [master, setMaster] = useState(null);
  const [error, setError] = useState('');
  const order = useOrderModal();

  useEffect(() => {
    setMaster(null);
    setError('');
    api(`/masters/u/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        setMaster(data);
        document.title = `${data.name} — Usta24`;
      })
      .catch((err) => setError(err.status === 404 ? 'not_found' : err.message));
    return () => {
      document.title = t('Usta24 — Usta topish endi oson!');
    };
  }, [slug]);

  if (error === 'not_found') {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1">
        <EmptyState
          icon="🔎"
          title={t('Usta topilmadi')}
          description={t('Havola noto\'g\'ri yoki usta profili o\'chirilgan.')}
          action={<Link to="/" className="btn btn-primary">{t('Boshqa ustalarni ko\'rish')}</Link>}
        />
      </main>
    );
  }
  if (error) return <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1 text-center text-sm text-red-600">{error}</main>;
  if (!master) return <PageLoader />;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full flex-1">
      <Link to="/" className="inline-flex items-center gap-1 min-h-11 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-2">
        <ArrowLeft className="w-4 h-4" /> {t('Barcha ustalar')}
      </Link>
      <article className="card p-5 sm:p-7">
        <MasterProfileView master={master} onOrder={(m) => order.open(m)} titleId="public-master-title" />
      </article>
      {order.element}
    </main>
  );
}
