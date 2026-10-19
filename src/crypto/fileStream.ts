import { sha256 as nobleSha256 } from "@noble/hashes/sha2";
import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";
import { type Bytes, concat, copy, fromB64, toB64, utf8 } from "./bytes";
import { EnvelopeError } from "./envelope";

/**
 * Large files in the chunked format (android ChunkedAttachmentCrypto, DEFAULT_CHUNK 1 MiB): each chunk encrypted on its
 * own, its nonce the file's nonce with the chunk index XORed into the last four bytes, its associated data
 * "orbit-att-chunk" ‖ index ‖ final flag. Encrypting and decrypting here go chunk by chunk, so a 1 GB file never sits
 * in memory whole, and the SHA-256 of the ciphertext is computed as it streams.
 */
export const CHUNK_BYTES = 1024 * 1024;
const TAG_BYTES = 16;
const CHUNK_AAD = utf8("orbit-att-chunk");
const MIN_CHUNK = 1024;
const MAX_CHUNK = 16 * 1024 * 1024;

export function chunkNonce(base: Uint8Array, i: number): Bytes {
  const n = new Uint8Array(base);
  for (let b = 0; b < 4; b++) n[8 + b] ^= (i >>> (8 * (3 - b))) & 0xff;
  return n;
}

export function chunkAad(i: number, final: boolean): Bytes {
  return concat(CHUNK_AAD, new Uint8Array([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff, final ? 1 : 0]));
}

/** Chunks a file of [plainSize] bytes has (an empty file still has one). */
export function chunkCount(plainSize: number, chunk = CHUNK_BYTES): number {
  return plainSize === 0 ? 1 : Math.ceil(plainSize / chunk);
}

/** The ciphertext's length: every chunk gains a 16-byte tag. */
export function cipherSize(plainSize: number, chunk = CHUNK_BYTES): number {
  return plainSize + chunkCount(plainSize, chunk) * TAG_BYTES;
}

/** A readable source of plaintext: a File or Blob in the browser. */
export interface PlainSource {
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export interface ChunkKey {
  key: CryptoKey;
  nonce: Bytes;
}

export async function importChunkKey(rawKey: Uint8Array, nonce: Uint8Array, usage: KeyUsage): Promise<ChunkKey> {
  if (rawKey.length !== 32 || nonce.length !== 12) throw new EnvelopeError("attachment key or nonce invalid");
  return { key: await crypto.subtle.importKey("raw", copy(rawKey), "AES-GCM", false, [usage]), nonce: copy(nonce) };
}

/** The ciphertext of [src], one encrypted chunk at a time, in order. */
export async function* encryptChunks(src: PlainSource, k: ChunkKey, chunk = CHUNK_BYTES): AsyncGenerator<Bytes> {
  const count = chunkCount(src.size, chunk);
  for (let i = 0; i < count; i++) {
    const plain = new Uint8Array(await src.slice(i * chunk, Math.min(src.size, (i + 1) * chunk)).arrayBuffer());
    yield await aesGcmEncrypt(k.key, chunkNonce(k.nonce, i), plain, chunkAad(i, i === count - 1));
  }
}

/** Re-cuts a stream of byte arrays into pieces of exactly [size] bytes (the last one shorter). */
export async function* rechunk(source: AsyncIterable<Uint8Array>, size: number): AsyncGenerator<Bytes> {
  let buf = new Uint8Array(size);
  let at = 0;
  for await (const piece of source) {
    let off = 0;
    while (off < piece.length) {
      const take = Math.min(size - at, piece.length - off);
      buf.set(piece.subarray(off, off + take), at);
      at += take;
      off += take;
      if (at === size) {
        yield buf;
        buf = new Uint8Array(size);
        at = 0;
      }
    }
  }
  if (at > 0) yield buf.slice(0, at);
}

/** SHA-256 (base64) of [src]'s ciphertext, without keeping it: the first of the two passes a large upload makes. */
export async function cipherHash(src: PlainSource, k: ChunkKey, chunk = CHUNK_BYTES, onProgress?: (done: number) => void): Promise<string> {
  const h = nobleSha256.create();
  let done = 0;
  for await (const c of encryptChunks(src, k, chunk)) {
    h.update(c);
    done += c.length;
    onProgress?.(done);
  }
  return toB64(h.digest());
}

/**
 * Decrypts a chunked ciphertext as it arrives, handing each plaintext chunk to [sink]. The whole ciphertext's SHA-256 is
 * checked at the end, and the chunk count against the announced size (no chunk dropped, added or reordered: each
 * chunk's index and the final flag are authenticated). Throws [EnvelopeError] otherwise; the caller discards what it
 * kept.
 */
export async function decryptStream(
  source: AsyncIterable<Uint8Array>,
  secrets: { key: string; nonce: string; sha256: string; chunk: number; size: number },
  sink: (plain: Bytes) => Promise<void> | void,
): Promise<void> {
  const { chunk } = secrets;
  if (!Number.isInteger(chunk) || chunk < MIN_CHUNK || chunk > MAX_CHUNK) throw new EnvelopeError("attachment chunk size not supported");
  const k = await importChunkKey(fromB64(secrets.key), fromB64(secrets.nonce), "decrypt");
  const count = chunkCount(secrets.size, chunk);
  const h = nobleSha256.create();
  let i = 0;
  try {
    for await (const block of rechunk(source, chunk + TAG_BYTES)) {
      h.update(block);
      if (i >= count) throw new EnvelopeError("attachment longer than announced");
      await sink(await aesGcmDecrypt(k.key, chunkNonce(k.nonce, i), block, chunkAad(i, i === count - 1)));
      i++;
    }
  } catch (e) {
    throw e instanceof EnvelopeError ? e : new EnvelopeError("attachment decryption failed");
  }
  if (i !== count) throw new EnvelopeError("attachment truncated");
  if (toB64(h.digest()) !== secrets.sha256) throw new EnvelopeError("attachment integrity check failed");
}
