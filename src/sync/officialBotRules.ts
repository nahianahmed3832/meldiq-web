import { text as uiText } from "../i18n";
/**
 * Official bots' settings (docs/COMMUNITY_PARITY_API.md › Official bots): defaults, what counts as a Plus extra, and the
 * checks the forms run before saving. The server checks all of it again; these keep the forms honest and only send
 * what changed, so Plus settings kept while Bots+ is gone are never sent back (which the server would refuse).
 */
export const BOT_LIMITS = {
  lookName: 32,
  welcomeMessage: 300,
  welcomeLines: { free: 1, plus: 10 },
  customCommands: 25,
  customCommandName: 32,
  customResponse: 500,
  roleRewards: 20,
  maxLevel: 500,
  excludedChannels: 25,
  starThresholds: [1, 2, 3, 4, 5, 7, 10, 15, 20, 30],
  defaultStarThreshold: 5,
  xpBoosts: [1, 1.5, 2],
  emoji: 64,
  alertWatches: { free: 3, plus: 25 },
  alertMessage: 300,
  ticketWelcome: 500,
  giveawayWinners: { free: 3, plus: 20 },
  giveawayDays: { free: 7, plus: 30 },
} as const;
/** Bots+'s price as the reference shows it; billing for it isn't set up yet. */
export const BOTS_PLUS_PRICE = "$3.99/mo";
/** Commands the bots already answer: a Helper command can't take one of these names. */
export const BUILT_IN_COMMANDS = ["8ball", "roll", "flip", "choose", "afk", "help", "rank", "top", "giveaway", "gend", "greroll", "wordy"] as const;
export const DEFAULT_WELCOME = "Welcome to {server}, {user}! 👋";
export const WELCOME_PLACEHOLDERS = ["{user}", "{name}", "{server}", "{count}"] as const;
export const LEVEL_UP_PLACEHOLDERS = ["{user}", "{level}"] as const;
export const ALERT_PLACEHOLDERS = ["{creator}", "{title}", "{url}", "{role}"] as const;
export interface CustomCommand {
  name: string;
  response: string;
}
export interface RoleReward {
  level: number;
  roleId: string;
}
export interface WelcomerSettings {
  channelId: string | null;
  messages: string[];
  goodbye: string | null;
}
export interface HelperSettings {
  commands: CustomCommand[];
}
export interface LevelsSettings {
  announce: boolean;
  announceChannelId: string | null;
  boost: number;
  roleRewards: RoleReward[];
  levelUpMessage: string | null;
}
export interface LoggerSettings {
  channelId: string | null;
  memberChannelId: string | null;
  excludeChannelIds: string[];
}
export interface StarboardSettings {
  channelId: string | null;
  threshold: number;
  emoji: string | null;
  selfStar: boolean;
  excludeChannelIds: string[];
}
/** Giveaways. Plus: only members holding the role may win. */
export interface GiveawaysSettings {
  requiredRoleId: string | null;
}
/** Wordy is quiet until its channel is picked. (Tickets' settings are its tickets config; Alerts' are its watches.) */
export interface WordySettings {
  channelId: string | null;
}
export interface BotSettingsMap {
  welcomer: WelcomerSettings;
  helper: HelperSettings;
  levels: LevelsSettings;
  logger: LoggerSettings;
  starboard: StarboardSettings;
  giveaways: GiveawaysSettings;
  wordy: WordySettings;
}
export type SettingsKey = keyof BotSettingsMap;
export type AnySettings = Record<string, unknown>;
export const SETTINGS_DEFAULTS: {
  readonly [K in SettingsKey]: BotSettingsMap[K];
} = {
  welcomer: { channelId: null, messages: [DEFAULT_WELCOME], goodbye: null },
  helper: { commands: [] },
  levels: { announce: true, announceChannelId: null, boost: 1, roleRewards: [], levelUpMessage: null },
  logger: { channelId: null, memberChannelId: null, excludeChannelIds: [] },
  starboard: { channelId: null, threshold: BOT_LIMITS.defaultStarThreshold, emoji: null, selfStar: false, excludeChannelIds: [] },
  giveaways: { requiredRoleId: null },
  wordy: { channelId: null },
};
export function hasSettings(key: string): key is SettingsKey {
  return Object.hasOwn(SETTINGS_DEFAULTS, key);
}
/** The settings a form edits: the server's, with the defaults for anything it left out. */
export function settingsDraft(key: string, stored: AnySettings | null): AnySettings {
  if (!hasSettings(key)) return { ...(stored ?? {}) };
  return { ...SETTINGS_DEFAULTS[key], ...(stored ?? {}) };
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** The fields of [draft] that differ from [original]: what a save sends. */
export function changedSettings(original: AnySettings, draft: AnySettings): AnySettings {
  return Object.fromEntries(Object.entries(draft).filter(([k, v]) => !same(original[k], v)));
}
const nonEmpty = (v: unknown): boolean => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "");
/**
 * Whether a field's value is a Plus extra: some fields are Plus only when set (a goodbye), others past a free amount
 * (more than one greeting, a boost above 1×).
 */
const PLUS_VALUE: {
  readonly [K in SettingsKey]: Partial<Record<keyof BotSettingsMap[K], (v: unknown) => boolean>>;
} = {
  welcomer: { messages: (v) => Array.isArray(v) && v.length > BOT_LIMITS.welcomeLines.free, goodbye: nonEmpty },
  helper: { commands: nonEmpty },
  levels: { boost: (v) => typeof v === "number" && v !== 1, roleRewards: nonEmpty, levelUpMessage: nonEmpty },
  logger: { memberChannelId: nonEmpty, excludeChannelIds: nonEmpty },
  starboard: { emoji: nonEmpty, selfStar: (v) => v === true, excludeChannelIds: nonEmpty },
  giveaways: { requiredRoleId: nonEmpty },
  wordy: {},
};
/** The fields that are Plus extras for this bot (shown with a PLUS chip, and disabled without Bots+). */
export function plusFields(key: string): string[] {
  return hasSettings(key) ? Object.keys(PLUS_VALUE[key]) : [];
}
/** Whether [field] holds a Plus value in [settings]. */
export function isPlusValue(key: string, field: string, settings: AnySettings): boolean {
  if (!hasSettings(key)) return false;
  const test = (PLUS_VALUE[key] as Record<string, ((v: unknown) => boolean) | undefined>)[field];
  return !!test && test(settings[field]);
}
/** The changed fields that need Bots+ (empty when the community has it). */
export function plusNeeded(key: string, original: AnySettings, draft: AnySettings, botsPlus: boolean): string[] {
  if (botsPlus) return [];
  return Object.keys(changedSettings(original, draft)).filter((f) => isPlusValue(key, f, draft));
}
const chars = (s: string): number => [...s].length;
const tooLong = (s: string | null | undefined, max: number): boolean => !!s && chars(s.trim()) > max;
function welcomerProblem(s: WelcomerSettings, botsPlus: boolean): string | null {
  const max = botsPlus ? BOT_LIMITS.welcomeLines.plus : BOT_LIMITS.welcomeLines.free;
  if (s.messages.length === 0) return uiText("workspace.interface.write_a_greeting_03f9705");
  if (s.messages.length > max)
    return botsPlus ? uiText("workspace.interface.up_to_value0_greetings_193e1d4", { value0: max }) : uiText("workspace.interface.more_than_one_greeting_needs_bots_776ca9c");
  if (s.messages.some((m) => !m.trim())) return uiText("workspace.interface.a_greeting_is_empty_write_it_or_remove_it_7551aa0");
  if (s.messages.some((m) => tooLong(m, BOT_LIMITS.welcomeMessage))) return uiText("workspace.interface.keep_each_greeting_to_value0_characters_40cc5de", { value0: BOT_LIMITS.welcomeMessage });
  if (tooLong(s.goodbye, BOT_LIMITS.welcomeMessage)) return uiText("workspace.interface.keep_the_goodbye_to_value0_characters_4c40cc9", { value0: BOT_LIMITS.welcomeMessage });
  return null;
}
/** Why a Helper command can't be saved, or null. */
export function commandProblem(c: CustomCommand, others: readonly CustomCommand[]): string | null {
  const name = c.name.trim().toLowerCase().replace(/^!/, "");
  if (!name) return uiText("workspace.interface.give_the_command_a_name_957d97f");
  if (!/^[a-z0-9_-]+$/.test(name)) return uiText("workspace.interface.value0_use_letters_digits_and_only_84770a0", { value0: name });
  if (chars(name) > BOT_LIMITS.customCommandName) return uiText("workspace.interface.value0_keep_the_name_to_value1_characters_8ff7bfb", { value0: name, value1: BOT_LIMITS.customCommandName });
  if ((BUILT_IN_COMMANDS as readonly string[]).includes(name)) return uiText("workspace.interface.value0_is_already_a_built_in_command_84e44e5", { value0: name });
  if (others.some((o) => o.name.trim().toLowerCase().replace(/^!/, "") === name)) return uiText("workspace.interface.there_s_already_a_value0_0091a3c", { value0: name });
  if (!c.response.trim()) return uiText("workspace.interface.value0_needs_an_answer_60b5db6", { value0: name });
  if (tooLong(c.response, BOT_LIMITS.customResponse)) return uiText("workspace.interface.value0_keep_the_answer_to_value1_characters_c45b57f", { value0: name, value1: BOT_LIMITS.customResponse });
  return null;
}
function helperProblem(s: HelperSettings): string | null {
  if (s.commands.length > BOT_LIMITS.customCommands) return uiText("workspace.interface.up_to_value0_commands_3834c31", { value0: BOT_LIMITS.customCommands });
  for (const [i, c] of s.commands.entries()) {
    const problem = commandProblem(c, s.commands.slice(0, i));
    if (problem) return problem;
  }
  return null;
}
function levelsProblem(s: LevelsSettings): string | null {
  if (!(BOT_LIMITS.xpBoosts as readonly number[]).includes(s.boost)) return uiText("workspace.interface.pick_an_xp_boost_of_1_1_5_or_2_ea82f44");
  if (s.roleRewards.length > BOT_LIMITS.roleRewards) return uiText("workspace.interface.up_to_value0_role_rewards_eb74e54", { value0: BOT_LIMITS.roleRewards });
  for (const r of s.roleRewards) {
    if (!Number.isInteger(r.level) || r.level < 1 || r.level > BOT_LIMITS.maxLevel) return uiText("workspace.interface.levels_go_from_1_to_value0_380a614", { value0: BOT_LIMITS.maxLevel });
    if (!r.roleId) return uiText("workspace.interface.pick_a_role_for_level_value0_41a0855", { value0: r.level });
  }
  if (new Set(s.roleRewards.map((r) => r.roleId)).size !== s.roleRewards.length) return uiText("workspace.interface.each_role_can_be_a_reward_once_e8d929e");
  if (tooLong(s.levelUpMessage, BOT_LIMITS.welcomeMessage)) return uiText("workspace.interface.keep_the_level_up_message_to_value0_characters_f079644", { value0: BOT_LIMITS.welcomeMessage });
  return null;
}
function excludedProblem(ids: readonly string[]): string | null {
  return ids.length > BOT_LIMITS.excludedChannels ? uiText("workspace.interface.leave_out_up_to_value0_channels_5471eb9", { value0: BOT_LIMITS.excludedChannels }) : null;
}
function starboardProblem(s: StarboardSettings): string | null {
  if (!(BOT_LIMITS.starThresholds as readonly number[]).includes(s.threshold)) return uiText("workspace.interface.pick_how_many_stars_a_message_needs_3caad30");
  if (tooLong(s.emoji, BOT_LIMITS.emoji)) return uiText("workspace.interface.that_emoji_is_too_long_658b4f4");
  return excludedProblem(s.excludeChannelIds);
}
/** Why these settings can't be saved, or null. */
export function settingsProblem(key: string, draft: AnySettings, botsPlus: boolean): string | null {
  switch (key) {
    case "welcomer":
      return welcomerProblem(draft as unknown as WelcomerSettings, botsPlus);
    case "helper":
      return helperProblem(draft as unknown as HelperSettings);
    case "levels":
      return levelsProblem(draft as unknown as LevelsSettings);
    case "logger":
      return excludedProblem((draft as unknown as LoggerSettings).excludeChannelIds);
    case "starboard":
      return starboardProblem(draft as unknown as StarboardSettings);
    default:
      return null;
  }
}
/** Trimmed strings, empty optional texts as null, command names without "!": what the server takes. */
export function cleanSettings(key: string, s: AnySettings): AnySettings {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  switch (key) {
    case "welcomer":
      return { ...s, messages: (s.messages as string[]).map((m) => m.trim()), goodbye: text(s.goodbye) };
    case "helper":
      return { ...s, commands: (s.commands as CustomCommand[]).map((c) => ({ name: c.name.trim().toLowerCase().replace(/^!/, ""), response: c.response.trim() })) };
    case "levels":
      return { ...s, levelUpMessage: text(s.levelUpMessage) };
    case "starboard":
      return { ...s, emoji: text(s.emoji) };
    default:
      return s;
  }
}
/** Why the bot's name here can't be saved, or null. Empty goes back to the bot's own name. */
export function lookNameProblem(name: string): string | null {
  return chars(name.trim()) > BOT_LIMITS.lookName ? uiText("workspace.interface.keep_the_name_to_value0_characters_753e2bb", { value0: BOT_LIMITS.lookName }) : null;
}
export interface PlaceholderValues {
  user: string;
  name: string;
  server: string;
  count: number;
}
/** A greeting with its placeholders filled in, for the live preview. */
export function fillWelcome(template: string, v: PlaceholderValues): string {
  return template.replaceAll("{user}", `@${v.user}`).replaceAll("{name}", v.name).replaceAll("{server}", v.server).replaceAll("{count}", String(v.count));
}
/** The Levels bot's level for an XP total: floor(√(XP/100)). */
export function levelFromXp(xp: number): number {
  return xp > 0 ? Math.floor(Math.sqrt(xp / 100)) : 0;
}
/** The "Off · FREE · tap for details" line under a bot on the Bots page. */
export function botStatusLine(
  bot: {
    enabled: boolean;
    available: boolean;
    unavailableReason?: string | null;
  },
  botsPlus: boolean,
): string {
  const state = !bot.available
    ? bot.unavailableReason
      ? uiText("workspace.interface.unavailable_ca18449")
      : uiText("workspace.interface.coming_soon_4f7d640")
    : bot.enabled
      ? uiText("settings.interface.on_1300117")
      : uiText("messaging.interface.off_ca7981b");
  return uiText("workspace.interface.value0_value1_tap_for_details_db53ffb", {
    value0: state,
    value1: botsPlus ? uiText("billing.interface.plus_507391f") : uiText("workspace.interface.free_4a9768f"),
  });
}
const YOUTUBE_LINK = /^(https?:\/\/)?(www\.|m\.)?youtube\.com\/(@[\w.-]+|channel\/UC[\w-]+|user\/[\w.-]+|c\/[\w.-]+)\/?$/i;
const HANDLE = /^@[\w.-]{2,100}$/;
/** Why a YouTube channel can't be followed as typed, or null: a channel link or an @handle. */
export function alertSourceProblem(source: string): string | null {
  const s = source.trim();
  if (!s) return uiText("workspace.interface.paste_the_youtube_channel_s_link_or_its_handle_2823356");
  return YOUTUBE_LINK.test(s) || HANDLE.test(s) ? null : uiText("workspace.interface.that_isn_t_a_youtube_channel_paste_a_link_like_youtube_com_name_o_a370c7c");
}
export const WORDY_LENGTH = 5;
export type WordyMark = "right" | "close" | "absent";
/** A row's marks (🟩 🟨 ⬛) as kinds, one per letter. */
export function wordyMarks(marks: string): WordyMark[] {
  return [...marks].filter((c) => c !== "️").map((c) => (c === "🟩" ? "right" : c === "🟨" ? "close" : "absent"));
}
const RANK: Record<WordyMark, number> = { absent: 0, close: 1, right: 2 };
/** The keyboard's colours: each letter's best mark so far. */
export function wordyKeys(
  rows: readonly {
    guess: string;
    marks: string;
  }[],
): Record<string, WordyMark> {
  const out: Record<string, WordyMark> = {};
  for (const r of rows) {
    const marks = wordyMarks(r.marks);
    [...r.guess.toLowerCase()].forEach((ch, i) => {
      const m = marks[i] ?? "absent";
      if (!out[ch] || RANK[m] > RANK[out[ch]]) out[ch] = m;
    });
  }
  return out;
}
/** Why a guess can't be sent yet, or null (the server checks the word list). */
export function wordyGuessProblem(guess: string): string | null {
  return /^[a-z]{5}$/i.test(guess.trim()) ? null : uiText("workspace.interface.a_guess_is_a_five_letter_word_a796f8e");
}
