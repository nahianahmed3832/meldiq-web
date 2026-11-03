/** Supported interface locales. Chat translation has a separate, unchanged preference. */
export const LANGUAGES = [
  "en",
  "bn",
  "hi",
  "ur",
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
  "id",
  "vi",
  "th",
  "ar",
  "tr",
  "pt-BR",
  "es-419",
  "es-ES",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "ru",
  "uk",
  "ro",
  "sv",
  "cs",
  "el",
  "pt-PT",
] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguageChoice = "system" | Language;
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  bn: "বাংলা",
  hi: "हिन्दी",
  ur: "اردو",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  th: "ไทย",
  ar: "العربية",
  tr: "Türkçe",
  "pt-BR": "Português (Brasil)",
  "es-419": "Español (Latinoamérica)",
  "es-ES": "Español (España)",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  uk: "Українська",
  ro: "Română",
  sv: "Svenska",
  cs: "Čeština",
  el: "Ελληνικά",
  "pt-PT": "Português (Portugal)",
};
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGES.some((locale) => locale === value);
}
export function isLanguageChoice(value: unknown): value is LanguageChoice {
  return value === "system" || isLanguage(value);
}
/** BCP 47 matching preserves scripts and regional variants; bare Portuguese defaults to Portugal. */
export function matchLanguage(raw: string): Language | undefined {
  const tag = raw.trim().replace(/_/g, "-").toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(tag)) return undefined;
  const exact = LANGUAGES.find((locale) => locale.toLowerCase() === tag);
  if (exact) return exact;
  const parts = tag.split("-");
  const base = parts[0];
  if (base === "zh") {
    if (parts.includes("hant")) return "zh-TW";
    if (parts.includes("hans")) return "zh-CN";
    return parts.some((part) => ["tw", "hk", "mo"].includes(part)) ? "zh-TW" : "zh-CN";
  }
  if (base === "pt") return parts.includes("br") ? "pt-BR" : "pt-PT";
  if (base === "es") return parts.length === 1 || parts.slice(1).includes("es") ? "es-ES" : "es-419";
  return LANGUAGES.find((locale) => locale === base);
}
export function browserLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const matched = matchLanguage(tag);
    if (matched) return matched;
  }
  return "en";
}
export function resolveLanguage(choice: LanguageChoice, preferred: readonly string[] = typeof window !== "undefined" && typeof navigator !== "undefined" ? (navigator.languages ?? []) : []): Language {
  return choice === "system" ? browserLanguage(preferred) : isLanguage(choice) ? choice : "en";
}
export const directionOf = (locale: Language): "rtl" | "ltr" => (locale === "ar" || locale === "ur" ? "rtl" : "ltr");
/** Explicit account choice, then guest choice, then the browser; automatic detection never overwrites a choice. */
export function preferredLanguage(account: unknown, guest: unknown, browser: readonly string[]): LanguageChoice {
  if (isLanguageChoice(account)) return account;
  if (isLanguageChoice(guest)) return guest;
  return browserLanguage(browser);
}
