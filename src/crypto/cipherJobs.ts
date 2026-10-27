import { sha256 as nobleSha256 } from "@noble/hashes/sha2";
import { toB64 } from "./bytes";
import { EnvelopeError } from "./envelope";
import { type ChunkKey, chunkAad, chunkCount, chunkNonce, encryptChunks } from "./fileStream";
import { aesGcmDecrypt } from "./aead";

/**
 * The heavy parts of a file transfer (continuation brief v3 §2), written once and run in the cipher worker
 * (cipher.worker.ts) or, where workers aren't available, on the page. Same format as before (fileStream.ts): only the
 * number of passes and where the work runs changed.
 */

/** Progress callback: plaintext or ciphertext bytes processed so far. */
export type Progress = (done: number) => void;

/** Read in this many chunks per slice: fewer reads of the file, still bounded memory. */
const SLICE_CHUNKS = 4;
const TAG_BYTES = 16;

/**
 * Encrypts [file] once, hashing the ciphertext as it goes, and keeps the ciphertext as a Blob (browsers keep large
 * Blobs on disk). Uploads used to encrypt twice: once to learn the hash, once to send.
 */
export async function encryptOnce(file: Blob, k: ChunkKey, chunk: number, onProgress?: Progress, cancelled?: () => boolean): Promise<{ blob: Blob; sha256: string }> {
  const h = nobleSha256.create();
  const parts: Blob[] = [];
  let pending: Uint8Array[] = [];
  let done = 0;
  for await (const c of encryptChunks(blobSource(file), k, chunk)) {
    if (cancelled?.()) throw new CancelledError();
    h.update(c);
    pending.push(c);
    done += c.length;
    // Grouped into Blobs of a few chunks: fewer objects, and the browser can move them out of memory.
    if (pending.length >= SLICE_CHUNKS) {
      parts.push(new Blob(pending as BlobPart[]));
      pending = [];
    }
    onProgress?.(done);
  }
  if (pending.length) parts.push(new Blob(pending as BlobPart[]));
  return { blob: new Blob(parts, { type: "application/octet-stream" }), sha256: toB64(h.digest()) };
}

/**
 * Decrypts a chunked ciphertext Blob into a plaintext Blob: every chunk's tag, index and final flag, the chunk count
 * and the whole ciphertext's SHA-256 are checked (as decryptStream does), and nothing is returned unless all pass.
 */
export async function decryptBlob(ct: Blob, k: ChunkKey, meta: { chunk: number; size: number; sha256: string; mime: string }, onProgress?: Progress, cancelled?: () => boolean): Promise<Blob> {
  const count = chunkCount(meta.size, meta.chunk);
  const block = meta.chunk + TAG_BYTES;
  const expected = meta.size + count * TAG_BYTES;
  if (ct.size !== expected) throw new EnvelopeError(ct.size < expected ? "attachment truncated" : "attachment longer than announced");
  const h = nobleSha256.create();
  const out: Blob[] = [];
  let pending: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    if (cancelled?.()) throw new CancelledError();
    const piece = new Uint8Array(await ct.slice(i * block, Math.min(ct.size, (i + 1) * block)).arrayBuffer());
    h.update(piece);
    let plain: Uint8Array;
    try {
      plain = await aesGcmDecrypt(k.key, chunkNonce(k.nonce, i), piece, chunkAad(i, i === count - 1));
    } catch {
      throw new EnvelopeError("attachment decryption failed");
    }
    pending.push(plain);
    if (pending.length >= SLICE_CHUNKS) {
      out.push(new Blob(pending as BlobPart[]));
      pending = [];
    }
    onProgress?.(Math.min(ct.size, (i + 1) * block));
  }
  if (toB64(h.digest()) !== meta.sha256) throw new EnvelopeError("attachment integrity check failed");
  if (pending.length) out.push(new Blob(pending as BlobPart[]));
  return new Blob(out, { type: meta.mime });
}

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}

function blobSource(b: Blob) {
  return { size: b.size, slice: (start: number, end: number) => b.slice(start, end) };
}
