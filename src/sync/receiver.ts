import { z } from "zod";
import { ApiError } from "../api/client";
import { type Conversation, type QueueItem, zCall, zQueueItem } from "../api/schemas";
import { EnvelopeError, openEnvelope } from "../crypto/envelope";
import type { StoredMessage } from "../model/types";
import { parsePayload, type Payload } from "../protocol/payload";
import type { EngineContext } from "./context";
import { applyDelete, applyDelivered, applyEdit, applyPin, applyReaction, applyRead, callEntry, receivedMentions, textMessage, undecryptable } from "./rules";

const MAX_FAILURES = 3;
const zCallRes = z.object({ call: zCall });

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
        const id = (r as { id?: unknown } | null)?.id;
        if (typeof id === "number" && Number.isInteger(id)) acks.push(id); // malformed: would only come back again
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

    const sender = await directory.senderKey(item.senderUserId, item.senderDeviceId);
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
    if (!payload) return;
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
        const mentioned = !mine && (mentions.ids.includes(device.userId) || mentions.all);
        await this.ctx.bump(m, { unread: !mine && !viewing, mention: mentioned && !viewing });
        if (viewing && !mine) this.ctx.markReadSoon(item.conversationId);
        if (!mine && !viewing) this.ctx.notifyIncoming(m, conv, mentioned);
        return;
      }
      case "edit":
        return this.change(pl, item, serverTs, (t) => applyEdit(t, item.senderUserId, pl, serverTs));
      case "delete":
        return this.change(pl, item, serverTs, (t) => applyDelete(t, item.senderUserId));
      case "reaction":
        if (!pl.emoji) return;
        return this.change(pl, item, serverTs, (t) => applyReaction(t, item.senderUserId, pl.emoji!, pl.add !== false));
      case "pin":
        return this.change(pl, item, serverTs, (t) => applyPin(t, pl.pinned === true));
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
      default:
        return; // call_key_request (only a call's creator answers) and types from newer apps
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

  /** A call entry, once the server confirms the sender started that call in this conversation (T5.2). */
  private async callInvite(pl: Payload, item: QueueItem, mine: boolean, serverTs: number): Promise<void> {
    if (!pl.callId || (await this.ctx.store.message(`call-${pl.callId}`))) return;
    let call;
    try {
      call = (await this.ctx.api.json("GET", `/v1/calls/${encodeURIComponent(pl.callId)}`, zCallRes)).call;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return;
      throw e;
    }
    if (call.createdBy !== item.senderUserId || call.conversationId !== item.conversationId) return;
    const m = callEntry(item, mine, pl.callId, pl.video === true, serverTs);
    if (!(await this.ctx.store.insertMessageIfAbsent(m))) return;
    this.ctx.show(m);
    await this.ctx.bump(m, { unread: false, mention: false });
  }

  private async receipt(item: QueueItem): Promise<void> {
    if (item.payload.status !== "delivered") return;
    const m = await this.ctx.store.message(item.messageId);
    if (!m || !m.outgoing) return;
    const next = applyDelivered(m, item.senderUserId);
    await this.ctx.store.putMessage(next);
    this.ctx.show(next);
  }

  private async recordUndecryptable(item: QueueItem, reason: string): Promise<void> {
    if ((item.payload.cls ?? "message") !== "message") return;
    const m = undecryptable(item, reason);
    if (await this.ctx.store.insertMessageIfAbsent(m)) this.ctx.show(m);
  }
}
