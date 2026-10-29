import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './Spinner';
import EmptyState from './EmptyState';

/**
 * Sahifani faqat tizimga kirgan (va kerak bo'lsa ma'lum roldagi) foydalanuvchiga ko'rsatadi
 */
export default function RequireAuth({ roles, children }) {
  const { user, loading, requireAuth } = useAuth();

  useEffect(() => {
    if (!loading && !user) requireAuth();
  }, [loading, user, requireAuth]);

  if (loading) return <PageLoader />;

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 w-full">
        <EmptyState
          icon="🔐"
          title="Tizimga kiring"
          description="Bu sahifani ko'rish uchun telefon raqamingiz orqali tizimga kiring."
          action={(
            <button
              onClick={() => requireAuth()}
              className="btn btn-primary px-4"
            >
              Kirish
            </button>
          )}
        />
      </div>
    );
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 w-full">
        <EmptyState icon="⛔" title="Ruxsat yo'q" description="Bu sahifa sizning hisobingiz uchun mavjud emas." />
      </div>
    );
  }

  return children;
}
