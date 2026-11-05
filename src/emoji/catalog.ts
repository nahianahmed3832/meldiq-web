import { useSyncExternalStore } from "react";
import { isReaction } from "./rules";

/**
 * The Unicode emoji catalogue, shared with Meldiq Android (meldiq docs/EMOJI.md): emoji.json is generated there by
 * tools/emoji/gen_emoji.py from Unicode's emoji-test.txt and CLDR's English annotations (Unicode License v3) and copied
 * here unchanged. Parsing, search and the reaction rule mirror android EmojiCatalog / EmojiRules.
 */
export interface EmojiItem {
  emoji: string;
  name: string;
  keywords: string;
  version: string;
  /** The five one-tone variants, light to dark, when the emoji has skin tones. */
  tones?: string[];
}

export interface EmojiGroup {
  id: string;
  name: string;
  items: EmojiItem[];
}

type Row = [string, string, string, string, string[]?];
interface CatalogFile {
  groups: { id: string; name: string; items: Row[] }[];
}

export const TONE_COUNT = 5;
export const SEARCH_LIMIT = 120;

export function parseCatalog(file: CatalogFile): EmojiGroup[] {
  return file.groups.map((g) => ({
    id: g.id,
    name: g.name,
    items: g.items.map(([emoji, name, keywords, version, tones]) => ({
      emoji,
      name,
      keywords,
      version,
      ...(tones?.length === TONE_COUNT ? { tones } : {}),
    })),
  }));
}

/** [item] in skin tone [tone] (0: none, 1–5: light to dark); itself when it has no tones. */
export function inTone(item: EmojiItem, tone: number): string {
  return (tone > 0 && item.tones?.[tone - 1]) || item.emoji;
}

let loading: Promise<EmojiGroup[]> | null = null;

/** The catalogue, fetched once as its own chunk (about 140 kB) the first time a picker opens. */
export function loadCatalog(): Promise<EmojiGroup[]> {
  loading ??= import("./emoji.json")
    .then((m) => parseCatalog(m.default as unknown as CatalogFile))
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

const WORD_BREAK = /[\s:,]+/;

/**
 * Emoji whose name or search words start with every word of [query] ("thumb up" finds 👍), best first: the name
 * starting with the query, then a word of the name, then a search word. Blank: nothing.
 */
export function searchEmoji(groups: EmojiGroup[], query: string, limit = SEARCH_LIMIT): EmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const ranked: { item: EmojiItem; rank: number; order: number }[] = [];
  let order = 0;
  for (const g of groups) {
    for (const item of g.items) {
      const nameWords = item.name.split(WORD_BREAK);
      const keyWords = item.keywords.split(" ");
      const inName = (t: string) => nameWords.some((w) => w.startsWith(t));
      if (!terms.every((t) => inName(t) || keyWords.some((w) => w.startsWith(t)))) {
        order++;
        continue;
      }
      const rank = item.name === q ? 0 : item.name.startsWith(q) ? 1 : terms.every(inName) ? 2 : 3;
      ranked.push({ item, rank, order: order++ });
    }
  }
  return ranked
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.item);
}

// ───────────────────────── recent emoji and skin tone (this browser only) ─────────────────────────

const RECENT_KEY = "meldiq.emoji.recent";
const TONE_KEY = "meldiq.emoji.tone";
const MAX_RECENT = 32;

interface EmojiPrefs {
  recent: string[];
  tone: number;
}

function readTone(): number {
  try {
    const tone = Number(localStorage.getItem(TONE_KEY) ?? 0);
    return Number.isInteger(tone) && tone >= 0 && tone <= TONE_COUNT ? tone : 0;
  } catch {
    return 0;
  }
}

// An old, browser-wide recent list has no owner and cannot be assigned to a saved account.
export function emojiPrefsScope(store: string, user: string): string {
  return `${RECENT_KEY}:${JSON.stringify([store, user])}`;
}
const profiles = new Map<string, EmojiPrefs>();
let deviceTone = readTone();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function snapshot(scope: string): EmojiPrefs {
  const cached = profiles.get(scope);
  if (cached) return cached;
  let recent: string[] = [];
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(scope) ?? "[]");
    if (Array.isArray(raw)) recent = raw.filter((e): e is string => typeof e === "string" && isReaction(e)).slice(0, MAX_RECENT);
  } catch {
    // Invalid or unavailable profile storage starts with an empty list.
  }
  const next = { recent, tone: deviceTone };
  profiles.set(scope, next);
  return next;
}

export function emojiUsed(scope: string, emoji: string) {
  if (!isReaction(emoji)) return;
  const prefs = snapshot(scope);
  const recent = [emoji, ...prefs.recent.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
  profiles.set(scope, { ...prefs, recent });
  try {
    localStorage.setItem(scope, JSON.stringify(recent));
  } catch {
    // Storage blocked: this profile's choice lasts for the current page.
  }
  listeners.forEach((l) => l());
}

export function setEmojiTone(tone: number) {
  deviceTone = Math.max(0, Math.min(TONE_COUNT, Math.round(tone)));
  for (const [scope, value] of profiles) profiles.set(scope, { ...value, tone: deviceTone });
  try {
    localStorage.setItem(TONE_KEY, String(deviceTone));
  } catch {
    // The device's tone can still be used on the current page.
  }
  listeners.forEach((l) => l());
}

export function useEmojiPrefs(scope: string): EmojiPrefs {
  return useSyncExternalStore(subscribe, () => snapshot(scope));
}
