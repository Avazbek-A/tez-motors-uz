"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./get-dictionary";

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
  initialDictionary,
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialDictionary: Dictionary;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dictionary, setDictionary] = useState<Dictionary>(initialDictionary);

  const setLocale = useCallback(async (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    const dict = await import(`./dictionaries/${newLocale}.json`);
    setDictionary(dict.default);
    setLocaleState(newLocale);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, dictionary, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
