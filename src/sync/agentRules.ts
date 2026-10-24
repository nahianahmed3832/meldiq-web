import type { StoredMessage } from "../model/types";

/**
 * How a message in a channel asks an AI agent (server docs/AI_WORKFORCE.md §3): "@Name …" for agents activated by
 * mention, "/name …" for agents activated by command. Agents set to "explicit" only answer the Ask an agent dialog.
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

/** The agent [text] asks and what it asks, or null when it's an ordinary message. The longest matching name wins. */
export function agentInvocation(text: string, agents: readonly InvocableAgent[]): Invocation | null {
  const t = text.trimStart();
  let best: { agent: InvocableAgent; rest: string; length: number } | null = null;
  for (const a of agents) {
    const prefix = a.activation === "mention" ? `@${a.displayName}` : a.activation === "command" ? `/${commandName(a.displayName)}` : null;
    if (!prefix || prefix.length < 2) continue;
    if (t.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) continue;
    const after = t.slice(prefix.length);
    // The name must end there: "@Reel Maker2" isn't "@Reel Maker".
    if (after && !/^[\s,:;.!?]/.test(after)) continue;
    if (!best || prefix.length > best.length) best = { agent: a, rest: after.replace(/^[\s,:;]+/, ""), length: prefix.length };
  }
  if (!best || !best.rest.trim()) return null;
  return { installId: best.agent.id, displayName: best.agent.displayName, brief: best.rest.trim(), canInvoke: best.agent.canInvoke };
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
