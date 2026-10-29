import { z } from "zod";
import { openEnum } from "../api/enums";
import type { Engine } from "./engine";

/**
 * Bots in communities (API 0.65.0 batch B, server docs/SETTINGS_PARITY_API.md): adding one by its ID (Edit community
 * permission), the slash commands of the bots in a channel, and running one. The bot answers through the server: in
 * the channel as a message, or only to you as an `interaction.reply` frame that's never stored.
 */

const enc = encodeURIComponent;

export const zBotProfile = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  public: z.boolean(),
  owner: z.object({ id: z.string(), username: z.string() }).nullable(),
  commands: z.number(),
});
export type BotProfile = z.infer<typeof zBotProfile>;

const zOption = z.object({ name: z.string(), description: z.string(), type: openEnum(["string", "number", "boolean", "user"]), required: z.boolean() });
export type CommandOption = z.infer<typeof zOption>;
export const zOrgCommand = z.object({
  name: z.string(),
  description: z.string(),
  options: z.array(zOption),
  botId: z.string(),
  botUsername: z.string(),
  botDisplayName: z.string(),
});
export type OrgCommand = z.infer<typeof zOrgCommand>;

/** A bot's answer only the person who ran the command sees (the `interaction.reply` frame). */
export interface BotReply {
  interactionId: string;
  conversationId: string;
  botId: string;
  command: string;
  content: string;
  at: number;
}

export async function botProfile(engine: Engine, botId: string): Promise<BotProfile> {
  return (await engine.api.json("GET", `/v2/bots/${enc(botId)}`, z.object({ bot: zBotProfile }))).bot;
}

/** Adds it as a member; false when it was there already. */
export async function installBot(engine: Engine, orgId: string, botId: string): Promise<boolean> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/bots`, z.object({ bot: zBotProfile, installed: z.boolean() }), { body: { botId } })).installed;
}

export async function removeBot(engine: Engine, orgId: string, botId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/bots/${enc(botId)}`);
}

/** The commands of the bots that can post in [channelId]. */
export async function channelCommands(engine: Engine, orgId: string, channelId: string): Promise<OrgCommand[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/commands?channelId=${enc(channelId)}`, z.object({ commands: z.array(zOrgCommand) }))).commands;
}

export async function runCommand(engine: Engine, run: { channelId: string; botId: string; command: string; options: Record<string, string | number | boolean> }): Promise<void> {
  await engine.api.call("POST", "/v2/interactions", { body: run });
}

// ───────────────────────── the composer's "/" ─────────────────────────

/** The commands to list while "/name" is typed (before the first space): by name, then by bot. */
export function matchingCommands(commands: readonly OrgCommand[], text: string): OrgCommand[] {
  const m = /^\/([a-z0-9-]{0,32})$/i.exec(text);
  if (!m) return [];
  const q = m[1].toLowerCase();
  return commands
    .filter((c) => c.name.startsWith(q))
    .sort((a, b) => a.name.localeCompare(b.name) || a.botDisplayName.localeCompare(b.botDisplayName))
    .slice(0, 10);
}

/** What the composer puts in the box once a command is picked: its name, then each required option's "name:" to fill. */
export function commandTemplate(c: OrgCommand): string {
  const required = c.options.filter((o) => o.required).map((o) => `${o.name}:`);
  return required.length ? `/${c.name} ${required.join(" ")}` : `/${c.name} `;
}

/** Splits "a:1 b:\"two words\" c:x" into option pairs; text outside a pair is an error. */
function pairs(rest: string): Map<string, string> | null {
  const out = new Map<string, string>();
  const re = /\s*([a-z0-9-]{1,32}):(?:"([^"]*)"|(\S*))/giy;
  let at = 0;
  while (at < rest.length) {
    if (!rest.slice(at).trim()) break;
    re.lastIndex = at;
    const m = re.exec(rest);
    if (!m) return null;
    out.set(m[1].toLowerCase(), m[2] ?? m[3] ?? "");
    at = re.lastIndex;
  }
  return out;
}

export type ParsedCommand = { command: OrgCommand; options: Record<string, string | number | boolean> } | { problem: string } | null;

/**
 * A typed "/name option:value …" as a command to run, or what's wrong with it; null when the text isn't a command of a
 * bot here (it's sent as an ordinary message). [prefer] picks the bot when several have the same command name.
 * [userId] turns a "user" option's "@username" into an id (anything else is taken as an id).
 */
export function parseCommand(text: string, commands: readonly OrgCommand[], prefer: string | null, userId: (username: string) => string | null): ParsedCommand {
  const m = /^\/([a-z0-9-]{1,32})(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return null;
  const same = commands.filter((c) => c.name === m[1].toLowerCase());
  if (same.length === 0) return null;
  const command = same.find((c) => c.botId === prefer) ?? same[0];
  const given = pairs(m[2] ?? "");
  if (!given) return { problem: `Options go as name:value, like ${command.options[0]?.name ?? "option"}:something.` };
  const options: Record<string, string | number | boolean> = {};
  for (const [name, raw] of given) {
    const o = command.options.find((x) => x.name === name);
    if (!o) return { problem: `/${command.name} has no option "${name}".` };
    const value = optionValue(o, raw, userId);
    if (value === null) return { problem: `${name} should be ${OPTION_WORDS[o.type]}.` };
    options[name] = value;
  }
  const missing = command.options.find((o) => o.required && !(o.name in options));
  if (missing) return { problem: `/${command.name} needs ${missing.name} (${missing.description}).` };
  return { command, options };
}

const OPTION_WORDS: Record<CommandOption["type"], string> = { string: "some text", number: "a number", boolean: "true or false", user: "a person (@username)", unknown: "a value" };

function optionValue(o: CommandOption, raw: string, userId: (username: string) => string | null): string | number | boolean | null {
  if (o.type === "number") return raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  if (o.type === "boolean") return /^(true|yes|on)$/i.test(raw) ? true : /^(false|no|off)$/i.test(raw) ? false : null;
  if (o.type === "user") return raw.startsWith("@") ? userId(raw.slice(1)) : raw || null;
  return raw.length > 0 && raw.length <= 1000 ? raw : null;
}
