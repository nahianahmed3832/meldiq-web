import nodeCrypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { fromB64, toB64 } from "../src/crypto/bytes";
import { decryptFile } from "../src/crypto/attachment";
import { CHUNK_BYTES, cipherHash, cipherSize, chunkCount, decryptStream, encryptChunks, importChunkKey, rechunk } from "../src/crypto/fileStream";
import { fileLimit } from "../src/sync/attachments";
import { nodeChunkedEncrypt } from "./support/reference";

const blobOf = (b: Uint8Array) => new Blob([new Uint8Array(b)]);
async function* pieces(b: Uint8Array, size: number) {
  for (let i = 0; i < b.length; i += size) yield b.subarray(i, i + size);
}
const collect = async (it: AsyncIterable<Uint8Array>) => {
  const out: Uint8Array[] = [];
  for await (const x of it) out.push(x);
  return Buffer.concat(out);
};

describe("chunked files streamed (android ChunkedAttachmentCrypto)", () => {
  it("encrypts in chunks exactly as the reference implementation does", async () => {
    const plain = nodeCrypto.randomBytes(2 * CHUNK_BYTES + 12_345);
    const ref = nodeChunkedEncrypt(plain, CHUNK_BYTES);
    const k = await importChunkKey(fromB64(ref.key), fromB64(ref.nonce), "encrypt");
    const ct = await collect(encryptChunks(blobOf(plain), k));
    expect(ct.equals(ref.ciphertext)).toBe(true);
    expect(ct.length).toBe(cipherSize(plain.length));
    expect(await cipherHash(blobOf(plain), k)).toBe(ref.sha256);
    expect(chunkCount(0)).toBe(1);
    expect(cipherSize(0)).toBe(16);
  });

  it("decrypts the reference's ciphertext however the network cuts it, and agrees with the in-memory decryptor", async () => {
    const plain = nodeCrypto.randomBytes(3 * CHUNK_BYTES + 7);
    const ref = nodeChunkedEncrypt(plain, CHUNK_BYTES);
    for (const cut of [1000, 65_536, CHUNK_BYTES + 16, 5 * CHUNK_BYTES]) {
      const out: Uint8Array[] = [];
      await decryptStream(pieces(ref.ciphertext, cut), { ...ref, size: plain.length }, (p) => void out.push(p));
      expect(Buffer.concat(out).equals(plain)).toBe(true);
    }
    expect(Buffer.from(await decryptFile(ref.ciphertext, ref)).equals(plain)).toBe(true);
  });

  it("refuses a truncated, extended, reordered or altered file", async () => {
    const plain = nodeCrypto.randomBytes(2 * CHUNK_BYTES + 100);
    const ref = nodeChunkedEncrypt(plain, CHUNK_BYTES);
    const run = (ct: Uint8Array, size = plain.length) => decryptStream(pieces(ct, 70_000), { ...ref, size }, () => undefined);
    const block = CHUNK_BYTES + 16;
    await expect(run(ref.ciphertext.subarray(0, 2 * block))).rejects.toThrow();
    await expect(run(Buffer.concat([ref.ciphertext, ref.ciphertext.subarray(0, block)]))).rejects.toThrow();
    const swapped = Buffer.concat([ref.ciphertext.subarray(block, 2 * block), ref.ciphertext.subarray(0, block), ref.ciphertext.subarray(2 * block)]);
    await expect(run(swapped)).rejects.toThrow();
    const flipped = Buffer.from(ref.ciphertext);
    flipped[10] ^= 1;
    await expect(run(flipped)).rejects.toThrow();
    // The right bytes but the wrong announced size (a chunk count that doesn't match).
    await expect(run(ref.ciphertext, plain.length + CHUNK_BYTES)).rejects.toThrow();
    await expect(decryptStream(pieces(ref.ciphertext, 70_000), { ...ref, sha256: toB64(new Uint8Array(32)), size: plain.length }, () => undefined)).rejects.toThrow(/integrity/);
  });

  it("re-cuts a stream into fixed parts (16 MiB S3 parts from 1 MiB chunks)", async () => {
    const data = nodeCrypto.randomBytes(10_000);
    const parts = [];
    for await (const p of rechunk(pieces(data, 777), 4096)) parts.push(p);
    expect(parts.map((p) => p.length)).toEqual([4096, 4096, 1808]);
    expect(Buffer.concat(parts).equals(data)).toBe(true);
  });

  it("takes the per-file limit from the server", () => {
    expect(fileLimit({ fileMaxBytes: 1024 ** 3, attachmentMaxBytes: 1024 ** 3 + 1024 ** 2 })).toBe(1024 ** 3);
    expect(fileLimit({ attachmentMaxBytes: 25 * 1024 * 1024 })).toBe(25 * 1024 * 1024 - 16);
    expect(fileLimit(null)).toBe(25 * 1024 * 1024);
    expect(new ApiError(413, "too_large", "x").status).toBe(413);
  });
});
