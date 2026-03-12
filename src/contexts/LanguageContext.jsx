import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import enLocale from "../locales/en.json";
import arLocale from "../locales/ar.json";

const staticLocales = { en: enLocale, ar: arLocale };

const LanguageContext = createContext(null);

const STORAGE_KEY = "yammak_lang";

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    let lang = "en";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") lang = stored;
    } catch {}
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = lang;
    }
    return lang;
  });

  const [serverTranslations, setServerTranslations] = useState({ en: {}, ar: {} });

  const setLanguage = useCallback((lang) => {
    if (lang !== "en" && lang !== "ar") return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      if (typeof document !== "undefined" && document.documentElement) {
        document.documentElement.lang = lang;
      }
    } catch {}
  }, []);

  const t = useCallback(
    (key) => {
      const server = serverTranslations[language] || {};
      const static_ = staticLocales[language] || staticLocales.en;
      return server[key] ?? static_[key] ?? staticLocales.en[key] ?? key;
    },
    [language, serverTranslations]
  );

  const setServerTranslationsFromSettings = useCallback((settings) => {
    const trans = settings?.translations;
    if (!trans || typeof trans !== "object") return;
    setServerTranslations({
      en: trans.en && typeof trans.en === "object" ? trans.en : {},
      ar: trans.ar && typeof trans.ar === "object" ? trans.ar : {},
    });
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      setServerTranslationsFromSettings,
      staticLocales,
      serverTranslations,
    }),
    [language, setLanguage, t, setServerTranslationsFromSettings, serverTranslations]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: "en",
      setLanguage: () => {},
      t: (k) => k,
      setServerTranslationsFromSettings: () => {},
      staticLocales,
      serverTranslations: { en: {}, ar: {} },
    };
  }
  return ctx;
}
