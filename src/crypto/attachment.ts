import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";
import { type Bytes, concat, fromB64, randomBytes, sha256, toB64, utf8 } from "./bytes";
import { EnvelopeError } from "./envelope";

/**
 * Attachment encryption (android crypto/EnvelopeCrypto.kt `AttachmentCrypto`, `ChunkedAttachmentCrypto`). A random key and
 * nonce per file; the key, nonce and the SHA-256 of the ciphertext travel inside the end-to-end encrypted message.
 */

export interface EncryptedFile {
  ciphertext: Bytes;
  key: string;
  nonce: string;
  /** SHA-256 of the ciphertext, base64. */
  sha256: string;
}

export interface FileSecrets {
  key: string;
  nonce: string;
  sha256: string;
  /** Plaintext bytes per chunk for files encrypted in chunks (over 25 MB); absent for the single-message format. */
  chunk?: number;
}

/** Single-message format (files up to 25 MB): what every Orbit app can open. */
export async function encryptFile(plain: Uint8Array): Promise<EncryptedFile> {
  const key = randomBytes(32);
  const nonce = randomBytes(12);
  try {
    const ciphertext = await aesGcmEncrypt(key, nonce, plain);
    return { ciphertext, key: toB64(key), nonce: toB64(nonce), sha256: toB64(await sha256(ciphertext)) };
  } finally {
    key.fill(0);
  }
}

const TAG_BYTES = 16;
const CHUNK_AAD = utf8("orbit-att-chunk");
const MIN_CHUNK = 1024;
const MAX_CHUNK = 16 * 1024 * 1024;

function chunkNonce(base: Uint8Array, i: number): Bytes {
  const n = new Uint8Array(base);
  for (let b = 0; b < 4; b++) n[8 + b] ^= (i >>> (8 * (3 - b))) & 0xff;
  return n;
}

function chunkAad(i: number, final: boolean): Bytes {
  return concat(CHUNK_AAD, new Uint8Array([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff, final ? 1 : 0]));
}

/** Checks the ciphertext hash, then decrypts. Throws [EnvelopeError] for a changed, truncated or foreign file. */
export async function decryptFile(ciphertext: Uint8Array, secrets: FileSecrets): Promise<Bytes> {
  if (toB64(await sha256(ciphertext)) !== secrets.sha256) throw new EnvelopeError("attachment integrity check failed");
  const key = fromB64(secrets.key);
  const nonce = fromB64(secrets.nonce);
  if (nonce.length !== 12) throw new EnvelopeError("attachment nonce invalid");
  try {
    if (secrets.chunk === undefined) return await aesGcmDecrypt(key, nonce, ciphertext);
    return await decryptChunked(key, nonce, ciphertext, secrets.chunk);
  } catch (e) {
    if (e instanceof EnvelopeError) throw e;
    throw new EnvelopeError("attachment decryption failed");
  } finally {
    key.fill(0);
  }
}

async function decryptChunked(key: Uint8Array, base: Uint8Array, ct: Uint8Array, chunk: number): Promise<Bytes> {
  if (!Number.isInteger(chunk) || chunk < MIN_CHUNK || chunk > MAX_CHUNK) throw new EnvelopeError("attachment chunk size not supported");
  const block = chunk + TAG_BYTES;
  const count = Math.ceil(ct.length / block);
  if (count === 0 || ct.length - (count - 1) * block < TAG_BYTES) throw new EnvelopeError("attachment decryption failed");
  const parts: Bytes[] = [];
  for (let i = 0; i < count; i++) {
    const final = i === count - 1;
    const piece = ct.subarray(i * block, final ? ct.length : (i + 1) * block);
    parts.push(await aesGcmDecrypt(key, chunkNonce(base, i), piece, chunkAad(i, final)));
  }
  return concat(...parts);
}
