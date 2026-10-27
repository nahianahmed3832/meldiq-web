/**
 * Transfer crypto benchmark (continuation brief v3 §2): the work a large upload does before and after the 2026-10-27
 * changes, on synthetic data in Node (WebCrypto AES-GCM, @noble SHA-256). Prints milliseconds and MB/s per size.
 *   npx tsx scripts/bench-transfer.ts [sizes in MB, default 32 128 256]
 * "two-pass" is the old upload: hash the ciphertext (encrypt pass 1), then encrypt again while uploading (pass 2).
 * "one-pass" encrypts once, hashing as it goes, keeping the ciphertext (what uploads do now).
 */
import { CHUNK_BYTES, cipherHash, encryptChunks, importChunkKey } from "../src/crypto/fileStream";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2";

const sizes = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => n > 0);
const MB = 1024 * 1024;

function source(size: number) {
  const block = new Uint8Array(CHUNK_BYTES);
  crypto.getRandomValues(block.subarray(0, 65536));
  return { size, slice: (a: number, b: number) => ({ arrayBuffer: async () => block.slice(0, b - a).buffer }) };
}

async function twoPass(size: number) {
  const k = await importChunkKey(crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(12)), "encrypt");
  const src = source(size);
  await cipherHash(src, k);
  let n = 0;
  for await (const c of encryptChunks(src, k)) n += c.length;
  return n;
}

async function onePass(size: number) {
  const k = await importChunkKey(crypto.getRandomValues(new Uint8Array(32)), crypto.getRandomValues(new Uint8Array(12)), "encrypt");
  const h = nobleSha256.create();
  const parts: Uint8Array[] = [];
  for await (const c of encryptChunks(source(size), k)) {
    h.update(c);
    parts.push(c);
  }
  h.digest();
  return parts.length;
}

for (const mb of sizes.length ? sizes : [32, 128, 256]) {
  for (const [name, fn] of [
    ["two-pass", twoPass],
    ["one-pass", onePass],
  ] as const) {
    const t = performance.now();
    await fn(mb * MB);
    const ms = performance.now() - t;
    console.log(`${String(mb).padStart(4)} MB  ${name}  ${ms.toFixed(0).padStart(6)} ms  ${((mb / ms) * 1000).toFixed(0).padStart(4)} MB/s`);
  }
}
