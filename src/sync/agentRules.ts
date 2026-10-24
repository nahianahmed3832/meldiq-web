import type { StoredMessage } from "../model/types";

/**
 * How a message in a channel asks an AI agent (server docs/AI_WORKFORCE.md §3, src/modules/workforce/invocation.ts):
 * "@Name" anywhere in it for agents activated by mention, "/name …" at the start for agents activated by mention or
 * command. Agents set to "explicit" only answer the Ask an agent dialog.
 * When it matches, the text is not sent as an encrypted message: the app shows the agent request (with its notice)
 * instead, because mentions live inside the encryption and the server could never see them.
 */
export interface InvocableAgent {
  id: string;
  displayName: string;
  activation: "mention" | "command" | "explicit";
  canInvoke: boolean;
}

export interface Invocation {
  installId: string;
  displayName: string;
  brief: string;
  canInvoke: boolean;
}

/** "Reel Maker" → "reel-maker". */
export const commandName = (displayName: string): string =>
  displayName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** What may follow a name: the end, a space or punctuation. */
const NAME_END = "(?=$|[\\s,:;.!?])";

/**
 * Where [t] calls [a], by the server's rule (server src/modules/workforce/invocation.ts, tested against the shared
 * cases in test/contract-fixtures/rules/agent-invocation.json): "@Name" anywhere, at the start or after a space, ending
 * where the name ends ("@Reel Maker2" isn't "@Reel Maker"), for agents activated by mention; "/name" (or the name
 * without its dashes) at the start only, for agents activated by mention or command.
 */
function callIn(t: string, a: InvocableAgent): { index: number; length: number } | null {
  if (a.activation === "explicit") return null;
  const slug = commandName(a.displayName);
  const command = slug ? new RegExp(`^/(${slug}|${slug.replace(/-/g, "")})${NAME_END}`, "i").exec(t) : null;
  if (command) return { index: 0, length: command[0].length };
  if (a.activation !== "mention" || !a.displayName.trim()) return null;
  const m = new RegExp(`(^|\\s)@${escapeRegExp(a.displayName)}${NAME_END}`, "i").exec(t);
  return m ? { index: m.index + m[1]!.length, length: m[0].length - m[1]!.length } : null;
}

/**
 * The agent [text] asks and what it asks (the text without the call: "fix this @Agent?" → "fix this?"), or null when
 * it's an ordinary message or a call with nothing asked. The longest matching name wins.
 */
export function agentInvocation(text: string, agents: readonly InvocableAgent[]): Invocation | null {
  const t = text.trim();
  let best: { agent: InvocableAgent; at: { index: number; length: number } } | null = null;
  for (const a of agents) {
    const at = callIn(t, a);
    if (at && (!best || at.length > best.at.length)) best = { agent: a, at };
  }
  if (!best) return null;
  const before = t.slice(0, best.at.index).trimEnd();
  const after = t.slice(best.at.index + best.at.length);
  const brief = (before ? before + after : after.replace(/^[\s,:;]+/, "")).trim();
  if (!brief) return null;
  return { installId: best.agent.id, displayName: best.agent.displayName, brief, canInvoke: best.agent.canInvoke };
}

/** One channel message shared with a request: who wrote it (display name), its text, when. */
export interface SharedMessage {
  author: string;
  text: string;
  at: number;
}

/**
 * How many recent channel messages a request can share (server docs/AI_WORKFORCE.md §2). The server takes at most 150
 * messages and 30,000 characters of text and names, each message cut at 2,000 characters.
 */
export const SHARE_CHOICES = [20, 50, 150] as const;
const SHARE_MAX = 150;
const SHARE_CHARS = 30_000;
const SHARE_MESSAGE_CHARS = 2_000;
const AUTHOR_CHARS = 80;

/**
 * The newest [count] readable messages of a channel, oldest first, as this browser decrypted them: what a request
 * shares when the person chooses to. Deleted, call and undecryptable messages are left out; the oldest are dropped
 * first when the text would pass the server's limit.
 */
export function messagesToShare(items: readonly StoredMessage[], nameOf: (userId: string) => string, count: number): SharedMessage[] {
  const picked: SharedMessage[] = [];
  let chars = 0;
  for (let i = items.length - 1; i >= 0 && picked.length < Math.min(count, SHARE_MAX); i--) {
    const m = items[i]!;
    const text = m.text.trim().slice(0, SHARE_MESSAGE_CHARS);
    if (m.kind !== "text" || m.deleted || !text) continue;
    const author = nameOf(m.senderUserId).slice(0, AUTHOR_CHARS).trim() || "?";
    const cost = text.length + author.length + 2;
    if (chars + cost > SHARE_CHARS) break;
    chars += cost;
    picked.push({ author, text, at: Math.round(m.sortTs) });
  }
  return picked.reverse();
}
