/**
 * The cipher worker (continuation brief v3 §2): file encryption, decryption and the ciphertext's SHA-256 run here, so a
 * large file never stalls the page. It receives the file as a Blob and the key as a non-extractable CryptoKey (never
 * raw bytes), and answers with Blobs; progress at most ten times a second. Nothing is stored here.
 */
import { CancelledError, decryptBlob, encryptOnce } from "./cipherJobs";
import { EnvelopeError } from "./envelope";

type Job =
  | { op: "encrypt"; id: number; file: Blob; key: CryptoKey; nonce: Uint8Array; chunk: number }
  | { op: "decrypt"; id: number; blob: Blob; key: CryptoKey; nonce: Uint8Array; chunk: number; size: number; sha256: string; mime: string }
  | { op: "cancel"; id: number };

const cancelled = new Set<number>();
const PROGRESS_MS = 100;

self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  if (job.op === "cancel") {
    cancelled.add(job.id);
    return;
  }
  let last = 0;
  const progress = (done: number) => {
    const now = Date.now();
    if (now - last < PROGRESS_MS) return;
    last = now;
    self.postMessage({ id: job.id, progress: done });
  };
  const isCancelled = () => cancelled.has(job.id);
  try {
    const k = { key: job.key, nonce: new Uint8Array(job.nonce) };
    const result = job.op === "encrypt" ? await encryptOnce(job.file, k, job.chunk, progress, isCancelled) : await decryptBlob(job.blob, k, job, progress, isCancelled);
    self.postMessage({ id: job.id, result });
  } catch (err) {
    self.postMessage({ id: job.id, error: err instanceof CancelledError ? "cancelled" : err instanceof Error ? err.message : "failed", envelope: err instanceof EnvelopeError });
  } finally {
    cancelled.delete(job.id);
  }
};
