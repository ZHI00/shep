import { create } from "zustand";
import {
  loadLanguage,
  persistLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "../lib/i18n";

interface LanguageStore {
  language: Language;
  setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: loadLanguage(),
  setLanguage: (language) => {
    persistLanguage(language);
    set({ language });
  },
}));

/**
 * Returns a translate function bound to the active language. Subscribing to
 * the language alone keeps re-renders limited to a real language change.
 */
export function useT() {
  const language = useLanguageStore((s) => s.language);
  return (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(key, language, vars);
}
