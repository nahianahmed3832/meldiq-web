import type { Member } from "../api/schemas";
import type { MentionSet } from "./rules";

/**
 * `@username` tokens resolved against the conversation's members only (android data/model/Mentions.kt): a token never
 * points at someone outside the conversation. `@everyone` asks for the server's attestation where it's allowed.
 */
const TOKEN = /(?<![\p{L}\p{N}_.@])@([A-Za-z0-9._]{1,24}(?::[A-Za-z0-9.-]{1,253})?)/gu;

export function resolveMentions(text: string, members: Member[], canMentionAll: boolean, myUserId: string): MentionSet {
  if (!text.includes("@")) return { ids: [], all: false };
  const byName = new Map(members.map((m) => [m.username.toLowerCase(), m.id]));
  const ids: string[] = [];
  let all = false;
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1].toLowerCase();
    if (name === "everyone") {
      all = all || canMentionAll;
      continue;
    }
    const id = byName.get(name);
    if (id && id !== myUserId && !ids.includes(id)) ids.push(id);
  }
  return { ids, all };
}

/** The `@query` the caret is in, for suggestions: `@` at a word start and no space up to the caret. */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|[\s(])@([A-Za-z0-9._]{0,24})$/.exec(before);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2].toLowerCase() };
}
