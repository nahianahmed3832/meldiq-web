/**
 * The one rule for unread markers on channel rows, DM rows and community icons (community-first brief §C):
 *
 * - nothing new, or muted with no mention of you: no marker;
 * - exactly one unread event: the row is highlighted, with no number;
 * - two or more: highlighted, with the count (shown as 99+ past 99; the real count stays in the label);
 * - a mention of you: the mention badge, which reads apart from plain unread by colour and its "@".
 *
 * The counts come from this browser's per-conversation counters (sync/locals.ts): others' messages that arrived while the
 * conversation wasn't on screen, each counted once however it arrived (the store inserts a message only once).
 */
/** [direct]: a DM or group's count, in the accent colour: addressed to you, unlike a channel's. */
export type UnreadMarker = { kind: "none" } | { kind: "dot" } | { kind: "count"; text: string; direct?: boolean } | { kind: "mention"; text: string };

/** Counts above this show as "99+". */
export const COUNT_CAP = 99;

export function capCount(n: number): string {
  return n > COUNT_CAP ? `${COUNT_CAP}+` : String(n);
}

/** [direct]: a DM or group, where every message is addressed to you, so even one shows its number. */
export function unreadMarker(unread: number, mentions: number, muted: boolean, direct = false): UnreadMarker {
  if (mentions > 0) return { kind: "mention", text: `@${capCount(mentions)}` };
  if (unread <= 0 || muted) return { kind: "none" };
  if (unread === 1 && !direct) return { kind: "dot" };
  return direct ? { kind: "count", text: capCount(unread), direct } : { kind: "count", text: capCount(unread) };
}

/** Whether a row shows as highlighted (bright text and the side marker). */
export const isHighlighted = (m: UnreadMarker): boolean => m.kind !== "none";

/** What a screen reader hears after the row's name: the real counts, never the capped text. */
export function unreadLabel(unread: number, mentions: number, muted: boolean, words: { unread: (n: number) => string; mentions: (n: number) => string; muted: string }): string {
  const parts = [unread > 0 ? words.unread(unread) : "", mentions > 0 ? words.mentions(mentions) : "", muted ? words.muted : ""].filter(Boolean);
  return parts.length ? `, ${parts.join(", ")}` : "";
}
