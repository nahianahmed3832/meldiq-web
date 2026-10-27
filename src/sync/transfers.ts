import { aesGcmDecrypt, aesGcmEncrypt } from "../crypto/aead";
import { fromB64, randomBytes, sha256, toB64, utf8 } from "../crypto/bytes";
import { encryptFile } from "../crypto/attachment";
import type { AttachmentRef } from "../protocol/payload";
import { holdUpdates } from "../application/updates";
import { ApiError } from "../api/client";
import { AttachmentError, fileLimit, MAX_FILES_PER_MESSAGE, SINGLE_FORMAT_BYTES, uploadSingle } from "./attachments";
import { CHUNK_BYTES } from "../crypto/fileStream";
import { prepareLarge, type PreparedFile, preparedRef, type UploadCheckpoint, UploadCancelled, uploadPrepared } from "./largeUpload";
import type { Engine } from "./engine";

/**
 * Sending files (continuation brief v3 §2): every send is a transfer owned here, not by the screen that started it, so
 * moving to another conversation or page doesn't stop it, lose its progress, or invite a second copy.
 *
 * - One transfer per operation: its id is a hash of the conversation, the files (name, size, last change), the caption
 *   and the reply, so sending the same thing again while it's running joins the running transfer.
 * - Checkpoints in this browser's database (erased with the rest on sign-out): each large file's ciphertext (as a Blob,
 *   still end-to-end encrypted), where its upload got to, and the stored attachment's id. A file's key is kept only
 *   sealed with a non-extractable AES-GCM key that never leaves this browser, never as bytes.
 * - After a reload the transfer comes back as interrupted: Resume continues from the stored ciphertext and the parts the
 *   server already has; a file whose encryption hadn't finished is chosen again (a page can't reopen a file by itself).
 * - The message itself goes through the outbox (compose.ts), which already survives reloads.
 */

export type TransferStatus = "running" | "interrupted" | "failed" | "sent" | "cancelled";
export type FilePhase = "waiting" | "encrypting" | "uploading" | "done";

export interface TransferFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  phase: FilePhase;
  /** Bytes of this phase done and in all (encrypting: ciphertext bytes; uploading: bytes sent). */
  done: number;
  total: number;
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
  async start(conversationId: string, files: OutgoingFile[], caption: string, opts: { replyTo?: string; threadRoot?: string } = {}): Promise<string> {
    if (files.length > MAX_FILES_PER_MESSAGE) throw new AttachmentError(`Send at most ${MAX_FILES_PER_MESSAGE} files in one message.`);
    const limit = fileLimit(this.engine.state.get().server);
    const tooBig = files.find((f) => f.size > limit);
    if (tooBig) throw new AttachmentError(`"${tooBig.name}" is larger than this server accepts per file.`);
    const empty = files.find((f) => f.size === 0);
    if (empty) throw new AttachmentError(`"${empty.name}" is empty.`);
    const id = await operationId(conversationId, files, caption, opts);
    const existing = this.jobs.get(id);
    if (existing && existing.status === "running") return id;
    const record: StoredTransfer = {
      id,
      conversationId,
      caption,
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
    if (!kept) await this.save(id);
    this.emit(true);
    void this.run(id);
    return id;
  }

  /** Continues an interrupted or failed transfer (with the files chosen again, when some are needed). */
  resume(id: string, files?: OutgoingFile[]): void {
    const job = this.jobs.get(id);
    const rec = this.stored.get(id);
    if (!job || !rec || job.status === "running") return;
    if (files) {
      const sources = rec.files.map((f) => files.find((x) => x.name === f.name && x.size === f.size && (x.lastModified ?? 0) === f.lastModified)?.source ?? null);
      this.sources.set(id, sources);
    }
    job.status = "running";
    job.error = null;
    job.files.forEach((f) => (f.needsFile = false));
    this.emit(true);
    void this.run(id);
  }

  cancel(id: string): void {
    this.aborts.get(id)?.abort();
    const job = this.jobs.get(id);
    if (job && job.status !== "running") void this.finish(id, "cancelled");
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
    const refs: AttachmentRef[] = [];
    try {
      for (const [i, f] of rec.files.entries()) {
        const view = job.files[i];
        refs.push(await this.sendFile(id, i, f, view, abort.signal));
        view.phase = "done";
        this.emit(true);
      }
      await this.engine.sendText(rec.conversationId, rec.caption, { replyTo: rec.replyTo, threadRoot: rec.threadRoot, attachments: refs });
      await this.finish(id, "sent");
    } catch (e) {
      if (e instanceof UploadCancelled || abort.signal.aborted) return void (await this.finish(id, "cancelled"));
      if (e instanceof NeedsFile) {
        job.status = "interrupted";
        job.files[e.index].needsFile = true;
        job.error = `Choose "${rec.files[e.index].name}" again to continue.`;
      } else {
        job.status = "failed";
        job.error = e instanceof Error ? e.message : "Couldn't send the files.";
      }
      this.emit(true);
    } finally {
      release();
      this.aborts.delete(id);
    }
  }

  private async sendFile(id: string, i: number, f: StoredFile, view: TransferFile, signal: AbortSignal): Promise<AttachmentRef> {
    const progress = (phase: FilePhase) => (p: { done: number; total: number }) => {
      view.phase = phase;
      view.done = p.done;
      view.total = p.total;
      this.emit();
    };
    if (f.attachmentId && f.sealedKey && f.nonce && f.sha256) return this.refFromStored(f, f.attachmentId);
    const source = this.sources.get(id)?.[i] ?? null;
    if (f.size <= SINGLE_FORMAT_BYTES) {
      if (!source) throw new NeedsFile(i);
      view.phase = "encrypting";
      view.total = f.size;
      this.emit(true);
      const enc = await encryptFile(new Uint8Array(await source.arrayBuffer()));
      progress("uploading")({ done: 0, total: enc.ciphertext.length });
      const attachmentId = await uploadSingle(this.engine, this.stored.get(id)!.conversationId, enc.ciphertext);
      Object.assign(f, { attachmentId, sealedKey: await this.seal(fromB64(enc.key)), nonce: enc.nonce, sha256: enc.sha256 });
      await this.save(id);
      return this.ref(f, attachmentId, enc.key);
    }
    // Large: encrypt once (unless a checkpoint has the ciphertext), then upload, continuing where it stopped.
    let prepared = this.prepared.get(id)?.[i] ?? null;
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
      prepared = await prepareLarge(
        { name: f.name, type: f.type, size: f.size, source, slice: (a, b) => source.slice(a, b) },
        { signal, voiceDurationMs: f.voiceDurationMs, onProgress: (p) => progress("encrypting")(p) },
      );
      Object.assign(f, { ciphertext: prepared.ciphertext, sealedKey: await this.seal(prepared.rawKey), nonce: toB64(prepared.nonce), sha256: prepared.sha256, chunk: CHUNK_BYTES });
      await this.save(id);
    }
    this.prepared.set(id, Object.assign(this.prepared.get(id) ?? [], { [i]: prepared }));
    const attachmentId = await uploadPrepared(this.engine, this.stored.get(id)!.conversationId, prepared, {
      signal,
      checkpoint: f.checkpoint,
      onCheckpoint: (c) => {
        f.checkpoint = c;
        void this.save(id);
      },
      onProgress: (p) => progress("uploading")(p),
    });
    f.attachmentId = attachmentId;
    // Uploaded: the ciphertext needn't be kept any longer; the reference has everything the message needs.
    delete f.ciphertext;
    await this.save(id);
    return preparedRef(prepared, attachmentId);
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
      ...(f.chunk ? { chunk: f.chunk } : {}),
      ...(f.voiceDurationMs !== undefined ? { voice: true, durationMs: Math.round(f.voiceDurationMs) } : {}),
    };
  }

  private async finish(id: string, status: "sent" | "cancelled"): Promise<void> {
    const job = this.jobs.get(id);
    const rec = this.stored.get(id);
    if (status === "cancelled" && rec) {
      // Whatever reached the store for an unfinished upload is removed (the server also expires abandoned uploads).
      for (const f of rec.files) {
        if (!f.attachmentId && f.checkpoint?.uploadId) await this.engine.api.call("DELETE", `/v1/attachments/uploads/${encodeURIComponent(f.checkpoint.uploadId)}`).catch(() => undefined);
      }
    }
    await this.forget(id);
    if (job) {
      job.status = status;
      job.error = null;
      // A sent message shows in the conversation; the finished transfer leaves the list shortly after.
      if (status === "sent") setTimeout(() => (this.jobs.delete(id), this.emit(true)), 1500);
    }
    this.emit(true);
  }

  private async forget(id: string): Promise<void> {
    for (const p of this.prepared.get(id) ?? []) p?.rawKey.fill(0);
    this.prepared.delete(id);
    this.sources.delete(id);
    this.stored.delete(id);
    await this.engine.store.deleteValue(KEY_PREFIX + id).catch(() => undefined);
  }

  private async save(id: string): Promise<void> {
    const rec = this.stored.get(id);
    if (rec) await this.engine.store.setValue(KEY_PREFIX + id, rec).catch(() => undefined);
  }

  /** The non-extractable key that seals file keys in this browser, made once. */
  private async wrapKey(): Promise<CryptoKey> {
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
      throw new ApiError(0, "transfer_key", "This transfer can't continue in this browser. Send the files again.");
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
async function operationId(conversationId: string, files: OutgoingFile[], caption: string, opts: { replyTo?: string; threadRoot?: string }): Promise<string> {
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
