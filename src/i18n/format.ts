import { getPrefs } from "../application/prefs";
import { resolveLanguage } from "./languages";

/** Follow the interface locale, retaining an English browser's regional conventions. Never change its time zone. */
export function interfaceLocale(): string {
  const locale = resolveLanguage(getPrefs().language);
  if (locale === "en" && typeof navigator !== "undefined") return (navigator.languages ?? []).find((tag) => /^en(?:-|$)/i.test(tag)) ?? "en";
  return locale;
}
const numbers = new Map<string, Intl.NumberFormat>();
export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}, locale = interfaceLocale()): string {
  const key = `${locale}/${JSON.stringify(options)}`;
  let formatter = numbers.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numbers.set(key, formatter);
  }
  return formatter.format(value);
}
/** React numeric text only. Empty optional values retain their rendering semantics. */
export function formatUiNumber(value: number | null | undefined | false): string | null | undefined | false {
  return typeof value === "number" ? formatNumber(value) : value;
}
/** CLDR supplies the correct unit and plural grammar for every supported language. */
export function formatUnit(value: number, unit: "second" | "minute" | "hour" | "day" | "week" | "month" | "year"): string {
  return formatNumber(value, { style: "unit", unit, unitDisplay: "long" });
}
export function formatDate(value: number | Date, options: Intl.DateTimeFormatOptions = {}, locale = interfaceLocale()): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}
/** Major currency units in, display text out. Quotes, prices and payment calculations never depend on locale. */
export function formatCurrency(amount: number, currency: string, locale = interfaceLocale()): string {
  return formatNumber(amount, { style: "currency", currency }, locale);
}
export function formatFileSize(value: number, base: 1000 | 1024 = 1024, locale = interfaceLocale()): string {
  const bytes = Math.max(0, Number.isFinite(value) ? value : 0);
  const index = Math.min(3, bytes < base ? 0 : Math.floor(Math.log(bytes) / Math.log(base)));
  const amount = bytes / base ** index;
  const digits = index === 0 || (index === 1 && amount >= 10) ? 0 : 1;
  return `${formatNumber(amount, { minimumFractionDigits: digits, maximumFractionDigits: digits }, locale)} ${["B", "KB", "MB", "GB"][index]}`;
}
/** Call/media elapsed time, without changing the stored millisecond duration. */
export function formatDuration(milliseconds: number, locale = interfaceLocale()): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const numeric = (value: number, width: number) => formatNumber(value, { useGrouping: false, minimumIntegerDigits: width }, locale);
  return hours ? `${numeric(hours, 1)}:${numeric(minutes, 2)}:${numeric(seconds, 2)}` : `${numeric(minutes, 1)}:${numeric(seconds, 2)}`;
}
export function formatRelative(value: number, unit: Intl.RelativeTimeFormatUnit, locale = interfaceLocale()): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}

/** Compact elapsed units, with native units and number shaping outside the established English display. */
export function formatMeasure(value: number, unit: "second" | "minute" | "hour" | "day", locale = interfaceLocale()): string {
  if (/^en(?:-|$)/i.test(locale)) return `${formatNumber(value, {}, locale)} ${{ second: "s", minute: "min", hour: "h", day: value === 1 ? "day" : "days" }[unit]}`;
  return formatNumber(value, { style: "unit", unit, unitDisplay: "short" }, locale);
}
