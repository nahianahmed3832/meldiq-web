import type { ConversationLocal, StoredMessage } from "../model/types";
import type { LocalStore } from "../store/db";
import { preview } from "./rules";

const empty = (id: string): ConversationLocal => ({ id, unread: 0, mentions: 0, lastMessageId: null, lastPreview: null, lastSenderName: null, lastActivityAt: 0, readUpTo: 0, draft: "" });

/**
 * What only this browser knows about each conversation (android ConversationEntity's local columns): unread and mention
 * counts, the last message shown in the list, the read position, the draft and archiving. Kept in IndexedDB and
 * published to the app state on every change.
 */
export class ConversationLocals {
  /** The latest change queued for each conversation; the next one starts when it has finished. */
  private chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly store: LocalStore,
    private readonly host: { senderName(userId: string): string | null; publish(l: ConversationLocal): void },
  ) {}

  async get(id: string): Promise<ConversationLocal> {
    return (await this.store.conversation(id)) ?? empty(id);
  }

  async save(l: ConversationLocal): Promise<void> {
    await this.store.putConversation(l);
    this.host.publish(l);
  }

  /**
   * Changes one conversation's row: [change] gets the current row and returns the new one, or null to leave it. Changes
   * to the same conversation run one at a time in the order they were asked for, so none writes back a row it read
   * before another change landed (several messages arriving at once all count; a read on the phone isn't undone by a
   * message arriving meanwhile). A failed change doesn't stop the ones after it.
   */
  update(id: string, change: (l: ConversationLocal) => ConversationLocal | null | Promise<ConversationLocal | null>): Promise<void> {
    const previous = this.chains.get(id) ?? Promise.resolve();
    const next = previous.then(async () => {
      const updated = await change(await this.get(id));
      if (updated) await this.save(updated);
    });
    const settled = next.catch(() => undefined);
    this.chains.set(id, settled);
    // Forget a finished chain, unless another change was queued behind it meanwhile.
    void settled.then(() => {
      if (this.chains.get(id) === settled) this.chains.delete(id);
    });
    return next;
  }

  bump(m: StoredMessage, counts: { unread: boolean; mention: boolean }): Promise<void> {
    return this.update(m.conversationId, (l) => {
      const isLatest = m.threadRootId === null && m.sortTs >= l.lastActivityAt;
      const sender = m.outgoing ? "You" : this.host.senderName(m.senderUserId);
      return {
        ...l,
        ...(isLatest ? { lastMessageId: m.id, lastPreview: preview(m), lastSenderName: sender, lastActivityAt: m.sortTs } : {}),
        unread: l.unread + (counts.unread ? 1 : 0),
        mentions: l.mentions + (counts.mention ? 1 : 0),
      };
    });
  }

  refreshPreview(conversationId: string): Promise<void> {
    return this.update(conversationId, async (l) => {
      const last = await this.store.newestMessage(conversationId, (m) => m.threadRootId === null);
      const sender = last ? (last.outgoing ? "You" : this.host.senderName(last.senderUserId)) : null;
      return { ...l, lastMessageId: last?.id ?? null, lastPreview: last ? preview(last) : null, lastSenderName: sender, lastActivityAt: Math.max(l.lastActivityAt, last?.sortTs ?? 0) };
    });
  }

  readElsewhere(conversationId: string, upTo: number): Promise<void> {
    return this.update(conversationId, (l) => ({ ...l, unread: 0, mentions: 0, readUpTo: Math.max(l.readUpTo, upTo) }));
  }

  setUnread(id: string, unread: boolean): Promise<void> {
    return this.update(id, (l) => (unread ? { ...l, unread: Math.max(1, l.unread) } : { ...l, unread: 0, mentions: 0 }));
  }

  setArchived(id: string, archived: boolean): Promise<void> {
    return this.update(id, (l) => ({ ...l, archivedAt: archived ? Date.now() : null }));
  }

  /** Runs in order with every other change to the conversation, so the last call wins (a late keystroke can't undo "sent"). */
  saveDraft(conversationId: string, text: string): Promise<void> {
    return this.update(conversationId, (l) => (l.draft !== text ? { ...l, draft: text } : null));
  }
}
