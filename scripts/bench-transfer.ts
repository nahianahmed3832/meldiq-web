/**
 * Transfer crypto benchmark (briefs v3 and v4 §2): the work a file upload and a download do, on synthetic data in Node
 * (WebCrypto AES-GCM, SHA-256 from @noble or the platform). Prints milliseconds and MB/s per size.
 *   npx tsx scripts/bench-transfer.ts [sizes in MB, default 8 32 64 128 256]
 * "v3 encrypt" / "v3 decrypt": one chunk at a time, the ciphertext hashed in JavaScript as it streams (2026-10-27).
 * "v4 encrypt" / "v4 decrypt": cipherJobs.encryptOnce / decryptBlob now: chunks in flight together, and ciphertexts up
 * to 64 MiB hashed by the platform in one call. Same output, same checks.
 */
import { sha256 as nobleSha256 } from "@noble/hashes/sha2";
import { decryptBlob, encryptOnce } from "../src/crypto/cipherJobs";
import { aesGcmDecrypt } from "../src/crypto/aead";
import { toB64 } from "../src/crypto/bytes";
import { CHUNK_BYTES, chunkAad, chunkCount, chunkNonce, encryptChunks, importChunkKey } from "../src/crypto/fileStream";

const sizes = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => n > 0);
const MB = 1024 * 1024;

function file(size: number): Blob {
  const block = new Uint8Array(CHUNK_BYTES);
  crypto.getRandomValues(block.subarray(0, 65536));
  const parts: Uint8Array[] = [];
  for (let at = 0; at < size; at += CHUNK_BYTES) parts.push(block.subarray(0, Math.min(CHUNK_BYTES, size - at)));
  return new Blob(parts as BlobPart[]);
}

async function v3Encrypt(f: Blob, k: Awaited<ReturnType<typeof importChunkKey>>) {
  const h = nobleSha256.create();
  const parts: Uint8Array[] = [];
  for await (const c of encryptChunks({ size: f.size, slice: (a, b) => f.slice(a, b) }, k)) {
    h.update(c);
    parts.push(c);
  }
  return { blob: new Blob(parts as BlobPart[]), sha256: toB64(h.digest()) };
}

async function v3Decrypt(ct: Blob, k: Awaited<ReturnType<typeof importChunkKey>>, size: number) {
  const count = chunkCount(size);
  const block = CHUNK_BYTES + 16;
  const h = nobleSha256.create();
  const out: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const piece = new Uint8Array(await ct.slice(i * block, (i + 1) * block).arrayBuffer());
    h.update(piece);
    out.push(await aesGcmDecrypt(k.key, chunkNonce(k.nonce, i), piece, chunkAad(i, i === count - 1)));
  }
  return toB64(h.digest());
}

const time = async (fn: () => Promise<unknown>) => {
  const t = performance.now();
  await fn();
  return performance.now() - t;
};
const line = (mb: number, name: string, ms: number) =>
  console.log(`${String(mb).padStart(4)} MB  ${name.padEnd(11)} ${ms.toFixed(0).padStart(6)} ms  ${((mb / ms) * 1000).toFixed(0).padStart(5)} MB/s`);

for (const mb of sizes.length ? sizes : [8, 32, 64, 128, 256]) {
  const f = file(mb * MB);
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ek = await importChunkKey(raw, nonce, "encrypt");
  const dk = await importChunkKey(raw, nonce, "decrypt");
  // Warm-up, then the best of three (the machine's other work adds noise).
  await encryptOnce(file(MB), ek, CHUNK_BYTES);
  const best = async (fn: () => Promise<unknown>) => Math.min(await time(fn), await time(fn), await time(fn));
  const v3 = await v3Encrypt(f, ek);
  const v4 = await encryptOnce(f, ek, CHUNK_BYTES);
  if (v3.sha256 !== v4.sha256) throw new Error("hashes differ");
  line(mb, "v3 encrypt", await best(() => v3Encrypt(f, ek)));
  line(mb, "v4 encrypt", await best(() => encryptOnce(f, ek, CHUNK_BYTES)));
  line(mb, "v3 decrypt", await best(() => v3Decrypt(v4.blob, dk, f.size)));
  line(mb, "v4 decrypt", await best(() => decryptBlob(v4.blob, dk, { chunk: CHUNK_BYTES, size: f.size, sha256: v4.sha256, mime: "application/octet-stream" })));
}
