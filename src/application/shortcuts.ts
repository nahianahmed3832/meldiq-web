import { text as uiText } from "../i18n";
/**
 * Keyboard shortcuts (Settings › Shortcuts, 2026-10-28): each action has a default key combination, which the person
 * may change or turn off in this browser. A combination is written "Mod+Shift+K": Mod is ⌘ on a Mac and Ctrl elsewhere,
 * then Alt and Shift, then the key (a letter in capitals, or a KeyboardEvent.key name such as ArrowUp or Escape).
 */
export const SHORTCUTS = [
  {
    id: "search",
    get label() {
      return uiText("workspace.interface.quick_switcher_jump_to_any_channel_conversation_or_person_cec1dea");
    },
    combo: "Mod+K",
  },
  {
    id: "prevConversation",
    get label() {
      return uiText("workspace.interface.previous_conversation_5c7eedb");
    },
    combo: "Alt+ArrowUp",
  },
  {
    id: "nextConversation",
    get label() {
      return uiText("workspace.interface.next_conversation_a012558");
    },
    combo: "Alt+ArrowDown",
  },
  {
    id: "prevUnread",
    get label() {
      return uiText("workspace.interface.previous_unread_conversation_5366682");
    },
    combo: "Alt+Shift+ArrowUp",
  },
  {
    id: "nextUnread",
    get label() {
      return uiText("workspace.interface.next_unread_conversation_64135a8");
    },
    combo: "Alt+Shift+ArrowDown",
  },
  {
    id: "markCommunityRead",
    get label() {
      return uiText("workspace.interface.mark_this_community_as_read_79fb3ab");
    },
    combo: "Shift+Escape",
  },
  {
    id: "toggleMute",
    get label() {
      return uiText("workspace.interface.mute_or_unmute_in_a_call_5e077a0");
    },
    combo: "Mod+Shift+M",
  },
  {
    id: "toggleDeafen",
    get label() {
      return uiText("workspace.interface.deafen_or_undeafen_in_a_call_f09b562");
    },
    combo: "Mod+Shift+D",
  },
  {
    id: "showShortcuts",
    get label() {
      return uiText("workspace.interface.show_the_list_of_shortcuts_3e6d03f");
    },
    combo: "Mod+/",
  },
] as const;
export type ShortcutId = (typeof SHORTCUTS)[number]["id"];
/** Always on, not changeable: listed so they can be found. */
export const FIXED_SHORTCUTS: {
  label: string;
  keys: string[];
}[] = [
  {
    get label() {
      return uiText("workspace.interface.send_the_message_settings_appearance_enter_sends_can_change_it_b5f8820");
    },
    keys: ["Enter"],
  },
  {
    get label() {
      return uiText("workspace.interface.new_line_587826d");
    },
    keys: ["Shift", "Enter"],
  },
  {
    get label() {
      return uiText("workspace.interface.cancel_a_reply_338ecf7");
    },
    keys: ["Esc"],
  },
  {
    get label() {
      return uiText("workspace.interface.open_a_message_s_or_a_row_s_menu_c42f3b1");
    },
    keys: ["Shift", "F10"],
  },
  {
    get label() {
      return uiText("workspace.interface.move_through_a_menu_open_a_submenu_62dbf01");
    },
    keys: ["↑ ↓", "→"],
  },
  {
    get label() {
      return uiText("workspace.interface.close_a_menu_a_dialog_or_the_side_drawer_d769a2e");
    },
    keys: ["Esc"],
  },
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
