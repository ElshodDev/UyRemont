import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * "Usta chaqirish" tugmasi: kirmagan bo'lsa avval kirish, faqat mijoz hisobidan /call sahifasiga
 * @returns {(params?: Record<string, string>) => void}
 */
export function useCallMaster() {
  const { requireAuth } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  return useCallback((params) => {
    requireAuth((current) => {
      if (current.role !== 'client') {
        toast.error(current.role === 'master'
          ? 'Usta chaqirish uchun profilingizda mijoz rejimiga o\'ting'
          : 'Administrator hisobidan usta chaqirib bo\'lmaydi');
        return;
      }
      const query = params ? new URLSearchParams(params).toString() : '';
      navigate(query ? `/call?${query}` : '/call');
    });
  }, [requireAuth, toast, navigate]);
}
