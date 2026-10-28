import { sha256 as nobleSha256 } from "@noble/hashes/sha2";
import { toB64 } from "./bytes";
import { EnvelopeError } from "./envelope";
import { type ChunkKey, chunkAad, chunkCount, chunkNonce } from "./fileStream";
import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";

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
 * Ciphertexts up to this size are hashed with the platform's SHA-256 (crypto.subtle.digest) in one call, several times
 * faster than hashing in JavaScript chunk by chunk (brief v4 §2); it needs the whole ciphertext in memory once, so
 * larger files keep the streaming hash and bounded memory. Same hash either way.
 */
export const WHOLE_HASH_MAX = 65 * 1024 * 1024; // a 64 MiB file and its tags
/** AES-GCM chunks in flight at once: WebCrypto works on them off this thread while the next are read. */
const IN_FLIGHT = 4;

const digestB64 = async (b: Blob): Promise<string> => toB64(new Uint8Array(await crypto.subtle.digest("SHA-256", await b.arrayBuffer())));

/**
 * Encrypts [file] once, hashing the ciphertext, and keeps the ciphertext as a Blob (browsers keep large Blobs on disk).
 * Uploads used to encrypt twice: once to learn the hash, once to send. Each chunk keeps its own nonce (the file's
 * nonce with the chunk index) and associated data; only how many are worked on at once changed.
 */
export async function encryptOnce(file: Blob, k: ChunkKey, chunk: number, onProgress?: Progress, cancelled?: () => boolean): Promise<{ blob: Blob; sha256: string }> {
  const count = chunkCount(file.size, chunk);
  const whole = file.size + count * TAG_BYTES <= WHOLE_HASH_MAX;
  const h = whole ? null : nobleSha256.create();
  const parts: Blob[] = [];
  let pending: Uint8Array[] = [];
  let done = 0;
  const encryptAt = async (i: number) => {
    const plain = new Uint8Array(await file.slice(i * chunk, Math.min(file.size, (i + 1) * chunk)).arrayBuffer());
    return aesGcmEncrypt(k.key, chunkNonce(k.nonce, i), plain, chunkAad(i, i === count - 1));
  };
  const queue: Promise<Uint8Array>[] = [];
  for (let i = 0; i < Math.min(IN_FLIGHT, count); i++) queue.push(encryptAt(i));
  for (let i = 0; i < count; i++) {
    if (cancelled?.()) throw new CancelledError();
    const c = await queue.shift()!;
    if (i + IN_FLIGHT < count) queue.push(encryptAt(i + IN_FLIGHT));
    h?.update(c);
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
  const blob = new Blob(parts, { type: "application/octet-stream" });
  return { blob, sha256: h ? toB64(h.digest()) : await digestB64(blob) };
}

/**
 * Decrypts a chunked ciphertext Blob into a plaintext Blob: every chunk's tag, index and final flag, the chunk count
 * and the whole ciphertext's SHA-256 are checked (as decryptStream does), and nothing is returned unless all pass. A
 * ciphertext small enough is hashed first, in one call, so a corrupt copy fails before any decryption.
 */
export async function decryptBlob(ct: Blob, k: ChunkKey, meta: { chunk: number; size: number; sha256: string; mime: string }, onProgress?: Progress, cancelled?: () => boolean): Promise<Blob> {
  const count = chunkCount(meta.size, meta.chunk);
  const block = meta.chunk + TAG_BYTES;
  const expected = meta.size + count * TAG_BYTES;
  if (ct.size !== expected) throw new EnvelopeError(ct.size < expected ? "attachment truncated" : "attachment longer than announced");
  const whole = ct.size <= WHOLE_HASH_MAX;
  if (whole && (await digestB64(ct)) !== meta.sha256) throw new EnvelopeError("attachment integrity check failed");
  const h = whole ? null : nobleSha256.create();
  const out: Blob[] = [];
  let pending: Uint8Array[] = [];
  const read = async (i: number) => new Uint8Array(await ct.slice(i * block, Math.min(ct.size, (i + 1) * block)).arrayBuffer());
  const decryptAt = async (i: number) => {
    const piece = await read(i);
    const plain = aesGcmDecrypt(k.key, chunkNonce(k.nonce, i), piece, chunkAad(i, i === count - 1)).catch(() => {
      throw new EnvelopeError("attachment decryption failed");
    });
    // Observed now, awaited in order below: a later chunk failing while an earlier one is awaited isn't "unhandled".
    plain.catch(() => undefined);
    return { piece, plain };
  };
  const queue: Promise<{ piece: Uint8Array; plain: Promise<Uint8Array> }>[] = [];
  for (let i = 0; i < Math.min(IN_FLIGHT, count); i++) queue.push(decryptAt(i));
  try {
    for (let i = 0; i < count; i++) {
      if (cancelled?.()) throw new CancelledError();
      const { piece, plain } = await queue.shift()!;
      if (i + IN_FLIGHT < count) queue.push(decryptAt(i + IN_FLIGHT));
      h?.update(piece);
      pending.push(await plain);
      if (pending.length >= SLICE_CHUNKS) {
        out.push(new Blob(pending as BlobPart[]));
        pending = [];
      }
      onProgress?.(Math.min(ct.size, (i + 1) * block));
    }
  } finally {
    // Decryptions still running when one failed are left to settle unobserved.
    for (const q of queue) void q.then((x) => x.plain.catch(() => undefined)).catch(() => undefined);
  }
  if (h && toB64(h.digest()) !== meta.sha256) throw new EnvelopeError("attachment integrity check failed");
  if (pending.length) out.push(new Blob(pending as BlobPart[]));
  return new Blob(out, { type: meta.mime });
}

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
  }
}
