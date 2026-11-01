import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyLang, getLang } from './index';

const LanguageContext = createContext({ lang: 'uz', setLang: () => {} });

/**
 * Til holati. Til almashganda butun ilova qayta chiziladi (key), shuning uchun
 * t() ni istalgan joyda (komponent, lib funksiyalari) to'g'ridan-to'g'ri chaqirish mumkin.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next, options) => {
    if (next === getLang()) return;
    applyLang(next, options);
    setLangState(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <LanguageContext.Provider value={value}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
