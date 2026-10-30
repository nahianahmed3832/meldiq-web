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

export const SETTINGS_DEFAULTS: { readonly [K in SettingsKey]: BotSettingsMap[K] } = {
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
const PLUS_VALUE: { readonly [K in SettingsKey]: Partial<Record<keyof BotSettingsMap[K], (v: unknown) => boolean>> } = {
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
  if (s.messages.length === 0) return "Write a greeting.";
  if (s.messages.length > max) return botsPlus ? `Up to ${max} greetings.` : "More than one greeting needs Bots+.";
  if (s.messages.some((m) => !m.trim())) return "A greeting is empty: write it or remove it.";
  if (s.messages.some((m) => tooLong(m, BOT_LIMITS.welcomeMessage))) return `Keep each greeting to ${BOT_LIMITS.welcomeMessage} characters.`;
  if (tooLong(s.goodbye, BOT_LIMITS.welcomeMessage)) return `Keep the goodbye to ${BOT_LIMITS.welcomeMessage} characters.`;
  return null;
}

/** Why a Helper command can't be saved, or null. */
export function commandProblem(c: CustomCommand, others: readonly CustomCommand[]): string | null {
  const name = c.name.trim().toLowerCase().replace(/^!/, "");
  if (!name) return "Give the command a name.";
  if (!/^[a-z0-9_-]+$/.test(name)) return `!${name}: use letters, digits, - and _ only.`;
  if (chars(name) > BOT_LIMITS.customCommandName) return `!${name}: keep the name to ${BOT_LIMITS.customCommandName} characters.`;
  if ((BUILT_IN_COMMANDS as readonly string[]).includes(name)) return `!${name} is already a built-in command.`;
  if (others.some((o) => o.name.trim().toLowerCase().replace(/^!/, "") === name)) return `There's already a !${name}.`;
  if (!c.response.trim()) return `!${name} needs an answer.`;
  if (tooLong(c.response, BOT_LIMITS.customResponse)) return `!${name}: keep the answer to ${BOT_LIMITS.customResponse} characters.`;
  return null;
}

function helperProblem(s: HelperSettings): string | null {
  if (s.commands.length > BOT_LIMITS.customCommands) return `Up to ${BOT_LIMITS.customCommands} commands.`;
  for (const [i, c] of s.commands.entries()) {
    const problem = commandProblem(c, s.commands.slice(0, i));
    if (problem) return problem;
  }
  return null;
}

function levelsProblem(s: LevelsSettings): string | null {
  if (!(BOT_LIMITS.xpBoosts as readonly number[]).includes(s.boost)) return "Pick an XP boost of 1×, 1.5× or 2×.";
  if (s.roleRewards.length > BOT_LIMITS.roleRewards) return `Up to ${BOT_LIMITS.roleRewards} role rewards.`;
  for (const r of s.roleRewards) {
    if (!Number.isInteger(r.level) || r.level < 1 || r.level > BOT_LIMITS.maxLevel) return `Levels go from 1 to ${BOT_LIMITS.maxLevel}.`;
    if (!r.roleId) return `Pick a role for level ${r.level}.`;
  }
  if (new Set(s.roleRewards.map((r) => r.roleId)).size !== s.roleRewards.length) return "Each role can be a reward once.";
  if (tooLong(s.levelUpMessage, BOT_LIMITS.welcomeMessage)) return `Keep the level-up message to ${BOT_LIMITS.welcomeMessage} characters.`;
  return null;
}

function excludedProblem(ids: readonly string[]): string | null {
  return ids.length > BOT_LIMITS.excludedChannels ? `Leave out up to ${BOT_LIMITS.excludedChannels} channels.` : null;
}

function starboardProblem(s: StarboardSettings): string | null {
  if (!(BOT_LIMITS.starThresholds as readonly number[]).includes(s.threshold)) return "Pick how many stars a message needs.";
  if (tooLong(s.emoji, BOT_LIMITS.emoji)) return "That emoji is too long.";
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
  return chars(name.trim()) > BOT_LIMITS.lookName ? `Keep the name to ${BOT_LIMITS.lookName} characters.` : null;
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
export function botStatusLine(bot: { enabled: boolean; available: boolean; unavailableReason?: string | null }, botsPlus: boolean): string {
  const state = !bot.available ? (bot.unavailableReason ? "Unavailable" : "Coming soon") : bot.enabled ? "On" : "Off";
  return `${state} · ${botsPlus ? "PLUS" : "FREE"} · tap for details`;
}

const YOUTUBE_LINK = /^(https?:\/\/)?(www\.|m\.)?youtube\.com\/(@[\w.-]+|channel\/UC[\w-]+|user\/[\w.-]+|c\/[\w.-]+)\/?$/i;
const HANDLE = /^@[\w.-]{2,100}$/;

/** Why a YouTube channel can't be followed as typed, or null: a channel link or an @handle. */
export function alertSourceProblem(source: string): string | null {
  const s = source.trim();
  if (!s) return "Paste the YouTube channel's link or its @handle.";
  return YOUTUBE_LINK.test(s) || HANDLE.test(s) ? null : "That isn't a YouTube channel: paste a link like youtube.com/@name, or an @handle.";
}

export const WORDY_LENGTH = 5;
export type WordyMark = "right" | "close" | "absent";

/** A row's marks (🟩 🟨 ⬛) as kinds, one per letter. */
export function wordyMarks(marks: string): WordyMark[] {
  return [...marks].filter((c) => c !== "️").map((c) => (c === "🟩" ? "right" : c === "🟨" ? "close" : "absent"));
}

const RANK: Record<WordyMark, number> = { absent: 0, close: 1, right: 2 };

/** The keyboard's colours: each letter's best mark so far. */
export function wordyKeys(rows: readonly { guess: string; marks: string }[]): Record<string, WordyMark> {
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
  return /^[a-z]{5}$/i.test(guess.trim()) ? null : "A guess is a five-letter word.";
}
