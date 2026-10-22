import { useSyncExternalStore } from "react";
import { TRANSLATE_TARGETS, type TranslateTarget } from "../sync/translate";

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

/** How conversations are drawn (android MessageLayout): a left-aligned stream with names (default), or bubbles. */
export const MESSAGE_LAYOUTS = ["stream", "bubbles"] as const;
export type MessageLayout = (typeof MESSAGE_LAYOUTS)[number];

export interface Prefs {
  theme: (typeof THEMES)[number];
  palette: Palette;
  textSize: TextSize;
  messageLayout: MessageLayout;
  /** Animated emoji play (android Settings › Chats › Animated emoji); off: shown still. */
  animatedEmoji: boolean;
  /** Music and video links show as cards that open the provider (android Settings › Chats); nothing is fetched. */
  mediaCards: boolean;
  /** Every link shows where it goes before opening (android Links › Ask every time); off: only misleading ones. */
  askBeforeLinks: boolean;
  /** Received photos load by themselves (android Download photos automatically); off: a click loads each one. */
  autoLoadPhotos: boolean;
  notifications: boolean;
  /** Groups and channels notify too (off: only direct messages and mentions of you; android Group notifications). */
  groupNotifications: boolean;
  /** Notifications make the system's sound (off: silent). */
  messageSound: boolean;
  /** Incoming calls ring in this tab (off: the call card and notification only). */
  callRingtone: boolean;
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
  /** The person agreed to on-device translation (the browser may download a language model). */
  translateConsent: boolean;
  /** The language messages are translated into. */
  translateTarget: TranslateTarget;
  /** Batch B10 (android Settings › Calls › Noise reduction): background noise reduction and automatic level. */
  noiseReduction: boolean;
  /** Batch B11: the last screen share choice, the default next time (android SettingsStore.shareMode, shareAppSound). */
  shareMode: "text" | "motion";
  shareAudio: boolean;
}

const KEY = "orbit.prefs.v1";
const defaults: Prefs = {
  theme: "system",
  palette: "indigo",
  textSize: "default",
  messageLayout: "stream",
  animatedEmoji: true,
  mediaCards: true,
  askBeforeLinks: false,
  autoLoadPhotos: true,
  notifications: false,
  groupNotifications: true,
  messageSound: true,
  callRingtone: true,
  notificationText: true,
  readReceipts: true,
  typing: true,
  enterToSend: true,
  orgId: null,
  collapsed: [],
  startHidden: false,
  translateConsent: false,
  translateTarget: "en",
  noiseReduction: true,
  shareMode: "text",
  shareAudio: false,
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
      messageLayout: MESSAGE_LAYOUTS.includes(stored.messageLayout) ? stored.messageLayout : defaults.messageLayout,
      animatedEmoji: typeof stored.animatedEmoji === "boolean" ? stored.animatedEmoji : defaults.animatedEmoji,
      mediaCards: typeof stored.mediaCards === "boolean" ? stored.mediaCards : defaults.mediaCards,
      translateTarget: TRANSLATE_TARGETS.some((t) => t.code === stored.translateTarget) ? stored.translateTarget : defaults.translateTarget,
      noiseReduction: typeof stored.noiseReduction === "boolean" ? stored.noiseReduction : defaults.noiseReduction,
      shareMode: stored.shareMode === "motion" ? "motion" : "text",
      shareAudio: typeof stored.shareAudio === "boolean" ? stored.shareAudio : defaults.shareAudio,
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
export function applyTheme({ theme, palette, textSize, messageLayout }: Pick<Prefs, "theme" | "palette" | "textSize" | "messageLayout">): void {
  const root = document.documentElement;
  root.setAttribute("data-text-size", textSize);
  root.setAttribute("data-message-layout", messageLayout);
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
