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
          <Link to="/" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            Bosh sahifaga qaytish
          </Link>
        )}
      />
    </main>
  );
}
