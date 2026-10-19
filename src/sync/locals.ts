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
  private draftWrites = new Map<string, Promise<void>>();

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

  async bump(m: StoredMessage, counts: { unread: boolean; mention: boolean }): Promise<void> {
    const l = await this.get(m.conversationId);
    const isLatest = m.threadRootId === null && m.sortTs >= l.lastActivityAt;
    const sender = m.outgoing ? "You" : this.host.senderName(m.senderUserId);
    await this.save({
      ...l,
      ...(isLatest ? { lastMessageId: m.id, lastPreview: preview(m), lastSenderName: sender, lastActivityAt: m.sortTs } : {}),
      unread: l.unread + (counts.unread ? 1 : 0),
      mentions: l.mentions + (counts.mention ? 1 : 0),
    });
  }

  async refreshPreview(conversationId: string): Promise<void> {
    const l = await this.get(conversationId);
    const last = await this.store.newestMessage(conversationId, (m) => m.threadRootId === null);
    const sender = last ? (last.outgoing ? "You" : this.host.senderName(last.senderUserId)) : null;
    await this.save({ ...l, lastMessageId: last?.id ?? null, lastPreview: last ? preview(last) : null, lastSenderName: sender, lastActivityAt: Math.max(l.lastActivityAt, last?.sortTs ?? 0) });
  }

  async readElsewhere(conversationId: string, upTo: number): Promise<void> {
    const l = await this.get(conversationId);
    await this.save({ ...l, unread: 0, mentions: 0, readUpTo: Math.max(l.readUpTo, upTo) });
  }

  async setUnread(id: string, unread: boolean): Promise<void> {
    const l = await this.get(id);
    await this.save(unread ? { ...l, unread: Math.max(1, l.unread) } : { ...l, unread: 0, mentions: 0 });
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    const l = await this.get(id);
    await this.save({ ...l, archivedAt: archived ? Date.now() : null });
  }

  /** Writes for one conversation run in order, so the last call wins (a late keystroke save can't undo "sent"). */
  saveDraft(conversationId: string, text: string): Promise<void> {
    const previous = this.draftWrites.get(conversationId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const l = await this.get(conversationId);
      if (l.draft !== text) await this.save({ ...l, draft: text });
    });
    this.draftWrites.set(
      conversationId,
      next.catch(() => undefined),
    );
    return next;
  }
}
