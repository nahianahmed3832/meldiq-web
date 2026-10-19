import type { RichContent } from "../model/types";
import type { Poll } from "../protocol/payload";

/**
 * Polls (docs/RICH_MESSAGES.md › Polls; android data/model/PollRules.kt, the same rules). A poll and its votes come from
 * other devices, so everything is bounded and checked; a vote counts only for options the poll really has. Votes travel
 * as end-to-end encrypted "vote" controls; only the poll's own sender can close it.
 */
export const MAX_QUESTION = 300;
export const MAX_OPTION = 100;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;
const OPTION_ID = /^[A-Za-z0-9_-]{1,16}$/;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** A received or composed poll, cleaned; null when it isn't usable (no question, fewer than two options). */
export function cleanPoll(p: Poll | null | undefined): Poll | null {
  if (!p) return null;
  const question = squash(p.question).slice(0, MAX_QUESTION);
  if (!question) return null;
  const seen = new Set<string>();
  const options = p.options
    .filter((o) => OPTION_ID.test(o.id) && !seen.has(o.id) && (seen.add(o.id), true))
    .map((o) => ({ id: o.id, text: squash(o.text).slice(0, MAX_OPTION) }))
    .filter((o) => o.text)
    .slice(0, MAX_OPTIONS);
  return options.length < MIN_OPTIONS ? null : { question, options, multi: p.multi === true };
}

/** A poll from the composer's fields: blank options dropped, ids "o1", "o2", … in order; null when it isn't valid. */
export function composePoll(question: string, options: readonly string[], multi: boolean): Poll | null {
  return cleanPoll({
    question,
    options: options
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: `o${i + 1}`, text })),
    multi,
  });
}

/** [voter]'s vote: their earlier choices replaced (unknown options dropped, one unless several are allowed; empty takes it back). */
export function applyVote(rich: RichContent, voter: string, choices: readonly string[]): RichContent {
  const poll = rich.poll;
  if (!poll || rich.pollClosed) return rich;
  const valid = new Set(poll.options.map((o) => o.id));
  const unique = [...new Set(choices.filter((c) => valid.has(c)))];
  const picked = poll.multi ? unique : unique.slice(0, 1);
  const votes = { ...(rich.votes ?? {}) };
  if (picked.length) votes[voter] = picked;
  else delete votes[voter];
  return { ...rich, votes };
}

/** Closed by its creator: only the poll's own sender can close it. */
export function applyClose(rich: RichContent, pollSender: string, closer: string): RichContent {
  return !rich.poll || pollSender !== closer ? rich : { ...rich, pollClosed: true };
}

/** Votes per option (every option listed, zero included), in the poll's order. */
export function tally(rich: RichContent): { id: string; text: string; votes: number }[] {
  const counts = new Map<string, number>();
  for (const choice of Object.values(rich.votes ?? {}).flat()) counts.set(choice, (counts.get(choice) ?? 0) + 1);
  return (rich.poll?.options ?? []).map((o) => ({ ...o, votes: counts.get(o.id) ?? 0 }));
}

/** How many people voted (not how many choices). */
export function voters(rich: RichContent): number {
  return Object.values(rich.votes ?? {}).filter((v) => v.length > 0).length;
}

/** The text older apps and notifications show. */
export function pollFallback(p: Poll): string {
  return `📊 ${p.question}\n${p.options.map((o, i) => `${i + 1}. ${o.text}`).join("\n")}`;
}
