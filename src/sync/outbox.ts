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
    const { api, store, directory, device } = this.ctx;
    for (const pass of [0, 1]) {
      try {
        const r = await directory.recipients(o.conversationId, pass > 0 || o.attempts > 0);
        if (r.changed.length) {
          // Paused, not failed: resumes when the person accepts the new key.
          await store.putOutbox({ ...o, held: true, lastError: "identity_changed" });
          if (o.visible) await this.onFailed(o.messageId, "HELD", "Paused: a security key changed");
          await this.ctx.refreshIdentityAlerts();
          return "done";
        }
        const now = Date.now();
        const sentAt = now - o.createdAt > RESTAMP_AFTER_MS ? now : o.createdAt;
        const sealed = await sealEnvelope(
          { messageId: o.messageId, conversationId: o.conversationId, senderUserId: device.userId, senderDeviceId: device.deviceId, sentAt, cls: o.cls },
          o.payloadJson,
          r.devices,
          device.keys.signing.privateKey,
        );
        const mentionAll = o.cls === "message" && parsePayload(o.payloadJson)?.mentionAll === true;
        const res = await api.json("POST", "/v1/messages", zSendRes, {
          body: {
            conversationId: o.conversationId,
            messageId: o.messageId,
            cls: o.cls,
            sentAt,
            nonce: sealed.nonce,
            ciphertext: sealed.ciphertext,
            signature: sealed.signature,
            recipients: sealed.recipients,
            ...(mentionAll ? { mentionAll: true } : {}),
          },
        });
        await store.removeOutbox(o.messageId);
        if (o.visible) await this.onSent(o.messageId, res.serverTs);
        return "done";
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && e.code === "device_mismatch" && pass === 0) {
          directory.invalidateConversation(o.conversationId); // someone's devices changed: refresh keys and try once more
          continue;
        }
        return this.failure(o, e);
      }
    }
    return "done";
  }

  private async failure(o: OutboxItem, e: unknown): Promise<"done" | "offline"> {
    const { store } = this.ctx;
    if (e instanceof ApiError && e.isNetwork) {
      // Offline: wait without using up attempts; the connection coming back kicks the outbox.
      await store.putOutbox({ ...o, nextAttemptAt: Date.now() + OFFLINE_RETRY_MS, lastError: e.message });
      return "offline";
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
