import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, tokenStorage } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { getLang, hasSavedLang } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import AuthModal from '../components/AuthModal';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStorage.get()));
  const [authOpen, setAuthOpen] = useState(false);
  const pendingAction = useRef(null);

  const refresh = useCallback(async () => {
    if (!tokenStorage.get()) {
      setUser(null);
      return null;
    }
    try {
      const { data } = await api('/auth/me');
      setUser(data);
      return data;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        tokenStorage.clear();
        setUser(null);
      }
      return null;
    }
  }, []);

  // Hisobda saqlangan til (boshqa qurilmada tanlangan) - bu qurilmada tanlanmagan bo'lsa qo'llanadi
  useEffect(() => {
    if (user?.language && !hasSavedLang() && user.language !== getLang()) setLang(user.language);
  }, [user?.language, setLang]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const onExpired = () => {
      setUser(null);
      disconnectSocket();
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [refresh]);

  const completeLogin = useCallback((token, profile) => {
    tokenStorage.set(token);
    disconnectSocket();
    setUser(profile);
    setAuthOpen(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) setTimeout(() => action(profile), 0);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  /**
   * Amalni faqat tizimga kirgan foydalanuvchi uchun bajarish.
   * Kirmagan bo'lsa avval kirish oynasi ochiladi, so'ng amal davom etadi.
   * askName: false - yangi foydalanuvchidan ism so'ralmaydi (masalan, usta bo'lishda ism-familiya keyingi qadamda so'raladi)
   */
  const requireAuth = useCallback((action, { askName = true } = {}) => {
    if (user) {
      action?.(user);
      return;
    }
    pendingAction.current = action || null;
    setAuthOpen({ askName });
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    setUser,
    refresh,
    logout,
    requireAuth,
    openAuth: () => setAuthOpen(true)
  }), [user, loading, refresh, logout, requireAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {authOpen && (
        <AuthModal
          onClose={() => {
            pendingAction.current = null;
            setAuthOpen(false);
          }}
          askName={authOpen.askName !== false}
          onSuccess={completeLogin}
        />
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
