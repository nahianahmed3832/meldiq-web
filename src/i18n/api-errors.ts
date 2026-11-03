import { getPrefs } from "../application/prefs";
import { ENGLISH } from "./english";
import { resolveLanguage } from "./languages";
import { translate, type TranslationKey } from "./runtime";

/** Translate audited error codes, never response bodies or user-provided text. */
export function apiErrorMessage(code: string, status: number, original: string): string {
  const locale = resolveLanguage(getPrefs().language);
  if (locale === "en") return original;
  if (Object.hasOwn(ENGLISH.errors.api, code)) return translate(locale, `errors.api.${code}` as TranslationKey);
  if (status === 0) return translate(locale, "errors.network");
  if (status === 403) return translate(locale, "errors.forbidden");
  return translate(locale, "errors.generic");
}
