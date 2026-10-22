import { ApiError } from "../api/client";
import { countsEveryone } from "./navPrefs";
import { type Call, type Conversation, type QueueItem, zCallRes, zQueueItem, zQueueItemIdentity } from "../api/schemas";
import { EnvelopeError, openEnvelope } from "../crypto/envelope";
import type { StoredMessage } from "../model/types";
import { parsePayload, type Payload } from "../protocol/payload";
import type { EngineContext } from "./context";
import { applyDelete, applyDelivered, applyEdit, applyPin, applyReaction, applyRead, callEntry, receivedMentions, textMessage, undecryptable, unsupported } from "./rules";
import { applyClose, applyVote } from "./polls";
import { reactionAllowed } from "./expressions";

const MAX_FAILURES = 3;

/**
 * Turns delivery-queue items into this browser's state (android MessageRepository.handleItem / apply). An item is
 * acknowledged only once its effect is stored, or it was deliberately dropped (undecryptable, unknown type, duplicate).
 * A transient failure (keys unreachable) leaves it unacknowledged, so the server delivers it again.
 */
export class Receiver {
  private failures = new Map<number, number>();

  constructor(private readonly ctx: EngineContext) {}

  async process(raw: unknown[]): Promise<number[]> {
    const acks: number[] = [];
    for (const r of raw) {
      const parsed = zQueueItem.safeParse(r);
      if (!parsed.success) {
        // A newer item kind or payload: a placeholder in its conversation, acknowledged once it's stored. Only an item
        // that names no message (or a receipt, which isn't one) is acknowledged without a trace: it would only come back.
        const id = (r as { id?: unknown } | null)?.id;
        if (typeof id !== "number" || !Number.isInteger(id)) continue;
        try {
          await this.recordUnreadable(r);
          acks.push(id);
        } catch {
          /* the store is unavailable: delivered again later */
        }
        continue;
      }
      const item = parsed.data;
      try {
        await this.handle(item);
        this.failures.delete(item.id);
        acks.push(item.id);
      } catch (e) {
        if (e instanceof ApiError && e.isTransient) continue;
        const n = (this.failures.get(item.id) ?? 0) + 1;
        this.failures.set(item.id, n);
        if (n >= MAX_FAILURES) {
          await this.recordUndecryptable(item, "couldn't be processed").catch(() => undefined);
          this.failures.delete(item.id);
          acks.push(item.id);
        }
      }
    }
    return acks;
  }

  /** Opens envelopes held while their sender's identity was untrusted, after the person accepted the new key. */
  async releaseHeld(userId: string): Promise<void> {
    for (const h of await this.ctx.store.heldFrom(userId)) {
      try {
        await this.handle(h.item);
        await this.ctx.store.releaseHeld(h.queueId);
      } catch {
        /* keys unreachable: tried again on the next acceptance */
      }
    }
  }

  private async handle(item: QueueItem): Promise<void> {
    const { store, directory, device } = this.ctx;
    if (item.kind === "receipt") return this.receipt(item);
    const p = item.payload;
    const cls = p.cls ?? "message";
    const existing = await store.message(item.messageId);
    const placeholder = existing?.kind === "undecryptable" && existing.senderUserId === item.senderUserId;
    if (existing && cls === "message" && !placeholder) return; // a duplicate delivery

    const sender = await directory.senderKey(item.senderUserId, item.senderDeviceId, p.serverTs ?? item.createdAt);
    if (sender.kind === "changed") {
      await store.hold(item);
      await this.ctx.refreshIdentityAlerts();
      return;
    }
    if (sender.kind === "unknown") return this.recordUndecryptable(item, "unknown or uncertified sender device");
    if (!p.nonce || !p.ciphertext || !p.signature || !p.enc || !p.wrappedKey) return this.recordUndecryptable(item, "malformed envelope");

    let json: string;
    try {
      json = await openEnvelope(
        {
          header: { messageId: item.messageId, conversationId: item.conversationId, senderUserId: item.senderUserId, senderDeviceId: item.senderDeviceId, sentAt: p.sentAt ?? 0, cls },
          nonce: p.nonce,
          ciphertext: p.ciphertext,
          signature: p.signature,
          enc: p.enc,
          wrappedKey: p.wrappedKey,
        },
        sender.signingKey,
        device.deviceId,
        device.keys.encryption,
      );
    } catch (e) {
      if (e instanceof EnvelopeError) return this.recordUndecryptable(item, e.message);
      throw e;
    }
    const payload = parsePayload(json);
    if (!payload) return this.recordUnsupported(item, "unreadable payload");
    const conversation = await this.ctx.ensureConversation(item.conversationId);
    await this.apply(payload, item, conversation, item.senderUserId === device.userId, p.serverTs ?? item.createdAt, placeholder);
  }

  private async apply(pl: Payload, item: QueueItem, conv: Conversation | null, mine: boolean, serverTs: number, replacesPlaceholder: boolean): Promise<void> {
    const { store, device } = this.ctx;
    switch (pl.type) {
      case "text": {
        const mentions = receivedMentions(pl, item.payload.mentionAll === true, conv?.type ?? null);
        const m = textMessage(pl, item, mine, serverTs, mentions);
        if (replacesPlaceholder) await store.putMessage(m);
        else if (!(await store.insertMessageIfAbsent(m))) return;
        if (!mine) await this.ctx.ensureUser(item.senderUserId);
        this.ctx.show(m);
        await this.replayPending(item.conversationId, item.messageId);
        const viewing = this.ctx.viewing() === item.conversationId;
        // Batch B2: a community whose settings ignore @everyone treats it as an ordinary message (no mention, no badge).
        const all = mentions.all && (!conv?.orgId || countsEveryone(this.ctx.state.get().nav[conv.orgId]));
        const mentioned = !mine && (mentions.ids.includes(device.userId) || all);
        await this.ctx.bump(m, { unread: !mine && !viewing, mention: mentioned && !viewing });
        if (viewing && !mine) this.ctx.markReadSoon(item.conversationId);
        if (!mine && !viewing) this.ctx.notifyIncoming(m, conv, mentions.ids.includes(device.userId) ? "me" : all ? "all" : null);
        return;
      }
      case "edit":
        return this.change(pl, item, serverTs, (t) => applyEdit(t, item.senderUserId, pl, serverTs));
      case "delete":
        return this.change(pl, item, serverTs, (t) => applyDelete(t, item.senderUserId));
      case "reaction":
        // One emoji, not text: anything else from a modified client is dropped (meldiq docs/EMOJI.md). In a community's
        // channels a community emoji's :name: is a reaction too (batch B12).
        if (!reactionAllowed(pl.emoji, conv?.type === "CHANNEL" && !!conv.orgId)) return;
        return this.change(pl, item, serverTs, (t) => applyReaction(t, item.senderUserId, pl.emoji!, pl.add !== false));
      case "pin":
        return this.change(pl, item, serverTs, (t) => applyPin(t, pl.pinned === true));
      case "vote":
        // A poll vote (docs/RICH_MESSAGES.md › Polls): replaces the voter's earlier one; only real options count.
        return this.change(pl, item, serverTs, (t) => (t.rich?.poll && !t.deleted ? { ...t, rich: applyVote(t.rich, item.senderUserId, pl.choices ?? [], serverTs) } : null));
      case "poll_close":
        // Only from the poll's own sender.
        return this.change(pl, item, serverTs, (t) => (t.rich?.poll && t.senderUserId === item.senderUserId ? { ...t, rich: applyClose(t.rich, t.senderUserId, item.senderUserId) } : null));
      case "read": {
        if (pl.upTo === undefined) return;
        if (mine) return this.ctx.readElsewhere(item.conversationId, pl.upTo);
        for (const m of await store.outgoingUpTo(item.conversationId, pl.upTo)) {
          const r = applyRead(m, item.senderUserId);
          await store.putMessage(r);
          this.ctx.show(r);
        }
        return;
      }
      case "call_invite":
        return this.callInvite(pl, item, mine, serverTs);
      case "call_key_request":
        // Only a call's creator answers, in the call's own conversation, while it's live (T5.3; call/manager.ts).
        if (pl.callId) await this.ctx.calls.onKeyRequest(pl.callId, item.conversationId);
        return;
      default:
        // Types from newer apps: a message gets a placeholder; a control (cls "control") is ignored.
        if ((item.payload.cls ?? "message") === "message") return this.recordUnsupported(item, `payload type ${pl.type.slice(0, 40)}`);
        return;
    }
  }

  /** Edits, deletions, reactions and pins: only for a message in the control's own conversation (T3.4). */
  private async change(pl: Payload, item: QueueItem, serverTs: number, fn: (t: StoredMessage) => StoredMessage | null): Promise<void> {
    if (!pl.target) return;
    const t = await this.ctx.store.message(pl.target);
    if (!t) {
      // The message it refers to hasn't arrived yet: kept and applied when it does (T2.1).
      await this.ctx.store.holdControl({
        id: item.messageId,
        conversationId: item.conversationId,
        target: pl.target,
        senderUserId: item.senderUserId,
        payloadJson: JSON.stringify(pl),
        serverTs,
        receivedAt: Date.now(),
      });
      return;
    }
    if (t.conversationId !== item.conversationId) return;
    const next = fn(t);
    if (!next) return;
    await this.ctx.store.putMessage(next);
    this.ctx.show(next);
    if (pl.type === "edit" || pl.type === "delete") await this.ctx.refreshPreview(t.conversationId);
  }

  private async replayPending(conversationId: string, messageId: string): Promise<void> {
    for (const c of await this.ctx.store.takeControls(conversationId, messageId)) {
      const pl = parsePayload(c.payloadJson);
      if (!pl) continue;
      const item: QueueItem = {
        id: 0,
        kind: "envelope",
        conversationId,
        messageId: c.id,
        senderUserId: c.senderUserId,
        senderDeviceId: "",
        createdAt: c.serverTs,
        expiresAt: c.serverTs,
        payload: { cls: "control", serverTs: c.serverTs },
      };
      await this.apply(pl, item, null, c.senderUserId === this.ctx.device.userId, c.serverTs, false);
    }
  }

  /**
   * A call's media key (kept in memory by the call manager, only from the call's creator or, in a voice room, someone
   * connected to it: T5.2) and the call's entry in the conversation, once the server confirms the sender started that
   * call in this conversation (none for voice rooms).
   */
  private async callInvite(pl: Payload, item: QueueItem, mine: boolean, serverTs: number): Promise<void> {
    if (!pl.callId) return;
    const call = await this.serverCall(pl.callId);
    if (pl.e2eeKey) this.ctx.calls.onInvite(pl.callId, item.conversationId, item.senderUserId, pl.e2eeKey, call);
    if (!call || call.voiceRoom || call.createdBy !== item.senderUserId || call.conversationId !== item.conversationId) return;
    if (await this.ctx.store.message(`call-${pl.callId}`)) return;
    const m = callEntry(item, mine, pl.callId, pl.video === true, serverTs);
    if (!(await this.ctx.store.insertMessageIfAbsent(m))) return;
    this.ctx.show(m);
    await this.ctx.bump(m, { unread: false, mention: false });
  }

  /** The server's record of a call; null when it doesn't exist for this account. */
  private async serverCall(callId: string): Promise<Call | null> {
    try {
      return (await this.ctx.api.json("GET", `/v1/calls/${encodeURIComponent(callId)}`, zCallRes)).call;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  private async receipt(item: QueueItem): Promise<void> {
    if (item.payload.status !== "delivered") return;
    const m = await this.ctx.store.message(item.messageId);
    if (!m || !m.outgoing) return;
    const next = applyDelivered(m, item.senderUserId);
    await this.ctx.store.putMessage(next);
    this.ctx.show(next);
  }

  /** A queue item that doesn't parse: a placeholder when it names a message (receipts and controls aren't messages). */
  private async recordUnreadable(raw: unknown): Promise<void> {
    const who = zQueueItemIdentity.safeParse(raw);
    if (!who.success || who.data.kind === "receipt") return;
    const cls = (raw as { payload?: { cls?: unknown } }).payload?.cls;
    if (cls === "control") return;
    await this.recordUnsupported({ ...who.data, kind: "envelope", payload: {} }, `queue item kind ${who.data.kind.slice(0, 40)}`);
  }

  private async recordUnsupported(item: QueueItem, reason: string): Promise<void> {
    if ((item.payload.cls ?? "message") !== "message") return;
    const m = unsupported(item, reason);
    if (await this.ctx.store.insertMessageIfAbsent(m)) {
      this.ctx.show(m);
      await this.ctx.bump(m, { unread: this.ctx.viewing() !== item.conversationId, mention: false });
    }
  }

  private async recordUndecryptable(item: QueueItem, reason: string): Promise<void> {
    if ((item.payload.cls ?? "message") !== "message") return;
    const m = undecryptable(item, reason);
    if (await this.ctx.store.insertMessageIfAbsent(m)) this.ctx.show(m);
  }
}
