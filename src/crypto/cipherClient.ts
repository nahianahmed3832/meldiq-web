import { CancelledError, decryptBlob, encryptOnce, type Progress } from "./cipherJobs";
import { EnvelopeError } from "./envelope";
import type { ChunkKey } from "./fileStream";

/**
 * The page's side of the cipher worker (cipher.worker.ts): one worker, started on first use, shared by every transfer.
 * Where a worker can't start (tests, an old browser), the same code runs on the page instead, one chunk at a time.
 */

type Reply = { id: number; progress?: number; result?: unknown; error?: string; envelope?: boolean };
interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: Progress;
}

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === "undefined" ? null : new Worker(new URL("./cipher.worker.ts", import.meta.url), { type: "module", name: "meldiq-cipher" });
  } catch {
    worker = null;
  }
  worker?.addEventListener("message", (e: MessageEvent<Reply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    if (e.data.progress !== undefined) return p.onProgress?.(e.data.progress);
    pending.delete(e.data.id);
    if (e.data.error) p.reject(e.data.error === "cancelled" ? new CancelledError() : e.data.envelope ? new EnvelopeError(e.data.error) : new Error(e.data.error));
    else p.resolve(e.data.result);
  });
  worker?.addEventListener("error", () => {
    // A worker that fails to load: later jobs run on the page; the ones waiting are failed so they can be retried.
    for (const [, p] of pending) p.reject(new Error("The encryption worker stopped. Try again."));
    pending.clear();
    worker = null;
  });
  return worker;
}

function run<T>(msg: Record<string, unknown>, signal: AbortSignal | undefined, onProgress: Progress | undefined, local: (cancelled: () => boolean) => Promise<T>): Promise<T> {
  const w = getWorker();
  if (!w) return local(() => !!signal?.aborted);
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    signal?.addEventListener("abort", () => w.postMessage({ op: "cancel", id }), { once: true });
    w.postMessage({ ...msg, id });
  });
}

/** Encrypts [file] once in the worker; the ciphertext as a Blob and its SHA-256. */
export function encryptFileOnce(file: Blob, k: ChunkKey, chunk: number, opts: { onProgress?: Progress; signal?: AbortSignal } = {}): Promise<{ blob: Blob; sha256: string }> {
  return run({ op: "encrypt", file, key: k.key, nonce: k.nonce, chunk }, opts.signal, opts.onProgress, (c) => encryptOnce(file, k, chunk, opts.onProgress, c));
}

/** Decrypts and verifies a chunked ciphertext Blob in the worker; throws EnvelopeError if any check fails. */
export function decryptFileBlob(
  blob: Blob,
  k: ChunkKey,
  meta: { chunk: number; size: number; sha256: string; mime: string },
  opts: { onProgress?: Progress; signal?: AbortSignal } = {},
): Promise<Blob> {
  return run({ op: "decrypt", blob, key: k.key, nonce: k.nonce, ...meta }, opts.signal, opts.onProgress, (c) => decryptBlob(blob, k, meta, opts.onProgress, c));
}

export { CancelledError };
