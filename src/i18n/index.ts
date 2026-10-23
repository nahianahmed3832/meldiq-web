import { usePrefs } from "../application/prefs";
import type { Language } from "./languages";
import { resolveLanguage } from "./languages";
import { STRINGS, type StringKey } from "./strings";

export { browserLanguage, LANGUAGE_NAMES, LANGUAGES, resolveLanguage, type Language, type LanguageChoice } from "./languages";

const INDEX: Record<Language, 0 | 1 | 2> = { en: 0, "zh-CN": 1, bn: 2 };

/** The text for [key] in [lang], with {name} placeholders filled from [vars]. */
export function translate(lang: Language, key: StringKey, vars?: Record<string, string | number>): string {
  const text = STRINGS[key][INDEX[lang]];
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}

export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

/** The current language's text lookup; components re-render when the language changes. */
export function useT(): Translate {
  const lang = useLanguage();
  return (key, vars) => translate(lang, key, vars);
}

export function useLanguage(): Language {
  return resolveLanguage(usePrefs().language);
}

export type { StringKey };
