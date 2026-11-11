import { text as uiText } from "../i18n";
import { z } from "zod";
import { ApiError } from "../api/client";
import type { OutboxItem } from "../model/types";
import { parsePayload } from "../protocol/payload";
import type { EngineContext } from "./context";
import { rulesRefusalOrg, withMustAgree } from "./rulesChannel";
import { orgAfterRefusal, refusalNote } from "./channelGates";
import { setComposerNote } from "./composerNotes";
const zSendRes = z.object({ messageId: z.string(), serverTs: z.number(), duplicate: z.boolean().optional() });
/** Retry delays for transient failures; after the last one the message is marked failed (android MessageRepository). */
const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000, 120000];
const OFFLINE_RETRY_MS = 5000;
/** The server refuses a sentAt more than a day off; older queued messages are re-stamped (android: 20 h). */
const RESTAMP_AFTER_MS = 20 * 3600000;
/** A recipient's identity key changed: nothing is sent to that conversation until the person reviews it. */
export class IdentityChangedError extends Error {
  constructor() {
    super(uiText("workspace.interface.a_security_key_in_this_conversation_changed_bacf729"));
    this.name = "IdentityChangedError";
  }
}
export interface Outgoing {
  messageId: string;
  conversationId: string;
  cls: "message" | "control";
  payloadJson: string;
  sentAt: number;
}
/**
 * Posts [o] to the server, which stores it and delivers it to every member's devices (API 0.57.0, docs/SERVER_MESSAGES.md);
 * returns the server's timestamp. Used by the outbox, and directly for what isn't queued (a call's media key). Retries
 * with the same message id are answered as duplicates, so posting twice never sends twice.
 */
export async function sealAndPost(ctx: EngineContext, o: Outgoing, _refresh = false, audience?: "self"): Promise<number> {
  const payload = JSON.parse(o.payloadJson) as Record<string, unknown>;
  const mentionAll = o.cls === "message" && parsePayload(o.payloadJson)?.mentionAll === true;
  const res = await ctx.api.json("POST", "/v2/messages", zSendRes, {
    body: {
      conversationId: o.conversationId,
      messageId: o.messageId,
      cls: o.cls,
      sentAt: o.sentAt,
      payload,
      ...(mentionAll ? { mentionAll: true } : {}),
      ...(audience ? { audience } : {}),
    },
  });
  ctx.acceptedInTab?.({
    id: o.messageId,
    conversationId: o.conversationId,
    senderUserId: ctx.device.userId,
    senderDeviceId: ctx.device.deviceId,
    cls: o.cls,
    sentAt: o.sentAt,
    serverTs: res.serverTs,
    payload,
    mentionAll,
    importedBy: null,
  });
  return res.serverTs;
}
/**
 * Sends what this browser queued, oldest first. A message is shown at once as "sending" and becomes authoritative only
 * when the server accepts it: then it takes the server's time. Message ids make retries idempotent on the server.
 */
export class Outbox {
  private running = false;
  private again = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly ctx: EngineContext,
    private readonly onSent: (messageId: string, serverTs: number) => Promise<void>,
    private readonly onFailed: (messageId: string, status: "FAILED" | "HELD", reason: string) => Promise<void>,
  ) {}
  kick(): void {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    void this.run();
  }
  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }
  /** Resolves when nothing is being sent (tests). */
  async settle(): Promise<void> {
    while (this.running) await new Promise((r) => setTimeout(r, 10));
  }
  private async run(): Promise<void> {
    this.running = true;
    try {
      do {
        this.again = false;
        await this.drain();
      } while (this.again && !this.stopped);
    } finally {
      this.running = false;
    }
    await this.scheduleNext();
  }
  private async drain(): Promise<void> {
    const pending = (await this.ctx.store.outbox()).sort((a, b) => a.createdAt - b.createdAt);
    const blocked = new Set<string>();
    for (const o of pending) {
      if (this.stopped) return;
      if (blocked.has(o.conversationId)) continue;
      if (o.held || o.nextAttemptAt > Date.now()) {
        blocked.add(o.conversationId);
        continue;
      }
      if ((await this.sendOne(o)) === "offline") return;
      if ((await this.ctx.store.outbox()).some((item) => item.messageId === o.messageId)) blocked.add(o.conversationId);
    }
  }
  private async scheduleNext(): Promise<void> {
    if (this.stopped) return;
    clearTimeout(this.timer);
    const first = new Map<string, OutboxItem>();
    for (const item of (await this.ctx.store.outbox()).sort((a, b) => a.createdAt - b.createdAt)) if (!first.has(item.conversationId)) first.set(item.conversationId, item);
    const pending = [...first.values()].filter((item) => !item.held);
    if (!pending.length) return;
    const next = Math.min(...pending.map((o) => o.nextAttemptAt));
    this.timer = setTimeout(() => this.kick(), Math.max(300, Math.min(next - Date.now(), 60000)));
  }
  private async sendOne(o: OutboxItem): Promise<"done" | "offline"> {
    const { store } = this.ctx;
    let accepted = false;
    try {
      const now = Date.now();
      const sentAt = now - o.createdAt > RESTAMP_AFTER_MS ? now : o.createdAt;
      const serverTs = await sealAndPost(this.ctx, { messageId: o.messageId, conversationId: o.conversationId, cls: o.cls, payloadJson: o.payloadJson, sentAt }, o.attempts > 0);
      accepted = true;
      // Publish acceptance before removing the retry source. A crash between these steps safely retries the same ID.
      if (o.visible) await this.onSent(o.messageId, serverTs);
      await store.removeOutbox(o.messageId);
      return "done";
    } catch (e) {
      if (accepted) {
        // A local write failed after durable server acceptance. Keep the original ID for reconciliation.
        await store.putOutbox({ ...o, nextAttemptAt: Date.now() + OFFLINE_RETRY_MS });
        return "done";
      }
      if (e instanceof IdentityChangedError) {
        // Paused, not failed: resumes when the person accepts the new key.
        await store.putOutbox({ ...o, held: true, lastError: "identity_changed" });
        if (o.visible) await this.onFailed(o.messageId, "HELD", uiText("workspace.interface.paused_a_security_key_changed_8f21b24"));
        await this.ctx.refreshIdentityAlerts();
        return "done";
      }
      return this.failure(o, e);
    }
  }
  private async failure(o: OutboxItem, e: unknown): Promise<"done" | "offline"> {
    const { store } = this.ctx;
    if (e instanceof ApiError && e.isNetwork) {
      // Offline: wait without using up attempts; the connection coming back kicks the outbox.
      await store.putOutbox({ ...o, nextAttemptAt: Date.now() + OFFLINE_RETRY_MS, lastError: e.message });
      return "offline";
    }
    // Batch B3 slowmode: the server says when this person may post next. The message waits until then, as on the phone,
    // without using up its attempts (a slowmode can be hours long).
    if (e instanceof ApiError && e.code === "slowmode") {
      await store.putOutbox({ ...o, nextAttemptAt: slowmodeRetryAt(e, Date.now()), lastError: e.message });
      return "done";
    }
    if (e instanceof ApiError && e.isTransient && o.attempts + 1 < BACKOFF_MS.length) {
      const wait = Math.max(BACKOFF_MS[o.attempts] ?? BACKOFF_MS[BACKOFF_MS.length - 1], e.retryAfterMs ?? 0);
      await store.putOutbox({ ...o, attempts: o.attempts + 1, nextAttemptAt: Date.now() + wait, lastError: e.message });
      return "done";
    }
    // API 0.65.0: the community asks members to agree to its rules first. The agree prompt shows at once (the community
    // list may not know yet), and the message fails with the server's reason.
    const rulesOrg = rulesRefusalOrg(e);
    if (rulesOrg) this.ctx.state.update((s) => ({ ...s, orgs: withMustAgree(s.orgs, rulesOrg) }));
    // Community parity A: content rules, the lock, verification and onboarding say why above the composer.
    const note = refusalNote(e);
    if (note) {
      setComposerNote(o.conversationId, note);
      const orgId = this.ctx.state.get().conversations[o.conversationId]?.orgId;
      if (orgId) this.ctx.state.update((s) => ({ ...s, orgs: s.orgs.map((x) => (x.id === orgId ? orgAfterRefusal(x, e) : x)) }));
    }
    if (o.visible) await this.onFailed(o.messageId, "FAILED", note ?? (e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_send_this_message_392d75f")));
    await store.removeOutbox(o.messageId);
    return "done";
  }
}
/** When a message refused by slowmode may go out: the server's nextPostAt, else its retryAfter, plus a small margin. */
export function slowmodeRetryAt(e: ApiError, now: number): number {
  const d = (e.details ?? {}) as {
    nextPostAt?: unknown;
    retryAfter?: unknown;
  };
  const at = typeof d.nextPostAt === "number" ? d.nextPostAt : now + (typeof d.retryAfter === "number" ? d.retryAfter * 1000 : (e.retryAfterMs ?? 5000));
  return Math.max(now + 250, at + 250);
}
