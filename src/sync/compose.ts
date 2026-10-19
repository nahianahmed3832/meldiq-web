import { ApiError } from "../api/client";
import type { DeviceRecord, OutboxItem, RichContent, StoredMessage } from "../model/types";
import { encodePayload, type Payload } from "../protocol/payload";
import type { AppState } from "../state/store";
import type { LocalStore } from "../store/db";
import type { Member } from "../api/schemas";
import { resolveMentions } from "./mentions";
import { applyPin, applyReaction } from "./rules";
import { applyClose, applyVote } from "./polls";

/** What sending needs from the engine. */
export interface ComposeHost {
  store: LocalStore;
  device: DeviceRecord;
  state(): AppState;
  membersOf(conversationId: string): Promise<Member[]>;
  show(m: StoredMessage): void;
  bump(m: StoredMessage, counts: { unread: boolean; mention: boolean }): Promise<void>;
  refreshPreview(conversationId: string): Promise<void>;
  queue(o: OutboxItem): Promise<void>;
}

/**
 * What this browser sends into conversations: messages (shown at once, sent by the outbox), retries, and the controls
 * that change messages for everyone: reactions, edits, deletions and pins (android MessageRepository).
 */
export class Compose {
  constructor(private readonly host: ComposeHost) {}

  private canPost(conversationId: string): boolean {
    return this.host.state().conversations[conversationId]?.canPost === true;
  }

  /**
   * Sends a message. [rich]: a contact card, location or animated emoji, whose readable form goes in [text] for apps that
   * don't show them (android RichRules.fallbackText). [forwarded]: marked "Forwarded"; mentions aren't carried over.
   */
  async sendText(
    conversationId: string,
    text: string,
    opts: { replyTo?: string; threadRoot?: string; attachments?: Payload["attachments"]; presetId?: string; rich?: RichContent | null; forwarded?: boolean } = {},
  ): Promise<string> {
    const conv = this.host.state().conversations[conversationId];
    if (!conv?.canPost) throw new ApiError(403, "forbidden", conv?.archived ? "This channel is archived" : "You can't post in this conversation");
    const body = text.trim();
    const mentions =
      conv.type === "DM" || opts.forwarded || opts.rich
        ? { ids: [], all: false }
        : resolveMentions(body, await this.host.membersOf(conversationId).catch(() => []), conv.canMentionAll, this.host.device.userId);
    const payload: Payload = {
      type: "text",
      text: body,
      replyTo: opts.replyTo,
      threadRoot: opts.threadRoot,
      mentions: mentions.ids.length ? mentions.ids : undefined,
      mentionAll: mentions.all ? true : undefined,
      attachments: opts.attachments?.length ? opts.attachments : undefined,
      contact: opts.rich?.contact,
      location: opts.rich?.location,
      animoji: opts.rich?.animoji,
      link: opts.rich?.link,
      poll: opts.rich?.poll,
      sticker: opts.rich?.sticker,
      forwarded: opts.forwarded ? true : undefined,
    };
    const id = opts.presetId ?? crypto.randomUUID();
    const now = Date.now();
    const existing = await this.host.store.message(id);
    const m: StoredMessage = {
      id,
      conversationId,
      senderUserId: this.host.device.userId,
      senderDeviceId: this.host.device.deviceId,
      outgoing: true,
      kind: "text",
      text: body,
      replyToId: opts.replyTo ?? null,
      threadRootId: opts.threadRoot ?? null,
      mentions: mentions.ids,
      mentionAll: mentions.all,
      attachments: opts.attachments ?? [],
      sentAt: existing?.sentAt ?? now,
      serverTs: null,
      sortTs: existing?.sortTs ?? now,
      status: "SENDING",
      errorText: null,
      editedAt: null,
      deleted: false,
      pinned: false,
      reactions: {},
      readBy: [],
      deliveredTo: [],
      call: null,
      rich: opts.rich ?? null,
      forwarded: opts.forwarded === true,
    };
    await this.host.store.putMessage(m);
    await this.host.queue({
      messageId: id,
      conversationId,
      cls: "message",
      payloadJson: encodePayload(payload),
      createdAt: now,
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      visible: true,
      held: false,
    });
    this.host.show(m);
    await this.host.bump(m, { unread: false, mention: false });
    return id;
  }

  async retry(messageId: string): Promise<void> {
    const m = await this.host.store.message(messageId);
    if (!m || m.status !== "FAILED") return;
    await this.sendText(m.conversationId, m.text, {
      replyTo: m.replyToId ?? undefined,
      threadRoot: m.threadRootId ?? undefined,
      attachments: m.attachments,
      presetId: m.id,
      rich: m.rich,
      forwarded: m.forwarded,
    });
  }

  async react(m: StoredMessage, emoji: string): Promise<void> {
    if (!this.canPost(m.conversationId)) return;
    const fresh = (await this.host.store.message(m.id)) ?? m;
    const add = !(fresh.reactions[emoji] ?? []).includes(this.host.device.userId);
    const next = applyReaction(fresh, this.host.device.userId, emoji, add);
    await this.host.store.putMessage(next);
    this.host.show(next);
    await this.enqueueControl(m.conversationId, { type: "reaction", target: m.id, emoji, add });
  }

  /** This person's vote on a poll (empty takes it back): shown at once, then sent as an encrypted "vote" control. */
  async vote(m: StoredMessage, choices: string[]): Promise<void> {
    if (!this.canPost(m.conversationId)) return;
    const fresh = (await this.host.store.message(m.id)) ?? m;
    if (!fresh.rich?.poll || fresh.rich.pollClosed) return;
    const rich = applyVote(fresh.rich, this.host.device.userId, choices);
    const next = { ...fresh, rich };
    await this.host.store.putMessage(next);
    this.host.show(next);
    await this.enqueueControl(m.conversationId, { type: "vote", target: m.id, choices: rich.votes?.[this.host.device.userId] ?? [] });
  }

  /** Closes this person's own poll: no more votes from anyone. */
  async closePoll(m: StoredMessage): Promise<void> {
    if (!m.outgoing || !m.rich?.poll || !this.canPost(m.conversationId)) return;
    const next = { ...m, rich: applyClose(m.rich, m.senderUserId, this.host.device.userId) };
    await this.host.store.putMessage(next);
    this.host.show(next);
    await this.enqueueControl(m.conversationId, { type: "poll_close", target: m.id });
  }

  async edit(m: StoredMessage, text: string): Promise<void> {
    if (!m.outgoing || m.deleted || !this.canPost(m.conversationId)) return;
    const body = text.trim();
    if (!body) return;
    const conv = this.host.state().conversations[m.conversationId];
    const ids = conv && conv.type !== "DM" ? resolveMentions(body, await this.host.membersOf(m.conversationId).catch(() => []), false, this.host.device.userId).ids : [];
    const next = { ...m, text: body, editedAt: Date.now(), mentions: ids };
    await this.host.store.putMessage(next);
    this.host.show(next);
    await this.host.refreshPreview(m.conversationId);
    await this.enqueueControl(m.conversationId, { type: "edit", target: m.id, text: body, mentions: ids });
  }

  async deleteForEveryone(m: StoredMessage): Promise<void> {
    if (!m.outgoing || !this.canPost(m.conversationId)) return;
    const next = { ...m, deleted: true, text: "", attachments: [], rich: null };
    await this.host.store.putMessage(next);
    this.host.show(next);
    await this.host.refreshPreview(m.conversationId);
    await this.enqueueControl(m.conversationId, { type: "delete", target: m.id });
  }

  async setPinned(m: StoredMessage, pinned: boolean): Promise<void> {
    if (!this.canPost(m.conversationId)) return;
    const next = applyPin(m, pinned);
    await this.host.store.putMessage(next);
    this.host.show(next);
    await this.enqueueControl(m.conversationId, { type: "pin", target: m.id, pinned });
  }

  async enqueueControl(conversationId: string, payload: Payload): Promise<void> {
    await this.host.queue({
      messageId: crypto.randomUUID(),
      conversationId,
      cls: "control",
      payloadJson: encodePayload(payload),
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      visible: false,
      held: false,
    });
  }
}
