import { useSyncExternalStore } from "react";
import { type ShareQuality, shareQualityOf } from "../call/shareQuality";
import { TRANSLATE_TARGETS, type TranslateTarget } from "../sync/translate";
import { LANGUAGES, type LanguageChoice, resolveLanguage } from "../i18n/languages";

/**
 * Per-browser preferences. They hold no account data, so they live in localStorage, and every read and write tolerates
 * storage being unavailable (private windows, blocked site data): the defaults apply then.
 */
export const THEMES = ["system", "light", "dark"] as const;
/** The brand colour plates (src/styles/tokens.css › Palettes). */
export const PALETTES = ["charcoal", "indigo", "plum", "amber"] as const;
export type Palette = (typeof PALETTES)[number];
/** Message text size (android Settings › Chats): conversation text only, the rest of the interface stays as it is. */
export const TEXT_SIZES = ["small", "default", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Clock times (android TimeFmt.hourFormat): the language's own, or always 12- or 24-hour. */
export const TIME_FORMATS = ["auto", "12", "24"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];
/** The conversation list's second line (android chat-list previews): every message, unread ones only, or none. */
export const LIST_PREVIEWS = ["all", "unread", "none"] as const;
export type ListPreview = (typeof LIST_PREVIEWS)[number];
/** Photos as sent (android upload quality): Standard (1600 px), HD (2560 px), or the original file. */
export const UPLOAD_QUALITIES = ["standard", "hd", "original"] as const;
export type UploadQuality = (typeof UPLOAD_QUALITIES)[number];
/** Double-tap (or double-click) reactions (android Gestures). */
export const QUICK_REACTIONS = ["👍", "❤️", "✅", "😂", "🔥", "🙏"] as const;

/** How conversations are drawn (android MessageLayout): a left-aligned stream with names (default), or bubbles. */
export const MESSAGE_LAYOUTS = ["stream", "bubbles"] as const;
export type MessageLayout = (typeof MESSAGE_LAYOUTS)[number];

export interface Prefs {
  theme: (typeof THEMES)[number];
  /** The interface language (src/i18n): the browser's, or one picked on the sign-in screens or in Settings › Appearance. */
  language: LanguageChoice;
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
  /**
   * Whether the person chose Desktop notifications themselves. Until they do, notifications follow the browser's
   * permission for this site (granted in its site settings counts), instead of staying off although it was allowed.
   */
  notifyChoice: "unset" | "on" | "off";
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
  /** The last screen share quality (2026-10-24: Standard 720p30 or High 1080p60) and sound, the default next time. */
  shareQuality: ShareQuality;
  shareAudio: boolean;
  /** Channels and groups show their member list beside the messages, on screens wide enough for it. */
  memberList: boolean;
  /** Direct messages show the other person's profile beside the messages, on screens wide enough for it. */
  dmProfile: boolean;
  /** The person picked a colour plate themselves; until then the default applies (it moved from indigo to charcoal). */
  paletteChosen: boolean;
  timeFormat: TimeFormat;
  listPreview: ListPreview;
  uploadQuality: UploadQuality;
  /** Swiping a message to the left on a touch screen replies to it. */
  swipeToReply: boolean;
  /** Double-tapping (double-clicking) a message reacts with [quickReaction]; again takes it back. */
  doubleTapReact: boolean;
  quickReaction: string;
  /** YouTube videos play inside Meldiq (privacy-enhanced player) instead of opening YouTube (android, 2026-10-23). */
  youtubeInApp: boolean;
}

const KEY = "orbit.prefs.v1";
const defaults: Prefs = {
  theme: "system",
  language: "system",
  palette: "charcoal",
  textSize: "default",
  messageLayout: "stream",
  animatedEmoji: true,
  mediaCards: true,
  askBeforeLinks: false,
  autoLoadPhotos: true,
  notifications: false,
  notifyChoice: "unset",
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
  shareQuality: "standard",
  shareAudio: false,
  memberList: true,
  dmProfile: true,
  paletteChosen: false,
  timeFormat: "auto",
  listPreview: "all",
  uploadQuality: "standard",
  swipeToReply: true,
  doubleTapReact: true,
  quickReaction: "👍",
  youtubeInApp: true,
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults, ...notificationChoice(defaults) };
    const stored = { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) };
    // Anything unknown (an older or tampered value) falls back to the default rather than reaching the page's attributes.
    return {
      ...stored,
      theme: THEMES.includes(stored.theme) ? stored.theme : defaults.theme,
      language: stored.language === "system" || LANGUAGES.some((l) => l === stored.language) ? stored.language : defaults.language,
      palette: paletteOf(stored),
      textSize: TEXT_SIZES.includes(stored.textSize) ? stored.textSize : defaults.textSize,
      messageLayout: MESSAGE_LAYOUTS.includes(stored.messageLayout) ? stored.messageLayout : defaults.messageLayout,
      animatedEmoji: typeof stored.animatedEmoji === "boolean" ? stored.animatedEmoji : defaults.animatedEmoji,
      mediaCards: typeof stored.mediaCards === "boolean" ? stored.mediaCards : defaults.mediaCards,
      translateTarget: TRANSLATE_TARGETS.some((t) => t.code === stored.translateTarget) ? stored.translateTarget : defaults.translateTarget,
      noiseReduction: typeof stored.noiseReduction === "boolean" ? stored.noiseReduction : defaults.noiseReduction,
      // Older saves had text or motion: either starts as Standard.
      shareQuality: shareQualityOf(stored.shareQuality),
      shareAudio: typeof stored.shareAudio === "boolean" ? stored.shareAudio : defaults.shareAudio,
      memberList: typeof stored.memberList === "boolean" ? stored.memberList : defaults.memberList,
      dmProfile: typeof stored.dmProfile === "boolean" ? stored.dmProfile : defaults.dmProfile,
      paletteChosen: stored.paletteChosen === true,
      timeFormat: TIME_FORMATS.includes(stored.timeFormat) ? stored.timeFormat : defaults.timeFormat,
      listPreview: LIST_PREVIEWS.includes(stored.listPreview) ? stored.listPreview : defaults.listPreview,
      uploadQuality: UPLOAD_QUALITIES.includes(stored.uploadQuality) ? stored.uploadQuality : defaults.uploadQuality,
      swipeToReply: typeof stored.swipeToReply === "boolean" ? stored.swipeToReply : defaults.swipeToReply,
      doubleTapReact: typeof stored.doubleTapReact === "boolean" ? stored.doubleTapReact : defaults.doubleTapReact,
      quickReaction: QUICK_REACTIONS.some((e) => e === stored.quickReaction) ? stored.quickReaction : defaults.quickReaction,
      youtubeInApp: typeof stored.youtubeInApp === "boolean" ? stored.youtubeInApp : defaults.youtubeInApp,
      ...notificationChoice(stored),
    };
  } catch {
    return defaults;
  }
}

/**
 * The stored colour plate. Indigo was the default before charcoal, and every browser that saved any preference saved it
 * too, so a stored indigo counts as a choice only once the person picked a plate themselves (Appearance › Colour).
 */
export function paletteOf(stored: { palette?: unknown; paletteChosen?: unknown }): Palette {
  const palette = PALETTES.find((p) => p === stored.palette);
  if (!palette) return defaults.palette;
  return palette === "indigo" && stored.paletteChosen !== true ? defaults.palette : palette;
}

const permitted = (): boolean => typeof Notification !== "undefined" && Notification.permission === "granted";

/**
 * Desktop notifications as chosen: on or off when the person chose; otherwise on if this site may notify. (Stored copies
 * from before the choice existed say `notifications: false` by default, which said nothing about a choice.)
 */
export function notificationChoice(stored: Pick<Prefs, "notifications"> & Partial<Pick<Prefs, "notifyChoice">>, granted: boolean = permitted()): Pick<Prefs, "notifications" | "notifyChoice"> {
  const choice = stored.notifyChoice === "on" || stored.notifyChoice === "off" ? stored.notifyChoice : stored.notifications ? "on" : "unset";
  return { notifyChoice: choice, notifications: choice === "on" || (choice === "unset" && granted) };
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

/** Called after every change (the service worker's copy of the notification choices). Returns the unsubscribe. */
export function subscribePrefs(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
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
export function applyTheme({ theme, palette, textSize, messageLayout, language }: Pick<Prefs, "theme" | "palette" | "textSize" | "messageLayout"> & Partial<Pick<Prefs, "language">>): void {
  const root = document.documentElement;
  // The page's language follows the interface's (screen readers, fonts, spelling).
  root.setAttribute("lang", resolveLanguage(language ?? "system"));
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
