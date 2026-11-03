import { createTranslator } from "next-intl";
import legacyKeys from "./legacy-keys.json";
import { ENGLISH } from "./english";
import { isLanguage, type Language } from "./languages";
import { NAMESPACES, type Namespace } from "./namespaces";
import type { StringKey } from "./strings";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : T[K] extends object ? `${K}.${Paths<T[K]>}` : never }[keyof T & string];
export type TranslationKey = Paths<typeof ENGLISH>;
export type MessageKey = StringKey | TranslationKey;
export type Variables = Record<string, string | number | Date>;
export type Dictionary = { [key: string]: string | Dictionary };
const dictionaries = new Map<string, Dictionary>();
const loading = new Map<string, Promise<void>>();
const used = new Set<Namespace>(["common", "auth", "onboarding"]);
const listeners = new Set<() => void>();
const translators = new Map<string, ReturnType<typeof createTranslator>>();
const missing = new Set<string>();
const warned = new Set<string>();
const numberFormats = new Map<string, Intl.NumberFormat>();
let version = 0;

export const catalogVersion = () => version;
export const subscribeCatalog = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const usedNamespaces = () => [...used];
const publish = () => {
  version++;
  translators.clear();
  for (const listener of listeners) listener();
};

export function canonicalKey(key: MessageKey | string): string {
  return (legacyKeys as Record<string, string>)[key] ?? key;
}

function lookup(dictionary: Dictionary | undefined, path: string): string | undefined {
  let value: string | Dictionary | undefined = dictionary;
  for (const part of path.split(".")) value = typeof value === "object" ? value[part] : undefined;
  return typeof value === "string" ? value : undefined;
}

function merge(base: Dictionary, translated: Dictionary): Dictionary {
  const result = { ...base };
  for (const [key, value] of Object.entries(translated)) result[key] = typeof value === "object" && typeof base[key] === "object" ? merge(base[key], value) : value;
  return result;
}

/** Only same-origin, build-produced JSON chunks; no translation service, API or model. Failures remain retryable. */
export function loadNamespace(language: Language, namespace: Namespace): Promise<void> {
  used.add(namespace);
  if (!isLanguage(language) || !NAMESPACES.includes(namespace)) return Promise.reject(new Error("Unsupported locale or namespace"));
  const id = `${language}/${namespace}`;
  if (language === "en" || dictionaries.has(id)) return Promise.resolve();
  const existing = loading.get(id);
  if (existing) return existing;
  const request = import(`../../locales/${language}/${namespace}.json`)
    .then((module: { default: Dictionary }) => {
      dictionaries.set(id, module.default);
      publish();
    })
    .finally(() => {
      loading.delete(id);
    });
  loading.set(id, request);
  return request;
}

export async function prepareLocale(language: Language, namespaces: readonly Namespace[] = usedNamespaces()): Promise<void> {
  await Promise.all(namespaces.map((namespace) => loadNamespace(language, namespace)));
}

/** Diagnostics contain keys only, never interpolation values, user names, messages or account identifiers. */
export const missingTranslations = () => [...missing].sort();
function reportMissing(language: Language, namespace: string, key: string): void {
  missing.add(`${language}/${namespace}/${key}`);
  const group = `${language}/${namespace}`;
  if (process.env.NODE_ENV !== "production" && !warned.has(group)) {
    warned.add(group);
    // eslint-disable-next-line no-console -- Required development diagnostics contain keys only, never user data.
    console.warn(`[i18n] Missing translations in ${group}; using English. Run npm run i18n:check for the complete report.`);
  }
}

export function messagesFor(language: Language): Record<Namespace, Dictionary> {
  return Object.fromEntries(NAMESPACES.map((namespace) => [namespace, merge(ENGLISH[namespace], dictionaries.get(`${language}/${namespace}`) ?? {})])) as Record<Namespace, Dictionary>;
}

/** ICU interpolation, plural/select grammar and locale-aware numbers, with an explicit English fallback. */
function resolveMessage(language: Language, key: MessageKey) {
  const canonical = canonicalKey(key);
  const dot = canonical.indexOf(".");
  const namespace = canonical.slice(0, dot) as Namespace;
  const path = canonical.slice(dot + 1);
  if (!NAMESPACES.includes(namespace)) {
    reportMissing(language, "unknown", canonical);
    return { fallback: canonical };
  }
  used.add(namespace);
  const english = lookup(ENGLISH[namespace], path);
  const dictionary = dictionaries.get(`${language}/${namespace}`);
  const translated = language === "en" ? english : lookup(dictionary, path);
  if (language !== "en" && !dictionary) void loadNamespace(language, namespace).catch(() => reportMissing(language, namespace, path));
  else if (!translated) reportMissing(language, namespace, path);
  const raw = translated ?? english;
  if (raw === undefined) {
    reportMissing(language, namespace, path);
    return { fallback: canonical };
  }
  const id = `${language}/${namespace}`;
  let translator = translators.get(id);
  if (!translator) {
    translator = createTranslator({
      locale: language,
      messages: merge(ENGLISH[namespace], dictionary ?? {}),
      onError: () => reportMissing(language, namespace, "invalid-message"),
      getMessageFallback: ({ key: failed }) => lookup(ENGLISH[namespace], failed) ?? failed,
    });
    translators.set(id, translator);
  }
  return { translator, path, raw };
}

export function translate(language: Language, key: MessageKey, variables?: Variables): string {
  const message = resolveMessage(language, key);
  if (!message.translator) return message.fallback ?? String(key);
  const { translator, path, raw } = message;
  // Retain the old adapter's useful partial-interpolation behavior. ICU plural/select variables still require values.
  const values: Variables = { ...variables };
  for (const match of raw.matchAll(/\{(\w+)\}/g)) {
    if (!(match[1] in values)) values[match[1]] = match[0];
    else if (typeof values[match[1]] === "number" && !new RegExp(`\\{${match[1]}\\s*,`).test(raw)) {
      let formatter = numberFormats.get(language);
      if (!formatter) {
        formatter = new Intl.NumberFormat(language);
        numberFormats.set(language, formatter);
      }
      values[match[1]] = formatter.format(values[match[1]] as number);
    }
  }
  return translator(path, values);
}

/** React slots retain links, formatting and user data while translators can reorder a complete sentence. */
export function translateRich(language: Language, key: MessageKey, slots: readonly ReactNode[]): ReactNode {
  const message = resolveMessage(language, key);
  if (!message.translator) return message.fallback ?? String(key);
  return message.translator.rich(
    message.path,
    Object.fromEntries(
      slots.map((slot, index) => [
        `slot${index}`,
        (chunks: ReactNode) => (Children.count(chunks) ? (isValidElement<{ children?: ReactNode }>(slot) ? cloneElement(slot, undefined, chunks) : chunks) : slot),
      ]),
    ),
  );
}
