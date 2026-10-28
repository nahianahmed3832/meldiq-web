import { z } from "zod";
import { ApiError, type ApiClient } from "../api/client";
import { toB64, utf8 } from "../crypto/bytes";
import { type HistoryKeys, historyTag, sealHistoryItem } from "../crypto/history";
import { encodeHistoryRecord, historyUploadable } from "../protocol/history";
import type { HistoryBackupState } from "../state/store";
import type { LocalStore } from "../store/db";
import { HISTORY_CURSOR } from "./historySync";

/** Ids of messages waiting to be backed up, kept so a closed tab carries on where it stopped. */
const PENDING_KEY = "history.upload.pending";
/** Set once every message this browser held was queued (the first run of a browser that backs up). */
const BACKFILLED_KEY = "history.upload.backfilled";

/** As the phone sends them (android HistorySync): 150 items or 3 MB a request, items up to the server's 64 KiB. */
const BATCH_ITEMS = 150;
const BATCH_BYTES = 3 * 1024 * 1024;
const MAX_ITEM_BYTES = 64 * 1024;
/** Changes arriving together go up together. */
const SETTLE_MS = 3_000;
const SAVE_PENDING_MS = 300;
const RETRY_MIN_MS = 30_000;
const RETRY_MAX_MS = 15 * 60_000;
/** The relay keeps files 7 days; a message younger than that asks the server to keep its files with the history. */
const KEEP_WINDOW_MS = 7 * 86_400_000;

const zPut = z.object({ seq: z.number(), items: z.number(), bytes: z.number() });
const zKept = z.object({ kept: z.boolean(), expiresAt: z.number() });

interface UploaderDeps {
  api: ApiClient;
  store: LocalStore;
  keys: HistoryKeys;
  /** Whether the server keeps files asked for (`attachment-keep`). */
  keepsFiles: () => boolean;
  onState: (s: HistoryBackupState) => void;
}

/** Thrown when a file couldn't be kept yet: its message stays queued and is sent again with the next try. */
class KeepLater extends Error {}

/**
 * Backs this browser's messages up into the account's encrypted history (docs/MESSAGE_HISTORY.md), as the phone does
 * (android HistorySync.upload): every message written here is queued, sealed with keys only the account's devices and
 * its recovery key can derive, and sent; the server never sees the content. A browser signing out first sends what's
 * queued ([flush]), so its chats come back when the account signs in again, here or anywhere.
 */
export class HistoryUploader {
  /** Message id → the change that queued it last: a change during an upload keeps the message queued. */
  private readonly pending = new Map<string, number>();
  private changes = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private retryMs = RETRY_MIN_MS;
  private stopped = false;
  private unsubscribe: (() => void) | null = null;
  private readonly kept = new Set<string>();
  /** What was last sent for each message, receipts left out: a new read receipt alone isn't sent again (as on phones). */
  private readonly sent = new Map<string, string>();
  private state: HistoryBackupState = { mode: "on", pending: 0, lastUploadAt: null, error: null };

  constructor(private readonly deps: UploaderDeps) {}

  /** Starts listening; on a browser's first run, queues everything it already holds. */
  async start(): Promise<void> {
    const { store } = this.deps;
    this.unsubscribe = store.onMessagesWritten((ids) => this.queue(ids));
    const backfilled = (await store.getValue<boolean>(BACKFILLED_KEY)) ?? false;
    const saved = (await store.getValue<string[]>(PENDING_KEY)) ?? [];
    this.queue([...saved, ...(backfilled ? [] : await store.messageIds())]);
    if (!backfilled) {
      await this.savePending();
      await store.setValue(BACKFILLED_KEY, true);
    }
    this.publish({});
    this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe?.();
    if (this.timer) clearTimeout(this.timer);
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }

  /** Sends everything queued now; throws if something couldn't be sent (signing out asks before going on). */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    if (this.running) await this.running.catch(() => undefined);
    if (this.pending.size) await this.run();
  }

  private queue(ids: string[]): void {
    if (this.stopped || !ids.length) return;
    for (const id of ids) this.pending.set(id, ++this.changes);
    this.publish({});
    if (!this.saveTimer) this.saveTimer = setTimeout(() => void this.savePending(), SAVE_PENDING_MS);
    // A busy chat doesn't keep putting the upload off: the first change starts the pause, later ones join it.
    if (!this.timer && !this.running) this.schedule(SETTLE_MS);
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run().catch(() => undefined); // reported in the state; the next try is scheduled
    }, delayMs);
  }

  private run(): Promise<void> {
    if (this.running) return this.running;
    const run = this.uploadAll()
      .then(() => {
        this.retryMs = RETRY_MIN_MS;
        this.publish({ error: null });
      })
      .catch((e: unknown) => {
        this.publish({ error: describe(e) });
        if (!(e instanceof ApiError && e.code === "history_off")) {
          this.schedule(this.retryMs);
          this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
        }
        throw e;
      })
      .finally(() => {
        this.running = null;
        // Queued during this upload: sent after the usual pause.
        if (this.pending.size && !this.stopped && !this.timer) this.schedule(SETTLE_MS);
      });
    this.running = run;
    return run;
  }

  private async uploadAll(): Promise<void> {
    try {
      while (this.pending.size && !this.stopped) {
        if (!(await this.uploadBatch([...this.pending.entries()].slice(0, BATCH_ITEMS)))) break;
      }
    } finally {
      // What's still queued survives a reload, sent or not.
      await this.savePending();
    }
  }

  /** One request's worth. False when nothing could be taken off the queue. */
  private async uploadBatch(batch: [string, number][]): Promise<boolean> {
    const { api, store, keys } = this.deps;
    const items: { tag: string; conv: string; ts: number; body: string }[] = [];
    const handled: [string, number][] = [];
    const keepFiles = new Map<string, string[]>();
    const digests = new Map<string, string>();
    const keeps = this.deps.keepsFiles();
    let bytes = 0;
    for (const [id, change] of batch) {
      const m = await store.message(id);
      // Gone, or not settled yet (it's written again, and queued, when it settles): nothing to send.
      if (!m || !historyUploadable(m)) {
        handled.push([id, change]);
        continue;
      }
      const digest = encodeHistoryRecord({ ...m, readBy: [], deliveredTo: [] });
      if (this.sent.get(id) === digest) {
        handled.push([id, change]);
        continue;
      }
      const tag = await historyTag(keys, "m", id);
      const sealed = await sealHistoryItem(keys, tag, utf8(encodeHistoryRecord(m)));
      if (sealed.length > MAX_ITEM_BYTES) {
        handled.push([id, change]);
        continue;
      }
      if (bytes + sealed.length > BATCH_BYTES && items.length) break;
      bytes += sealed.length;
      items.push({ tag, conv: await historyTag(keys, "c", m.conversationId), ts: m.sortTs, body: toB64(sealed) });
      digests.set(id, digest);
      handled.push([id, change]);
      if (keeps && m.attachments.length && m.sortTs > Date.now() - KEEP_WINDOW_MS)
        keepFiles.set(
          id,
          m.attachments.map((a) => a.id),
        );
    }
    if (items.length) {
      const before = (await store.getValue<number>(HISTORY_CURSOR)) ?? 0;
      const r = await api.json("PUT", "/v1/history/items", zPut, { body: { items } });
      // Nobody else wrote in between: this browser already has everything up to the new position.
      if (r.seq - items.length === before) await store.setValue(HISTORY_CURSOR, r.seq);
      for (const [id, digest] of digests) this.sent.set(id, digest);
      this.publish({ lastUploadAt: Date.now() });
    }
    const keepLater = new Set<string>();
    for (const [id, files] of keepFiles) {
      for (const file of files) if (!(await this.keepFile(file))) keepLater.add(id);
    }
    for (const [id, change] of handled) if (!keepLater.has(id) && this.pending.get(id) === change) this.pending.delete(id);
    this.publish({});
    if (keepLater.size) throw new KeepLater("Waiting to keep files on the server");
    return handled.length > 0;
  }

  /** False when it should be asked again later; true when settled (kept, or gone or over quota: nothing more to do). */
  private async keepFile(id: string): Promise<boolean> {
    if (this.kept.has(id)) return true;
    try {
      await this.deps.api.json("POST", `/v1/attachments/${encodeURIComponent(id)}/keep`, zKept);
    } catch (e) {
      if (!(e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 429))) return false;
    }
    this.kept.add(id);
    return true;
  }

  private async savePending(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.stopped) return;
    await this.deps.store.setValue(PENDING_KEY, [...this.pending.keys()]);
  }

  private publish(change: Partial<HistoryBackupState>): void {
    this.state = { ...this.state, ...change, pending: this.pending.size };
    this.deps.onState(this.state);
  }
}

function describe(e: unknown): string {
  if (e instanceof KeepLater) return e.message;
  if (e instanceof ApiError) {
    if (e.isNetwork) return "Waiting for a connection";
    if (e.status === 429 || e.code === "history_full" || e.code === "quota_exceeded") return "The server's storage for your message history is full.";
    if (e.code === "history_off") return "This server doesn't keep message history.";
    return e.message;
  }
  return "Couldn't back up this browser's chats";
}
