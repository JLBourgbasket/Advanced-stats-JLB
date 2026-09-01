"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Language = "fr" | "en";

type I18nValue = {
  language: Language;
  locale: "fr-FR" | "en-US";
  setLanguage: (language: Language) => void;
  tr: (fr: string, en: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    const stored = window.localStorage.getItem("jl-performance-language");
    if (stored === "fr" || stored === "en") {
      const timer = window.setTimeout(() => setLanguageState(stored), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("jl-performance-language", language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);
  const tr = useCallback((fr: string, en: string) => language === "fr" ? fr : en, [language]);
  const value = useMemo<I18nValue>(() => ({
    language,
    locale: language === "fr" ? "fr-FR" : "en-US",
    setLanguage,
    tr,
  }), [language, setLanguage, tr]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();
  return (
    <div className="inline-flex h-9 border border-stone-700" role="group" aria-label="Language / Langue">
      {(["fr", "en"] as const).map((item) => <button key={item} type="button" onClick={() => setLanguage(item)} aria-pressed={language === item} className={`px-2.5 text-[11px] font-black uppercase tracking-[0.08em] ${language === item ? "bg-white text-stone-950" : "text-stone-400 hover:text-white"}`}>{item}</button>)}
    </div>
  );
}
