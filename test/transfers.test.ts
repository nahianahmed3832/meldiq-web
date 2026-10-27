import nodeCrypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fromB64 } from "../src/crypto/bytes";
import { decryptBlob, encryptOnce } from "../src/crypto/cipherJobs";
import { CHUNK_BYTES, cipherSize, importChunkKey } from "../src/crypto/fileStream";
import type { Engine } from "../src/sync/engine";
import { Transfers } from "../src/sync/transfers";
import { nodeChunkedEncrypt } from "./support/reference";

/**
 * Sending files (continuation brief v3 §2): one encryption pass with the same bytes as before, transfers that survive
 * leaving the view and a reload, joined rather than duplicated, no raw key or plaintext kept, cancel cleans up.
 */

const MB = 1024 * 1024;

/** A store like LocalStore's kv part (structured values kept as they are, as IndexedDB would). */
function memoryStore() {
  const kv = new Map<string, unknown>();
  return {
    kv,
    getValue: async (k: string) => kv.get(k),
    setValue: async (k: string, v: unknown) => void kv.set(k, structuredClone(v)),
    deleteValue: async (k: string) => void kv.delete(k),
    valuesWithPrefix: async (p: string) => [...kv].filter(([k]) => k.startsWith(p)).map(([key, value]) => ({ key, value })),
  };
}

/** An engine whose server stores uploads through the API (no S3) and records sent messages. */
function fakeEngine(store = memoryStore(), opts: { failUploads?: number } = {}) {
  let failures = opts.failUploads ?? 0;
  const uploads: number[] = [];
  const sent: { conversationId: string; text: string; attachments: { id: string; key: string; size: number }[] }[] = [];
  const engine = {
    store,
    state: { get: () => ({ server: { attachmentMaxBytes: 2 * 1024 * MB, fileMaxBytes: 1024 * MB } }) },
    session: { token: () => "t", reauthenticate: async () => false },
    api: {
      base: "http://api",
      json: vi.fn(async (method: string, path: string, _schema: unknown, o: { raw?: Uint8Array } = {}) => {
        if (path === "/v1/attachments/uploads") throw Object.assign(new (await import("../src/api/client")).ApiError(409, "direct_upload_unavailable", "no"), {});
        if (method === "POST" && path.startsWith("/v1/attachments?")) {
          uploads.push(o.raw?.length ?? 0);
          return { id: `a${uploads.length}`, size: o.raw?.length ?? 0, expiresAt: 0 };
        }
        throw new Error(`unexpected ${method} ${path}`);
      }),
      call: vi.fn(async () => undefined),
    },
    sendText: vi.fn(async (conversationId: string, text: string, o: { attachments: { id: string; key: string; size: number }[] }) => {
      sent.push({ conversationId, text, attachments: o.attachments });
      return "m1";
    }),
  };
  // Large files go through POST /v1/attachments as one body (the BodySender is fetch here): answered by this stub.
  const fetchStub = vi.fn(async (_url: string, init: { body: Blob }) => {
    if (failures > 0) {
      failures--;
      throw new TypeError("network down");
    }
    uploads.push(init.body.size);
    return new Response(JSON.stringify({ id: `big${uploads.length}`, size: init.body.size, expiresAt: 0 }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchStub);
  return { engine: engine as unknown as Engine, uploads, sent, store, fetchStub };
}

const file = (name: string, bytes: Uint8Array, lastModified = 1) => ({ name, type: "application/octet-stream", size: bytes.length, lastModified, source: new Blob([new Uint8Array(bytes)]) });

async function settled(t: Transfers, id: string) {
  for (let i = 0; i < 400; i++) {
    const j = t.list().find((x) => x.id === id);
    if (!j || j.status !== "running") return j;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("transfer never finished");
}

describe("one encryption pass", () => {
  it("produces exactly the reference ciphertext and hash, and decrypts back with every check", async () => {
    const plain = nodeCrypto.randomBytes(3 * CHUNK_BYTES + 777);
    const ref = nodeChunkedEncrypt(plain, CHUNK_BYTES);
    const k = await importChunkKey(fromB64(ref.key), fromB64(ref.nonce), "encrypt");
    const { blob, sha256 } = await encryptOnce(new Blob([plain]), k, CHUNK_BYTES);
    expect(Buffer.from(await blob.arrayBuffer()).equals(ref.ciphertext)).toBe(true);
    expect(sha256).toBe(ref.sha256);
    const dk = await importChunkKey(fromB64(ref.key), fromB64(ref.nonce), "decrypt");
    const out = await decryptBlob(blob, dk, { chunk: CHUNK_BYTES, size: plain.length, sha256, mime: "x/y" });
    expect(Buffer.from(await out.arrayBuffer()).equals(plain)).toBe(true);
    const bad = Buffer.from(ref.ciphertext);
    bad[CHUNK_BYTES + 40] ^= 1;
    await expect(decryptBlob(new Blob([bad]), dk, { chunk: CHUNK_BYTES, size: plain.length, sha256, mime: "x/y" })).rejects.toThrow();
    await expect(decryptBlob(blob.slice(0, blob.size - 1), dk, { chunk: CHUNK_BYTES, size: plain.length, sha256, mime: "x/y" })).rejects.toThrow(/truncated/);
  });
});

describe("transfers", () => {
  it("send once, and the same send while it runs joins it", async () => {
    const { engine, sent, uploads } = fakeEngine();
    const t = new Transfers(engine);
    const big = nodeCrypto.randomBytes(26 * MB);
    const a = await t.start("c1", [file("big.bin", big)], "look");
    const b = await t.start("c1", [file("big.bin", big)], "look");
    expect(b).toBe(a);
    const done = await settled(t, a);
    expect(done?.status).toBe("sent");
    expect(uploads).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].attachments[0]).toMatchObject({ size: big.length, chunk: CHUNK_BYTES });
  });

  it("keeps no plaintext and no raw key in the browser's database, only ciphertext and a sealed key", async () => {
    const { engine, store } = fakeEngine(undefined, { failUploads: 99 });
    const t = new Transfers(engine);
    const big = nodeCrypto.randomBytes(26 * MB);
    const id = await t.start("c1", [file("big.bin", big)], "");
    expect((await settled(t, id))?.status).toBe("failed");
    const kept = store.kv.get(`transfer:${id}`) as { files: { ciphertext?: Blob; sealedKey?: { wrapped: string }; nonce?: string }[] };
    const f = kept.files[0];
    expect(f.ciphertext?.size).toBe(cipherSize(big.length));
    expect(f.sealedKey?.wrapped).toBeTruthy();
    // Nothing kept equals the plaintext's first bytes, and no field is a bare 32-byte key.
    const json = JSON.stringify(kept, (_k, v) => (v instanceof Blob ? "[blob]" : v));
    expect(json).not.toMatch(/"key"/);
    expect(Buffer.from(await f.ciphertext!.slice(0, 64).arrayBuffer()).equals(big.subarray(0, 64))).toBe(false);
    expect(store.kv.get("transfer-wrap-key")).toBeInstanceOf(CryptoKey);
  });

  it("after a reload comes back interrupted and resumes from the kept ciphertext without encrypting again", async () => {
    const store = memoryStore();
    const first = fakeEngine(store, { failUploads: 99 });
    const t1 = new Transfers(first.engine);
    const big = nodeCrypto.randomBytes(26 * MB);
    const id = await t1.start("c1", [file("big.bin", big)], "hi");
    await settled(t1, id);
    // A new page: a new manager over the same database, the file not chosen again.
    const second = fakeEngine(store);
    const t2 = new Transfers(second.engine);
    await t2.load();
    expect(t2.list("c1")[0]).toMatchObject({ id, status: "interrupted" });
    const enc = await import("../src/crypto/cipherJobs");
    const spy = vi.spyOn(enc, "encryptOnce");
    t2.resume(id);
    expect((await settled(t2, id))?.status).toBe("sent");
    expect(spy).not.toHaveBeenCalled();
    expect(second.sent[0].attachments[0].size).toBe(big.length);
    expect(store.kv.has(`transfer:${id}`)).toBe(false);
  });

  it("a small file interrupted before uploading asks for the file again", async () => {
    const store = memoryStore();
    store.kv.set("transfer:x", { id: "x", conversationId: "c1", caption: "", createdAt: 1, files: [{ name: "a.txt", type: "text/plain", size: 3, lastModified: 5 }] });
    const { engine, sent } = fakeEngine(store);
    const t = new Transfers(engine);
    await t.load();
    t.resume("x");
    const j = await settled(t, "x");
    expect(j?.status).toBe("interrupted");
    expect(j?.files[0].needsFile).toBe(true);
    t.resume("x", [{ name: "a.txt", type: "text/plain", size: 3, lastModified: 5, source: new Blob(["abc"]) }]);
    expect((await settled(t, "x"))?.status).toBe("sent");
    expect(sent).toHaveLength(1);
  });

  it("cancel stops it and forgets its checkpoint", async () => {
    const { engine, store } = fakeEngine(undefined, { failUploads: 99 });
    const t = new Transfers(engine);
    const id = await t.start("c1", [file("big.bin", nodeCrypto.randomBytes(26 * MB))], "");
    await settled(t, id);
    t.cancel(id);
    await new Promise((r) => setTimeout(r, 20));
    expect(t.list()[0]?.status).toBe("cancelled");
    expect(store.kv.has(`transfer:${id}`)).toBe(false);
  });
});
