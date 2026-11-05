import { text as uiText } from "../i18n";
import { mediaPreview } from "./mediaPreview";
import { aesGcmDecrypt, aesGcmEncrypt } from "../crypto/aead";
import { fromB64, randomBytes, sha256, toB64, utf8 } from "../crypto/bytes";
import { encryptFile } from "../crypto/attachment";
import type { AttachmentRef } from "../protocol/payload";
import { holdUpdates } from "../application/updates";
import { ApiError } from "../api/client";
import { AttachmentError, fileLimit, MAX_FILES_PER_MESSAGE, SINGLE_FORMAT_BYTES } from "./attachments";
import { CHUNK_BYTES } from "../crypto/fileStream";
import { prepareLarge, type PreparedFile, checkUploadSignal, type UploadCheckpoint, UploadCancelled, uploadPrepared } from "./largeUpload";
import type { Engine } from "./engine";
/**
 * Sending files (continuation brief v3 §2): every send is a transfer owned here, not by the screen that started it, so
 * moving to another conversation or page doesn't stop it, lose its progress, or invite a second copy.
 *
 * - One transfer per operation: its id is a hash of the conversation, the files (name, size, last change), the caption
 *   and the reply, so sending the same thing again while it's running joins the running transfer.
 * - Checkpoints in this browser's database (erased with the rest on sign-out): each large file's ciphertext (as a Blob,
 *   still encrypted), where its upload got to, and the stored attachment's id. A file's key is kept only
 *   sealed with a non-extractable AES-GCM key that never leaves this browser, never as bytes.
 * - After a reload the transfer comes back as interrupted: Resume continues from the stored ciphertext and the parts the
 *   server already has; a file whose encryption hadn't finished is chosen again (a page can't reopen a file by itself).
 * - The message itself goes through the outbox (compose.ts), which already survives reloads.
 */
export type TransferStatus = "running" | "interrupted" | "failed" | "sent" | "cancelled";
export type FilePhase = "waiting" | "encrypting" | "uploading" | "verifying" | "previewing" | "done" | "failed" | "cancelled";
export interface TransferFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  phase: FilePhase;
  /** Bytes of this phase done and in all (encrypting: ciphertext bytes; uploading: bytes sent). */
  done: number;
  total: number;
  originalUploaded?: boolean;
  speedBps?: number;
  remainingSeconds?: number;
  /** The file is needed again to continue (its encryption hadn't finished before a reload). */
  needsFile?: boolean;
}
export interface Transfer {
  id: string;
  conversationId: string;
  caption: string;
  status: TransferStatus;
  files: TransferFile[];
  error: string | null;
  publishing?: boolean;
  createdAt: number;
}
/** What a picked file brings (the composer passes Files; tests pass Blobs with names). */
export interface OutgoingFile {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
  source: Blob;
  voiceDurationMs?: number;
}
interface SealedKey {
  iv: string;
  wrapped: string;
}
/** A file's checkpoint as kept in the database: no plaintext, no raw key. */
interface StoredFile {
  thumbnail?: StoredFile;
  w?: number;
  h?: number;
  durationMs?: number;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  voiceDurationMs?: number;
  /** Large files once encrypted: the ciphertext and what decrypting it needs (the key sealed). */
  ciphertext?: Blob;
  sealedKey?: SealedKey;
  nonce?: string;
  sha256?: string;
  chunk?: number;
  checkpoint?: UploadCheckpoint;
  /** Set once the server stored the ciphertext. */
  attachmentId?: string;
}
interface StoredTransfer {
  id: string;
  messageId?: string;
  conversationId: string;
  caption: string;
  replyTo?: string;
  threadRoot?: string;
  createdAt: number;
  files: StoredFile[];
}
const KEY_PREFIX = "transfer:";
const WRAP_KEY = "transfer-wrap-key";
/** Progress reaches the screen at most this often. */
const PROGRESS_MS = 150;
const FILE_CONCURRENCY = 2;
type Listener = () => void;
/** The transfers of one signed-in browser (one per engine). */
export class Transfers {
  private readonly jobs = new Map<string, Transfer>();
  private readonly stored = new Map<string, StoredTransfer>();
  /** The picked files of running transfers, only in memory. */
  private readonly sources = new Map<string, (Blob | null)[]>();
  /** Large files encrypted in this session (with their raw key), only in memory. */
  private readonly prepared = new Map<string, (PreparedFile | null)[]>();
  private readonly aborts = new Map<string, AbortController>();
  private readonly listeners = new Set<Listener>();
  private lastEmit = 0;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded: Promise<void> | null = null;
  private wrapping: Promise<CryptoKey> | null = null;
  private active = 0;
  private readonly slots = new Set<() => void>();
  private writes = new Map<string, Promise<void>>();
  constructor(private readonly engine: Engine) {}
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** The transfers of [conversationId] (all when omitted), newest last. */
  list(conversationId?: string): Transfer[] {
    return [...this.jobs.values()].filter((j) => !conversationId || j.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt);
  }
  /** Transfers kept from before a reload come back as interrupted (once per engine). */
  load(): Promise<void> {
    this.loaded ??= (async () => {
      for (const { value } of await this.engine.store.valuesWithPrefix<StoredTransfer>(KEY_PREFIX)) {
        if (this.jobs.has(value.id)) continue;
        this.stored.set(value.id, value);
        this.jobs.set(value.id, {
          id: value.id,
          conversationId: value.conversationId,
          caption: value.caption,
          status: "interrupted",
          error: null,
          createdAt: value.createdAt,
          files: value.files.map((f) => {
            const done = !!f.attachmentId;
            const encrypted = !!f.ciphertext && !!f.sealedKey;
            return {
              name: f.name,
              type: f.type,
              size: f.size,
              lastModified: f.lastModified,
              phase: done ? "done" : encrypted ? "uploading" : "waiting",
              done: 0,
              total: 0,
              needsFile: !done && !encrypted,
            };
          }),
        });
      }
      this.emit(true);
    })().catch(() => undefined);
    return this.loaded;
  }
  /**
   * Starts sending [files] with [caption] as one message; answers the transfer's id. The same send while it's still
   * running joins it instead of starting again.
   */
  async start(
    conversationId: string,
    files: OutgoingFile[],
    caption: string,
    opts: {
      replyTo?: string;
      threadRoot?: string;
    } = {},
  ): Promise<string> {
    if (!files.length) throw new AttachmentError(uiText("files.interface.choose_at_least_one_file_d63076a"));
    if (files.some((f) => !Number.isSafeInteger(f.size) || f.size !== f.source.size))
      throw new AttachmentError(uiText("workspace.interface.the_selected_file_size_changed_choose_the_file_again_2ff8a93"));
    if (files.length > MAX_FILES_PER_MESSAGE) throw new AttachmentError(uiText("files.interface.send_at_most_value0_files_in_one_message_e25b619", { value0: MAX_FILES_PER_MESSAGE }));
    const limit = fileLimit(this.engine.state.get().server);
    const tooBig = files.find((f) => f.size > limit);
    if (tooBig) throw new AttachmentError(uiText("workspace.interface.value0_is_larger_than_this_server_accepts_per_file_9a0e037", { value0: tooBig.name }));
    const empty = files.find((f) => f.size === 0);
    if (empty) throw new AttachmentError(uiText("files.interface.value0_is_empty_9065ae7", { value0: empty.name }));
    await this.load();
    const id = await operationId(conversationId, files, caption, opts);
    const existing = this.jobs.get(id);
    checkUploadSignal(this.aborts.get(id)?.signal);
    if (existing?.status === "running" || this.aborts.has(id)) return id;
    const record: StoredTransfer = {
      id,
      conversationId,
      caption,
      messageId: crypto.randomUUID(),
      replyTo: opts.replyTo,
      threadRoot: opts.threadRoot,
      createdAt: Date.now(),
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size, lastModified: f.lastModified ?? 0, voiceDurationMs: f.voiceDurationMs })),
    };
    // Resuming an interrupted one with the files chosen again keeps its checkpoints.
    const kept = this.stored.get(id);
    this.stored.set(id, kept ?? record);
    this.sources.set(
      id,
      files.map((f) => f.source),
    );
    this.jobs.set(id, {
      id,
      conversationId,
      caption,
      status: "running",
      error: null,
      createdAt: kept?.createdAt ?? record.createdAt,
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size, lastModified: f.lastModified ?? 0, phase: "waiting", done: 0, total: 0 })),
    });
    if (!kept) {
      try {
        await this.save(id);
      } catch (e) {
        this.jobs.delete(id);
        this.stored.delete(id);
        this.sources.delete(id);
        throw e;
      }
    }
    void this.run(id);
    this.emit(true);
    return id;
  }
  /** Continues an interrupted or failed transfer (with the files chosen again, when some are needed). */
  resume(id: string, files?: OutgoingFile[]): void {
    const job = this.jobs.get(id);
    const rec = this.stored.get(id);
    if (!job || !rec || job.status === "running" || this.aborts.has(id)) return;
    if (files) {
      const sources = rec.files.map((f) => files.find((x) => x.name === f.name && x.size === f.size && (x.lastModified ?? 0) === f.lastModified)?.source ?? null);
      this.sources.set(id, sources);
    }
    job.status = "running";
    job.error = null;
    job.files.forEach((f, i) => {
      f.needsFile = false;
      if (f.phase === "done") return;
      Object.assign(f, { phase: "waiting", done: 0, total: 0, originalUploaded: !!rec.files[i].attachmentId });
      delete f.speedBps;
      delete f.remainingSeconds;
    });
    void this.run(id);
    this.emit(true);
  }
  cancel(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.publishing || job.status === "sent") return;
    const running = this.aborts.get(id);
    if (running) return running.abort();
    if (job.status === "interrupted" || job.status === "failed") {
      const abort = new AbortController();
      abort.abort();
      this.aborts.set(id, abort);
      void this.finish(id, "cancelled").finally(() => this.aborts.delete(id));
    }
  }
  /** Drops a finished, cancelled or failed transfer from the list. */
  dismiss(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.status === "running") return;
    this.jobs.delete(id);
    void this.forget(id);
    this.emit(true);
  }
  private async run(id: string): Promise<void> {
    const job = this.jobs.get(id)!;
    const rec = this.stored.get(id)!;
    const abort = new AbortController();
    this.aborts.set(id, abort);
    const release = holdUpdates();
    const refs: AttachmentRef[] = new Array(rec.files.length);
    const pool = new AbortController();
    const stop = () => pool.abort();
    abort.signal.addEventListener("abort", stop, { once: true });
    let next = 0;
    let failure: { error: unknown; index: number } | undefined;
    try {
      await Promise.all(
        Array.from({ length: Math.min(FILE_CONCURRENCY, rec.files.length) }, async () => {
          while (!pool.signal.aborted && next < rec.files.length) {
            const index = next++;
            let releaseSlot: (() => void) | undefined;
            try {
              releaseSlot = await this.acquire(pool.signal);
              refs[index] = await this.sendWithPreview(id, index, rec.files[index], job.files[index], pool.signal);
              checkUploadSignal(pool.signal);
              job.files[index].phase = "done";
              this.emit(true);
            } catch (error) {
              failure ??= { error, index };
              pool.abort();
            } finally {
              releaseSlot?.();
            }
          }
        }),
      );
      if (failure) throw failure.error;
      checkUploadSignal(abort.signal);
      rec.messageId ??= crypto.randomUUID();
      await this.save(id);
      checkUploadSignal(abort.signal);
      job.publishing = true;
      this.emit(true);
      await this.engine.sendText(rec.conversationId, rec.caption, { presetId: rec.messageId, replyTo: rec.replyTo, threadRoot: rec.threadRoot, attachments: refs });
      await this.finish(id, "sent");
    } catch (e) {
      if (abort.signal.aborted) return void (await this.finish(id, "cancelled"));
      if (e instanceof NeedsFile) {
        job.status = "interrupted";
        job.files[e.index].needsFile = true;
        job.error = `Choose "${rec.files[e.index].name}" again to continue.`;
      } else {
        job.status = "failed";
        if (failure) job.files[failure.index].phase = "failed";
        job.error = e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_send_the_files_5381a8c");
      }
    } finally {
      delete job.publishing;
      abort.signal.removeEventListener("abort", stop);
      release();
      this.aborts.delete(id);
      this.emit(true);
    }
  }
  private async sendWithPreview(id: string, index: number, f: StoredFile, view: TransferFile, signal: AbortSignal): Promise<AttachmentRef> {
    const source = this.sources.get(id)?.[index];
    const previewAbort = new AbortController();
    const cancelPreview = () => previewAbort.abort();
    signal.addEventListener("abort", cancelPreview, { once: true });
    // Generate the optional derivative during encryption and network I/O. The primary file has its own checkpoint.
    const previewTask = source && !f.thumbnail?.sealedKey && f.voiceDurationMs === undefined ? mediaPreview(source, f.name, previewAbort.signal).catch(() => null) : null;
    let ref: AttachmentRef;
    try {
      ref = await this.sendFile(id, index, f, view, signal);
      view.originalUploaded = true;
      let previewSource: Blob | undefined;
      if (previewTask) {
        view.phase = "previewing";
        this.emit();
        const preview = await previewTask;
        if (preview) {
          Object.assign(f, { w: preview.w, h: preview.h, durationMs: preview.durationMs });
          f.thumbnail = { name: preview.file.name, type: preview.file.type, size: preview.file.size, lastModified: 0 };
          previewSource = preview.file;
        }
      }
      checkUploadSignal(signal);
      if (!f.thumbnail || (!previewSource && !f.thumbnail.sealedKey)) return ref;
      const derivative = f.thumbnail;
      try {
        const thumbnail = await this.sendFile(id, index, derivative, view, signal, { source: previewSource, preview: true });
        const mime = thumbnail.mime;
        if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp")
          ref = { ...ref, thumbnail: { ...thumbnail, mime }, w: f.w, h: f.h, ...(f.durationMs !== undefined ? { durationMs: f.durationMs } : {}) };
      } catch (e) {
        checkUploadSignal(signal);
        // A derivative can fail on a second storage request even though the original is ready to publish.
        await this.abandonUpload(derivative);
        delete f.thumbnail;
        if (e instanceof ApiError && ["quota_exceeded", "upload_limit", "storage_full", "too_large"].includes(e.code))
          this.engine.notice("info", uiText("workspace.interface.the_preview_could_not_fit_in_your_storage_allowance_the_original_2f98eb1"));
      }
      return ref;
    } finally {
      signal.removeEventListener("abort", cancelPreview);
      cancelPreview();
      await previewTask;
    }
  }
  /** A bounded queue across messages, with cancellation while waiting for a slot. */
  private acquire(signal: AbortSignal): Promise<() => void> {
    checkUploadSignal(signal);
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.slots.delete(check);
        reject(new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1")));
      };
      const check = () => {
        if (this.active >= FILE_CONCURRENCY) return;
        this.slots.delete(check);
        signal.removeEventListener("abort", abort);
        this.active++;
        resolve(() => {
          this.active--;
          for (const wake of [...this.slots]) wake();
        });
      };
      this.slots.add(check);
      signal.addEventListener("abort", abort, { once: true });
      check();
    });
  }
  private async sendFile(
    id: string,
    i: number,
    f: StoredFile,
    view: TransferFile,
    signal: AbortSignal,
    opts: {
      source?: Blob;
      preview?: boolean;
    } = {},
  ): Promise<AttachmentRef> {
    let sample = { phase: "waiting" as FilePhase, at: performance.now(), done: 0 };
    const progress = (phase: FilePhase) => (p: { done: number; total: number }) => {
      const now = performance.now();
      if (sample.phase !== phase || p.done < sample.done) {
        sample = { phase, at: now, done: p.done };
        delete view.speedBps;
        delete view.remainingSeconds;
      } else if (phase === "uploading" && now - sample.at >= 1500 && p.done - sample.done >= 65536) {
        view.speedBps = ((p.done - sample.done) * 1000) / (now - sample.at);
        view.remainingSeconds = Math.ceil(Math.max(0, p.total - p.done) / view.speedBps);
        sample = { phase, at: now, done: p.done };
      }
      view.phase = phase;
      view.done = p.done;
      view.total = p.total;
      this.emit();
    };
    if (f.attachmentId && f.sealedKey && f.nonce && f.sha256) return this.refFromStored(f, f.attachmentId);
    checkUploadSignal(signal);
    const slot = 2 * i + (opts.preview ? 1 : 0);
    const source = opts.source ?? (opts.preview ? null : this.sources.get(id)?.[i]) ?? null;
    // Large: encrypt once (unless a checkpoint has the ciphertext), then upload, continuing where it stopped.
    let prepared = this.prepared.get(id)?.[slot] ?? null;
    const remember = (value: PreparedFile) => {
      this.prepared.set(id, Object.assign(this.prepared.get(id) ?? [], { [slot]: value }));
    };
    if (!prepared && f.ciphertext && f.sealedKey && f.nonce && f.sha256) {
      prepared = {
        name: f.name,
        type: f.type,
        size: f.size,
        rawKey: await this.unseal(f.sealedKey),
        nonce: fromB64(f.nonce),
        ciphertext: f.ciphertext,
        sha256: f.sha256,
        voiceDurationMs: f.voiceDurationMs,
      };
    }
    if (!prepared) {
      if (!source) throw new NeedsFile(i);
      checkUploadSignal(signal);
      view.phase = "encrypting";
      this.emit(true);
      if (f.size <= SINGLE_FORMAT_BYTES) {
        const bytes = new Uint8Array(await source.arrayBuffer());
        checkUploadSignal(signal);
        const enc = await encryptFile(bytes);
        prepared = {
          name: f.name,
          type: f.type,
          size: f.size,
          ciphertext: new Blob([new Uint8Array(enc.ciphertext)]),
          rawKey: fromB64(enc.key),
          nonce: fromB64(enc.nonce),
          sha256: enc.sha256,
          voiceDurationMs: f.voiceDurationMs,
        };
      } else {
        const encrypting = progress("encrypting");
        prepared = await prepareLarge(
          { name: f.name, type: f.type, size: f.size, source, slice: (a, b) => source.slice(a, b) },
          { signal, voiceDurationMs: f.voiceDurationMs, onProgress: encrypting },
        );
        f.chunk = CHUNK_BYTES;
      }
      remember(prepared);
      checkUploadSignal(signal);
    }
    if (!f.sealedKey) {
      Object.assign(f, { ciphertext: prepared.ciphertext, sealedKey: await this.seal(prepared.rawKey), nonce: toB64(prepared.nonce), sha256: prepared.sha256 });
      await this.save(id);
    }
    remember(prepared);
    const uploading = progress("uploading");
    const verifying = progress("verifying");
    uploading({ done: 0, total: prepared.ciphertext.size });
    const attachmentId = await uploadPrepared(this.engine, this.stored.get(id)!.conversationId, prepared, {
      signal,
      checkpoint: f.checkpoint,
      onCheckpoint: async (c) => {
        f.checkpoint = c;
        await this.save(id);
      },
      onProgress: (p) => (p.phase === "verifying" ? verifying : uploading)(p),
    });
    f.attachmentId = attachmentId;
    // Uploaded: the ciphertext needn't be kept any longer; the reference has everything the message needs.
    delete f.ciphertext;
    await this.save(id);
    const ref = this.ref(f, attachmentId, toB64(prepared.rawKey));
    prepared.rawKey.fill(0);
    this.prepared.get(id)![slot] = null;
    return ref;
  }
  private async refFromStored(f: StoredFile, attachmentId: string): Promise<AttachmentRef> {
    const raw = await this.unseal(f.sealedKey!);
    try {
      return this.ref(f, attachmentId, toB64(raw));
    } finally {
      raw.fill(0);
    }
  }
  private ref(f: StoredFile, id: string, key: string): AttachmentRef {
    return {
      id,
      name: f.name.slice(0, 200) || "file",
      mime: f.type || "application/octet-stream",
      size: f.size,
      key,
      nonce: f.nonce!,
      sha256: f.sha256!,
      ...(f.w ? { w: f.w } : {}),
      ...(f.h ? { h: f.h } : {}),
      ...(f.durationMs !== undefined ? { durationMs: f.durationMs } : {}),
      ...(f.chunk ? { chunk: f.chunk } : {}),
      ...(f.voiceDurationMs !== undefined ? { voice: true, durationMs: Math.round(f.voiceDurationMs) } : {}),
    };
  }
  private async abandonUpload(f: StoredFile): Promise<void> {
    if (!f.attachmentId && f.checkpoint?.uploadId)
      await this.engine.api.call("DELETE", `/v1/attachments/uploads/${encodeURIComponent(f.checkpoint.uploadId)}`, { signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  }
  private async finish(id: string, status: "sent" | "cancelled"): Promise<void> {
    const job = this.jobs.get(id);
    const rec = this.stored.get(id);
    if (status === "cancelled" && rec) {
      // Whatever reached the store for an unfinished upload is removed (the server also expires abandoned uploads).
      await Promise.all(rec.files.flatMap((f) => (f.thumbnail ? [f, f.thumbnail] : [f])).map((f) => this.abandonUpload(f)));
    }
    await this.forget(id);
    if (job) {
      job.status = status;
      if (status === "cancelled")
        job.files
          .filter((f) => f.phase !== "done")
          .forEach((f) => {
            f.phase = "cancelled";
          });
      job.error = null;
      // A sent message shows in the conversation; the finished transfer leaves the list shortly after.
      if (status === "sent")
        setTimeout(() => {
          if (this.jobs.get(id) === job) {
            this.jobs.delete(id);
            this.emit(true);
          }
        }, 1500);
    }
    this.emit(true);
  }
  private async forget(id: string): Promise<void> {
    for (const p of this.prepared.get(id) ?? []) p?.rawKey.fill(0);
    this.prepared.delete(id);
    this.sources.delete(id);
    this.stored.delete(id);
    await this.writes.get(id)?.catch(() => undefined);
    this.writes.delete(id);
    await this.engine.store.deleteValue(KEY_PREFIX + id);
  }
  private async save(id: string): Promise<void> {
    const rec = this.stored.get(id);
    if (!rec) return;
    const snapshot = structuredClone(rec);
    const write = (this.writes.get(id) ?? Promise.resolve()).catch(() => undefined).then(() => this.engine.store.setValue(KEY_PREFIX + id, snapshot));
    this.writes.set(id, write);
    await write;
  }
  /** The non-extractable key that seals file keys in this browser, made once. */
  private wrapKey(): Promise<CryptoKey> {
    return (this.wrapping ??= this.loadWrapKey());
  }
  private async loadWrapKey(): Promise<CryptoKey> {
    const kept = await this.engine.store.getValue<CryptoKey>(WRAP_KEY);
    if (kept instanceof CryptoKey) return kept;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await this.engine.store.setValue(WRAP_KEY, key);
    return key;
  }
  private async seal(raw: Uint8Array): Promise<SealedKey> {
    const iv = randomBytes(12);
    return { iv: toB64(iv), wrapped: toB64(await aesGcmEncrypt(await this.wrapKey(), iv, raw, utf8("meldiq-transfer-key"))) };
  }
  private async unseal(s: SealedKey): Promise<Uint8Array> {
    try {
      return await aesGcmDecrypt(await this.wrapKey(), fromB64(s.iv), fromB64(s.wrapped), utf8("meldiq-transfer-key"));
    } catch {
      throw new ApiError(0, "transfer_key", uiText("workspace.interface.this_transfer_can_t_continue_in_this_browser_send_the_files__f1b0944"));
    }
  }
  private emit(now = false): void {
    const fire = () => {
      this.lastEmit = Date.now();
      this.emitTimer = null;
      for (const l of this.listeners) l();
    };
    if (now) {
      if (this.emitTimer) clearTimeout(this.emitTimer);
      return fire();
    }
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(fire, Math.max(0, PROGRESS_MS - (Date.now() - this.lastEmit)));
  }
}
class NeedsFile extends Error {
  constructor(readonly index: number) {
    super("file needed");
  }
}
/** The operation's id: the same conversation, files, caption and reply give the same id. */
async function operationId(
  conversationId: string,
  files: OutgoingFile[],
  caption: string,
  opts: {
    replyTo?: string;
    threadRoot?: string;
  },
): Promise<string> {
  const text = JSON.stringify([conversationId, caption, opts.replyTo ?? "", opts.threadRoot ?? "", files.map((f) => [f.name, f.size, f.lastModified ?? 0, f.type])]);
  return toB64(await sha256(utf8(text)))
    .replace(/[+/=]/g, "")
    .slice(0, 32);
}
const perEngine = new WeakMap<Engine, Transfers>();
/** The transfers of this signed-in browser (made on first use; interrupted ones are loaded then). */
export function transfersOf(engine: Engine): Transfers {
  let t = perEngine.get(engine);
  if (!t) {
    t = new Transfers(engine);
    perEngine.set(engine, t);
    void t.load();
  }
  return t;
}
