/**
 * Keyboard shortcuts (Settings › Shortcuts, 2026-10-28): each action has a default key combination, which the person
 * may change or turn off in this browser. A combination is written "Mod+Shift+K": Mod is ⌘ on a Mac and Ctrl elsewhere,
 * then Alt and Shift, then the key (a letter in capitals, or a KeyboardEvent.key name such as ArrowUp or Escape).
 */
export const SHORTCUTS = [
  { id: "search", label: "Quick switcher: jump to any channel, conversation or person", combo: "Mod+K" },
  { id: "prevConversation", label: "Previous conversation", combo: "Alt+ArrowUp" },
  { id: "nextConversation", label: "Next conversation", combo: "Alt+ArrowDown" },
  { id: "prevUnread", label: "Previous unread conversation", combo: "Alt+Shift+ArrowUp" },
  { id: "nextUnread", label: "Next unread conversation", combo: "Alt+Shift+ArrowDown" },
  { id: "markCommunityRead", label: "Mark this community as read", combo: "Shift+Escape" },
  { id: "toggleMute", label: "Mute or unmute in a call", combo: "Mod+Shift+M" },
  { id: "toggleDeafen", label: "Deafen or undeafen in a call", combo: "Mod+Shift+D" },
  { id: "showShortcuts", label: "Show the list of shortcuts", combo: "Mod+/" },
] as const;
export type ShortcutId = (typeof SHORTCUTS)[number]["id"];

/** Always on, not changeable: listed so they can be found. */
export const FIXED_SHORTCUTS: { label: string; keys: string[] }[] = [
  { label: "Send the message (Settings › Appearance › Enter sends can change it)", keys: ["Enter"] },
  { label: "New line", keys: ["Shift", "Enter"] },
  { label: "Cancel a reply", keys: ["Esc"] },
  { label: "Open a message's or a row's menu", keys: ["Shift", "F10"] },
  { label: "Move through a menu; open a submenu", keys: ["↑ ↓", "→"] },
  { label: "Close a menu, a dialog or the side drawer", keys: ["Esc"] },
];

export const isMac = (): boolean => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The combination a key press makes, in the stored form; null for a lone modifier. */
export function comboOf(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "code">, mac: boolean = isMac()): string | null {
  if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return null;
  // With Alt on a Mac, e.key is the accented character (⌥K → ˚): the physical key is what was meant.
  let key = e.altKey && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.key;
  if (key.length === 1) key = key.toUpperCase();
  if (key === " ") key = "Space";
  const mod = mac ? e.metaKey : e.ctrlKey;
  return [mod ? "Mod" : "", e.altKey ? "Alt" : "", e.shiftKey ? "Shift" : "", key].filter(Boolean).join("+");
}

/** The combination for [id]: the person's own, "" when turned off, else the default. */
export function bindingOf(keybinds: Record<string, string>, id: ShortcutId): string {
  return keybinds[id] ?? SHORTCUTS.find((s) => s.id === id)!.combo;
}

/** Which action a combination runs (null: none, or turned off). */
export function actionFor(keybinds: Record<string, string>, combo: string): ShortcutId | null {
  return SHORTCUTS.find((s) => bindingOf(keybinds, s.id) === combo)?.id ?? null;
}

/** Keys to show: ["⌘", "Shift", "K"] on a Mac, ["Ctrl", "Shift", "K"] elsewhere; arrows as ↑ ↓. */
export function keyCaps(combo: string, mac: boolean = isMac()): string[] {
  if (!combo) return [];
  const arrows: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Escape: "Esc" };
  return combo.split("+").map((p) => (p === "Mod" ? (mac ? "⌘" : "Ctrl") : p === "Alt" ? (mac ? "⌥" : "Alt") : (arrows[p] ?? p)));
}

/** Whether a combination is worth binding: it needs a modifier, unless it's a function key or Escape with Shift. */
export function usableCombo(combo: string): boolean {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  return parts.length > 1 || /^F\d{1,2}$/.test(key);
}
