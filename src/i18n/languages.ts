/**
 * Interface languages (2026-10-23), the same three as Meldiq Android (meldiq_android docs/LANGUAGES.md): English,
 * Simplified Chinese and Bengali. The person picks one on the sign-in screens or in Settings › Appearance, or follows the
 * browser. Screens not translated yet stay in English; the Chinese and Bengali text should be reviewed by native
 * speakers.
 */
export const LANGUAGES = ["en", "zh-CN", "bn"] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguageChoice = "system" | Language;

/** Each language in its own words, as pickers show them. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", "zh-CN": "简体中文", bn: "বাংলা" };

/** The browser's preferred languages mapped to one Meldiq has (any Chinese → Simplified, any Bengali → Bengali). */
export function browserLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "zh") return "zh-CN";
    if (base === "bn") return "bn";
    if (base === "en") return "en";
  }
  return "en";
}

export function resolveLanguage(choice: LanguageChoice, preferred: readonly string[] = typeof navigator !== "undefined" ? navigator.languages : []): Language {
  return choice === "system" ? browserLanguage(preferred) : choice;
}
