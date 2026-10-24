import { z } from "zod";
import { ApiError } from "../api/client";
import { sealEnvelope } from "../crypto/envelope";
import type { OutboxItem } from "../model/types";
import { parsePayload } from "../protocol/payload";
import type { EngineContext } from "./context";

const zSendRes = z.object({ messageId: z.string(), serverTs: z.number(), duplicate: z.boolean().optional() });

/** Retry delays for transient failures; after the last one the message is marked failed (android MessageRepository). */
const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000];
const OFFLINE_RETRY_MS = 5_000;
/** The server refuses a sentAt more than a day off; older queued messages are re-stamped (android: 20 h). */
const RESTAMP_AFTER_MS = 20 * 3600_000;

/** A recipient's identity key changed: nothing is sent to that conversation until the person reviews it. */
export class IdentityChangedError extends Error {
  constructor() {
    super("A security key in this conversation changed");
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
 * Seals [o] to every current device of the conversation's members and posts it; returns the server's timestamp. Used by
 * the outbox, and directly for what must never be written to storage (a call's media key). A changed device list is
 * refreshed and tried once more; a changed identity key throws [IdentityChangedError].
 */
export async function sealAndPost(ctx: EngineContext, o: Outgoing, refresh = false): Promise<number> {
  const { api, directory, device } = ctx;
  for (const pass of [0, 1]) {
    const r = await directory.recipients(o.conversationId, refresh || pass > 0);
    if (r.changed.length) throw new IdentityChangedError();
    const sealed = await sealEnvelope(
      { messageId: o.messageId, conversationId: o.conversationId, senderUserId: device.userId, senderDeviceId: device.deviceId, sentAt: o.sentAt, cls: o.cls },
      o.payloadJson,
      [...r.devices, ...(await readersFor(ctx, o, r, pass > 0))],
      device.keys.signing.privateKey,
    );
    const mentionAll = o.cls === "message" && parsePayload(o.payloadJson)?.mentionAll === true;
    try {
      const res = await api.json("POST", "/v1/messages", zSendRes, {
        body: {
          conversationId: o.conversationId,
          messageId: o.messageId,
          cls: o.cls,
          sentAt: o.sentAt,
          nonce: sealed.nonce,
          ciphertext: sealed.ciphertext,
          signature: sealed.signature,
          recipients: sealed.recipients,
          ...(mentionAll ? { mentionAll: true } : {}),
        },
      });
      return res.serverTs;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === "device_mismatch" && pass === 0) {
        directory.invalidateConversation(o.conversationId); // someone's devices changed: refresh keys and try once more
        continue;
      }
      throw e;
    }
  }
  throw new ApiError(409, "device_mismatch", "The conversation's devices keep changing. Try again.");
}

/**
 * The AI readers [o] goes to: only text messages and their edits and deletes (never calls, reactions or anything
 * else), and only readers this person chose to share with. No choice yet counts as keep.
 */
async function readersFor(ctx: EngineContext, o: Outgoing, r: Awaited<ReturnType<EngineContext["directory"]["recipients"]>>, force: boolean) {
  if (!r.readers.length) return [];
  const type = parsePayload(o.payloadJson)?.type;
  const shareable = (o.cls === "message" && type === "text") || (o.cls === "control" && (type === "edit" || type === "delete"));
  if (!shareable) return [];
  const choices = await ctx.directory.readerChoices(o.conversationId, force);
  const sharing = new Set(choices.readers.filter((c) => c.myChoice === "share").map((c) => c.readerId));
  return r.readers.filter((x) => sharing.has(x.readerId)).map((x) => ({ deviceId: x.deviceId, encryptionKey: x.encryptionKey }));
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
    const due = (await this.ctx.store.outbox()).filter((o) => !o.held && o.nextAttemptAt <= Date.now()).sort((a, b) => a.createdAt - b.createdAt);
    for (const o of due) {
      if (this.stopped) return;
      if ((await this.sendOne(o)) === "offline") return;
    }
  }

  private async scheduleNext(): Promise<void> {
    if (this.stopped) return;
    clearTimeout(this.timer);
    const pending = (await this.ctx.store.outbox()).filter((o) => !o.held);
    if (!pending.length) return;
    const next = Math.min(...pending.map((o) => o.nextAttemptAt));
    this.timer = setTimeout(() => this.kick(), Math.max(300, Math.min(next - Date.now(), 60_000)));
  }

  private async sendOne(o: OutboxItem): Promise<"done" | "offline"> {
    const { store } = this.ctx;
    try {
      const now = Date.now();
      const sentAt = now - o.createdAt > RESTAMP_AFTER_MS ? now : o.createdAt;
      const serverTs = await sealAndPost(this.ctx, { messageId: o.messageId, conversationId: o.conversationId, cls: o.cls, payloadJson: o.payloadJson, sentAt }, o.attempts > 0);
      await store.removeOutbox(o.messageId);
      if (o.visible) await this.onSent(o.messageId, serverTs);
      return "done";
    } catch (e) {
      if (e instanceof IdentityChangedError) {
        // Paused, not failed: resumes when the person accepts the new key.
        await store.putOutbox({ ...o, held: true, lastError: "identity_changed" });
        if (o.visible) await this.onFailed(o.messageId, "HELD", "Paused: a security key changed");
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
    await store.removeOutbox(o.messageId);
    if (o.visible) await this.onFailed(o.messageId, "FAILED", e instanceof ApiError ? e.message : "Couldn't encrypt this message");
    return "done";
  }
}

/** When a message refused by slowmode may go out: the server's nextPostAt, else its retryAfter, plus a small margin. */
export function slowmodeRetryAt(e: ApiError, now: number): number {
  const d = (e.details ?? {}) as { nextPostAt?: unknown; retryAfter?: unknown };
  const at = typeof d.nextPostAt === "number" ? d.nextPostAt : now + (typeof d.retryAfter === "number" ? d.retryAfter * 1000 : (e.retryAfterMs ?? 5_000));
  return Math.max(now + 250, at + 250);
}
