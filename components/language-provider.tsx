"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LANGUAGE, DICTIONARIES, isSupportedLanguage, type Dictionary, type Language } from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "vunalink-language";

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: Dictionary };
const LanguageContext = createContext<LanguageContextValue | null>(null);

// Components in this tab that want to hear when the language changes.
const languageListeners = new Set<() => void>();

// In-memory copy, so switching still works for this visit if the browser blocks storage.
let fallbackLanguage: Language = DEFAULT_LANGUAGE;

// Holds the chosen language for the whole app and remembers it on the device.
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore reads the saved language from localStorage.
  // During server rendering and hydration it uses Kinyarwanda (getServerLanguage),
  // so the HTML matches, then switches to the saved choice right after.
  const language = useSyncExternalStore(subscribeToLanguage, readSavedLanguage, getServerLanguage);

  // Keep <html lang> correct so screen readers pronounce the text properly.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    saveLanguage(nextLanguage);
    languageListeners.forEach((notify) => notify());
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: DICTIONARIES[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Gives any client component the current language, a setter, and the word list `t`.
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

// Listen for language changes in this tab (setLanguage) and in other tabs ("storage" event).
// Returns a cleanup function, as useSyncExternalStore expects.
function subscribeToLanguage(onChange: () => void) {
  languageListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    languageListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The language used when there is no browser (server rendering) and during hydration.
function getServerLanguage(): Language {
  return DEFAULT_LANGUAGE;
}

// Read the saved language, falling back to Kinyarwanda.
// Wrapped in try/catch because storage can be blocked (e.g. private mode).
function readSavedLanguage(): Language {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(storedValue) ? storedValue : fallbackLanguage;
  } catch {
    return fallbackLanguage;
  }
}

// Save the language. If storage fails, the in-memory copy still applies until the app is closed.
function saveLanguage(language: Language) {
  fallbackLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore: not being able to save the preference should never break the app.
  }
}
