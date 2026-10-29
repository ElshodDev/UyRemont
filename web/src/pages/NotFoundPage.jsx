import React from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';

export default function NotFoundPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-16 w-full flex-1">
      <EmptyState
        icon="🧭"
        title="Sahifa topilmadi"
        description="Siz qidirgan sahifa mavjud emas yoki ko'chirilgan."
        action={(
          <Link to="/" className="btn btn-primary px-4">
            Bosh sahifaga qaytish
          </Link>
        )}
      />
    </main>
  );
}
