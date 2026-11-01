import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

/**
 * Foydalanuvchining saqlangan manzillari ("Uy", "Ish")
 */
export function useSavedAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      return;
    }
    try {
      const { data } = await api('/addresses');
      setAddresses(data);
    } catch {
      // manzillar yuklanmasa ham asosiy jarayon davom etadi
    } finally {
      setLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = async (body) => {
    const { data } = await api('/addresses', { method: 'POST', body });
    setAddresses((list) => [...list, data]);
    return data;
  };

  const update = async (id, body) => {
    const { data } = await api(`/addresses/${id}`, { method: 'PUT', body });
    setAddresses((list) => list.map((a) => (a.id === id ? data : a)));
    return data;
  };

  const remove = async (id) => {
    await api(`/addresses/${id}`, { method: 'DELETE' });
    setAddresses((list) => list.filter((a) => a.id !== id));
  };

  return { addresses, loaded, reload, create, update, remove };
}

// Nomga mos belgi
export const addressIcon = (label) => {
  const value = String(label || '').toLowerCase();
  if (/^uy|uyim|home|^дом/.test(value)) return '🏠';
  if (/ish|ofis|work|работ|офис/.test(value)) return '💼';
  if (/ona|ota|dacha|hovli|дач|родител/.test(value)) return '🏡';
  return '📍';
};

// Tayyor nomlar bazada o'zbekcha saqlanadi, ko'rsatishda tarjima qilinadi (addressLabel)
export const ADDRESS_LABELS = ['Uy', 'Ish', 'Ota-onamnikiga'];
// Nom kiritilmasa saqlanadigan nom
export const DEFAULT_ADDRESS_LABEL = 'Manzil';

/**
 * Manzil nomi joriy tilda: tayyor nomlar tarjima qilinadi, foydalanuvchi yozgan nom o'zgarmaydi
 */
export const addressLabel = (label) => (
  ADDRESS_LABELS.includes(label) || label === DEFAULT_ADDRESS_LABEL ? t(label) : label
);
