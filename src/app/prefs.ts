import { useSyncExternalStore } from "react";

/**
 * Per-browser preferences. They hold no account data, so they live in localStorage, and every read and write tolerates
 * storage being unavailable (private windows, blocked site data): the defaults apply then.
 */
export const THEMES = ["system", "light", "dark"] as const;
/** The brand colour plates (src/styles/tokens.css › Palettes). */
export const PALETTES = ["indigo", "plum", "amber"] as const;
export type Palette = (typeof PALETTES)[number];
/** Message text size (android Settings › Chats): conversation text only, the rest of the interface stays as it is. */
export const TEXT_SIZES = ["small", "default", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export interface Prefs {
  theme: (typeof THEMES)[number];
  palette: Palette;
  textSize: TextSize;
  /** Animated emoji play (android Settings › Chats › Animated emoji); off: shown still. */
  animatedEmoji: boolean;
  /** Music and video links show as cards that open the provider (android Settings › Chats); nothing is fetched. */
  mediaCards: boolean;
  notifications: boolean;
  /** Show the sender and message text in system notifications (off: "New message"). */
  notificationText: boolean;
  readReceipts: boolean;
  typing: boolean;
  enterToSend: boolean;
  /** The selected workspace; null: none chosen yet. */
  orgId: string | null;
  /** Collapsed sidebar sections. */
  collapsed: string[];
  /** Home's Get started card was hidden in this browser. */
  startHidden: boolean;
}

const KEY = "orbit.prefs.v1";
const defaults: Prefs = {
  theme: "system",
  palette: "indigo",
  textSize: "default",
  animatedEmoji: true,
  mediaCards: true,
  notifications: false,
  notificationText: true,
  readReceipts: true,
  typing: true,
  enterToSend: true,
  orgId: null,
  collapsed: [],
  startHidden: false,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const stored = { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) };
    // Anything unknown (an older or tampered value) falls back to the default rather than reaching the page's attributes.
    return {
      ...stored,
      theme: THEMES.includes(stored.theme) ? stored.theme : defaults.theme,
      palette: PALETTES.includes(stored.palette) ? stored.palette : defaults.palette,
      textSize: TEXT_SIZES.includes(stored.textSize) ? stored.textSize : defaults.textSize,
      animatedEmoji: typeof stored.animatedEmoji === "boolean" ? stored.animatedEmoji : defaults.animatedEmoji,
      mediaCards: typeof stored.mediaCards === "boolean" ? stored.mediaCards : defaults.mediaCards,
    };
  } catch {
    return defaults;
  }
}

let current: Prefs = load();
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return current;
}

export function setPrefs(change: Partial<Prefs>): void {
  current = { ...current, ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* kept for this page only */
  }
  applyTheme(current);
  for (const l of [...listeners]) l();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** Light, dark or the system's, and the colour plate; the browser's own chrome takes the frame colour. */
export function applyTheme({ theme, palette, textSize }: Pick<Prefs, "theme" | "palette" | "textSize">): void {
  const root = document.documentElement;
  root.setAttribute("data-text-size", textSize);
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  root.setAttribute("data-palette", palette);
  const frame = getComputedStyle(root).getPropertyValue("--theme-color").trim();
  if (frame) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", frame);
}

export function resetPrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
  current = defaults;
  applyTheme(current);
  for (const l of [...listeners]) l();
}
