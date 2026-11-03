import { useCallback, useSyncExternalStore } from "react";
import { getPrefs, subscribePrefs } from "../application/prefs";
import { resolveLanguage, type Language } from "./languages";
import { catalogVersion, subscribeCatalog, translate, type MessageKey, type Variables } from "./runtime";
export { browserLanguage, LANGUAGE_NAMES, LANGUAGES, resolveLanguage, type Language, type LanguageChoice } from "./languages";
export { translate, prepareLocale, type MessageKey, type TranslationKey } from "./runtime";
export type { StringKey } from "./strings";
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
/** Existing components retain their subscriptions and state; changing language never remounts the application. */
export function useT(): Translate {
  const language = useLanguage();
  const version = useSyncExternalStore(subscribeCatalog, catalogVersion, () => 0);
  return useCallback(
    (key, vars) => {
      void version;
      return translate(language, key, vars);
    },
    [language, version],
  );
}
const languageSnapshot = () => resolveLanguage(getPrefs().language);
const serverLanguage = (): Language => "en";
export function useLanguage(): Language {
  return useSyncExternalStore(subscribePrefs, languageSnapshot, serverLanguage);
}
/** For formatters and event handlers. Components should use useT so catalog changes update them. */
export function text(key: MessageKey, variables?: Record<string, string | number | Date | null | undefined>): string {
  const values: Variables | undefined = variables && Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, value ?? String(value)]));
  return translate(resolveLanguage(getPrefs().language), key, values);
}
