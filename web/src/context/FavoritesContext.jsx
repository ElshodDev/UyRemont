import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { t } from '../i18n';

const FavoritesContext = createContext(null);

/**
 * Sevimli ustalar: ID lar ro'yxati (yurakcha belgisi uchun) va qo'shish/olib tashlash
 */
export function FavoritesProvider({ children }) {
  const { user, requireAuth } = useAuth();
  const toast = useToast();
  const [ids, setIds] = useState(() => new Set());
  // Server tasdiqlagan o'zgarishlar hisobi: ro'yxatni qayta yuklash uchun (optimistik yangilanishdan keyin emas)
  const [version, setVersion] = useState(0);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    api('/favorites/ids')
      .then(({ data }) => {
        setIds(new Set(data));
        setVersion((v) => v + 1);
      })
      .catch(() => {});
  }, [user?.id]);

  const toggle = useCallback((master) => {
    requireAuth(async (current) => {
      if (current.id === master.id) {
        toast.error(t('O\'zingizni sevimlilarga qo\'sha olmaysiz'));
        return;
      }
      const wasFavorite = idsRef.current.has(master.id);
      const apply = (add) => setIds((prev) => {
        const next = new Set(prev);
        if (add) next.add(master.id);
        else next.delete(master.id);
        return next;
      });
      apply(!wasFavorite);
      try {
        await api(`/favorites/${master.id}`, { method: wasFavorite ? 'DELETE' : 'POST' });
        setVersion((v) => v + 1);
        toast.success(wasFavorite
          ? t('Sevimlilardan olib tashlandi')
          : t('{name} sevimlilarga qo\'shildi', { name: master.name || t('Usta') }));
      } catch (error) {
        apply(wasFavorite);
        toast.error(error.message);
      }
    });
  }, [requireAuth, toast]);

  const value = useMemo(() => ({
    ids,
    count: ids.size,
    version,
    isFavorite: (id) => ids.has(id),
    toggle
  }), [ids, version, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);
