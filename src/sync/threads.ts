import type { StoredMessage } from "../model/types";

/** A thread the person takes part in, for Activity › Thread replies (android ThreadActivityRules). */
export interface ThreadActivity {
  rootId: string;
  conversationId: string;
  root: StoredMessage | null;
  replies: number;
  /** Replies from others since the person last looked at the thread or replied in it. */
  unseen: number;
  lastReplyAt: number;
  lastReplierId: string;
}

export const THREADS_SHOWN = 30;

/**
 * Threads the person started or replied in, with replies from others they haven't seen: unseen first, then the most
 * recently active. "Seen" is the later of opening the thread here ([seen]) and their own last reply in it.
 */
export function threadActivity(replies: readonly StoredMessage[], roots: ReadonlyMap<string, StoredMessage | null>, seen: Readonly<Record<string, number>>): ThreadActivity[] {
  const byRoot = new Map<string, StoredMessage[]>();
  for (const m of replies) {
    if (!m.threadRootId || m.deleted) continue;
    const list = byRoot.get(m.threadRootId) ?? [];
    list.push(m);
    byRoot.set(m.threadRootId, list);
  }
  const out: ThreadActivity[] = [];
  for (const [rootId, list] of byRoot) {
    const root = roots.get(rootId) ?? null;
    const mine = list.filter((m) => m.outgoing);
    if (!root?.outgoing && mine.length === 0) continue;
    const seenAt = Math.max(seen[rootId] ?? 0, ...mine.map((m) => m.sortTs));
    const last = list[list.length - 1];
    out.push({
      rootId,
      conversationId: last.conversationId,
      root,
      replies: list.length,
      unseen: list.filter((m) => !m.outgoing && m.sortTs > seenAt).length,
      lastReplyAt: last.sortTs,
      lastReplierId: last.senderUserId,
    });
  }
  return out.sort((a, b) => Number(b.unseen > 0) - Number(a.unseen > 0) || b.lastReplyAt - a.lastReplyAt).slice(0, THREADS_SHOWN);
}
