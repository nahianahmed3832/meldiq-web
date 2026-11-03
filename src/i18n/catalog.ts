import { ENGLISH } from "./english";
import { text } from "./index";
import type { TranslationKey } from "./runtime";
import type { CatalogBot } from "../sync/officialBots";

/** Only audited built-in metadata is localized. New server copy and all user-created names remain intact. */
export function catalogText(key: string, original: string): string {
  let source: unknown = ENGLISH;
  for (const part of key.split(".")) source = source && typeof source === "object" ? (source as Record<string, unknown>)[part] : undefined;
  if (typeof source !== "string" || source.replaceAll("''", "'").replace(/'([{}])'/g, "$1") !== original) return original;
  return text(key as TranslationKey);
}

export function permissionLabel(key: string, original: string): string {
  return catalogText(`organization.builtIn.permissionCatalog.${key.replaceAll(".", "_")}.label`, original);
}
const permissions = new WeakMap<object, object>();
export function localizePermission<T extends { key: string; label: string; description?: string | null }>(entry: T): T {
  const cached = permissions.get(entry);
  if (cached) return cached as T;
  const result = {
    ...entry,
    get label() {
      return permissionLabel(entry.key, entry.label);
    },
    get description() {
      return typeof entry.description === "string" ? catalogText(`organization.builtIn.permissionCatalog.${entry.key.replaceAll(".", "_")}.description`, entry.description) : entry.description;
    },
  } as T;
  permissions.set(entry, result);
  permissions.set(result, result);
  return result;
}

const bots = new WeakMap<CatalogBot, CatalogBot>();
/** Stable identity keeps an open bot editor's draft intact during a language change. */
export function localizeOfficialBot(entry: CatalogBot): CatalogBot {
  const cached = bots.get(entry);
  if (cached) return cached;
  const at = (field: string, original: string) => catalogText(`organization.builtIn.officialBots.${entry.key}.${field}`, original);
  const result: CatalogBot = {
    ...entry,
    get tagline() {
      return at("tagline", entry.tagline);
    },
    get description() {
      return at("description", entry.description);
    },
    get features() {
      return entry.features.map((value, index) => at(`feature_${index}`, value));
    },
    get commands() {
      return entry.commands.map((value, index) => ({ ...value, description: at(`command_${index}`, value.description) }));
    },
    get limits() {
      return entry.limits.map((value, index) => ({ what: at(`limit_${index}_what`, value.what), free: at(`limit_${index}_free`, value.free), plus: at(`limit_${index}_plus`, value.plus) }));
    },
  };
  bots.set(entry, result);
  bots.set(result, result);
  return result;
}
