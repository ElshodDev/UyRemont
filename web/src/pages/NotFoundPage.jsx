import React from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { t } from '../i18n';

export default function NotFoundPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1">
      <EmptyState
        icon="🧭"
        title={t('Sahifa topilmadi')}
        description={t('Siz qidirgan sahifa mavjud emas yoki ko\'chirilgan.')}
        action={(
          <Link to="/" className="btn btn-primary px-4">
            {t('Bosh sahifaga qaytish')}
          </Link>
        )}
      />
    </main>
  );
}
