import React, { useCallback, useState } from 'react';
import OrderModal from './OrderModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { t } from '../i18n';

/**
 * Buyurtma oynasini ochish: kirmagan bo'lsa avval kirish, faqat mijoz hisobidan
 * @returns {{ open: (master: object|null, initial?: object) => void, element: JSX.Element|null }}
 */
export function useOrderModal({ specializations = [] } = {}) {
  const { requireAuth } = useAuth();
  const toast = useToast();
  const [target, setTarget] = useState(null);

  const open = useCallback((master, initial) => {
    requireAuth((current) => {
      if (current.role !== 'client') {
        toast.error(current.role === 'master'
          ? t('Buyurtma berish uchun profilingizda mijoz rejimiga o\'ting')
          : t('Administrator hisobidan buyurtma berib bo\'lmaydi'));
        return;
      }
      setTarget({ master, initial });
    });
  }, [requireAuth, toast]);

  const element = target ? (
    <OrderModal
      master={target.master}
      specializations={specializations}
      initial={target.initial}
      onClose={() => setTarget(null)}
    />
  ) : null;

  return { open, element };
}
