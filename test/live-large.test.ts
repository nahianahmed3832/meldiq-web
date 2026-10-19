import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { decryptFile } from "../src/crypto/attachment";
import { openAttachment, sendFiles, streamAttachment } from "../src/sync/attachments";
import type { Engine } from "../src/sync/engine";
import { type BodySender, uploadLarge } from "../src/sync/largeUpload";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";
import { b64, nodeChunkedEncrypt } from "./support/reference";

/**
 * Files over the single-message size against the real server: chunked encryption streamed to POST /v1/attachments
 * (this test server has no S3), opened by the reference client exactly as the phone opens them; and the phone's chunked
 * files streamed back into the browser. The S3 multipart path runs against a simulated store with the server's rules.
 */
let server: Server;
let alice: Phone;
let bob: Phone;
let web: Engine;
let dm: string;
const MB = 1024 * 1024;

beforeAll(async () => {
  server = await startServer({ ATTACHMENT_MAX_BYTES: String(64 * MB) });
  alice = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  dm = (await bob.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  await bob.connect();
  web = (await linkBrowser(server, alice)).engine;
});
afterAll(async () => {
  web?.stop();
  await server?.close();
});

describe("large files", () => {
  it("a 30 MB file goes out in the chunked format through the API, and the phone's side opens it", async () => {
    const plain = nodeCrypto.randomBytes(30 * MB + 5);
    const blob = new Blob([plain]);
    const phases = new Set<string>();
    const id = await sendFiles(web, dm, [{ name: "video.mp4", type: "video/mp4", size: plain.length, bytes: async () => new Uint8Array(plain), source: blob }], "big one", {}, undefined, {
      onProgress: (_n, p) => phases.add(p.phase),
    });
    expect([...phases].sort()).toEqual(["hashing", "uploading"]);
    const m = await bob.waitFor(() => bob.received.find((x) => x.messageId === id));
    const ref = m.payload.attachments[0];
    expect(ref).toMatchObject({ size: plain.length, chunk: MB, mime: "video/mp4" });
    const ct: Buffer = await bob.req("GET", `/v1/attachments/${ref.id}`);
    expect(Buffer.from(await decryptFile(ct, ref)).equals(plain)).toBe(true);
  });

  it("the phone's chunked file streams into the browser and decrypts", async () => {
    const plain = nodeCrypto.randomBytes(27 * MB);
    const enc = nodeChunkedEncrypt(plain, MB);
    const up = await bob.req("POST", `/v1/attachments?conversationId=${dm}`, undefined, enc.ciphertext);
    const ref = { id: up.id, name: "phone.bin", mime: "application/octet-stream", size: plain.length, key: enc.key, nonce: enc.nonce, sha256: enc.sha256, chunk: MB };
    let got = 0;
    const hash = nodeCrypto.createHash("sha256");
    await streamAttachment(web, ref, (p) => {
      got += p.length;
      hash.update(p);
    });
    expect(got).toBe(plain.length);
    expect(hash.digest("hex")).toBe(nodeCrypto.createHash("sha256").update(plain).digest("hex"));
    const opened = await openAttachment(web, ref);
    expect(Buffer.from(await opened.arrayBuffer()).equals(plain)).toBe(true);
    // A wrong hash is refused before anything is shown.
    await expect(openAttachment(web, { ...ref, id: up.id, sha256: b64(new Uint8Array(32)), name: "x" })).rejects.toThrow(/integrity/);
  });

  it("refuses a file over the server's limit before encrypting anything", async () => {
    const huge = { name: "huge.bin", type: "", size: 2 * 1024 * MB, bytes: async () => new Uint8Array(0), source: new Blob([]) };
    await expect(sendFiles(web, dm, [huge], "")).rejects.toThrow(/larger than/);
  });
});

/**
 * The S3 path (POST /v1/attachments/uploads → 16 MiB parts, each presigned and bound to its size and SHA-256 → GET parts
 * for the ETags → complete), against a simulated server and store that check what the real ones check.
 */
describe("direct uploads to S3 in parts (simulated store)", () => {
  function fakeServer(partSize: number) {
    const stored = new Map<number, Buffer>();
    let completed: { parts: { n: number; etag: string; sha256: string }[] } | null = null;
    let deleted = false;
    const api = {
      base: "https://api.test",
      async json(method: string, path: string, schema: { parse(x: unknown): unknown }, opts: { body?: any } = {}) {
        if (method === "POST" && path === "/v1/attachments/uploads") {
          const size = opts.body.size as number;
          return schema.parse({ mode: "multipart", uploadId: "a_1", partSize, partCount: Math.ceil(size / partSize), expiresAt: Date.now() + 1e6 });
        }
        if (method === "POST" && path.endsWith("/parts")) {
          const [p] = opts.body.parts;
          return schema.parse({ parts: [{ n: p.n, upload: { method: "PUT", url: `https://s3.test/part/${p.n}?sha=${encodeURIComponent(p.sha256)}&size=${p.size}`, headers: {}, expiresAt: 1 } }] });
        }
        if (method === "GET" && path.endsWith("/parts")) return schema.parse({ parts: [...stored.entries()].map(([n, b]) => ({ n, etag: `"e${n}"`, size: b.length })) });
        if (method === "POST" && path.endsWith("/complete")) {
          completed = opts.body;
          return schema.parse({ id: "a_1", size: 1, expiresAt: 1 });
        }
        throw new Error(`unexpected ${method} ${path}`);
      },
      async call(method: string) {
        if (method === "DELETE") deleted = true;
      },
    };
    // The store refuses a part whose size or SHA-256 differs from what the URL was signed for (as S3 does).
    const send: BodySender = async (req, onSent) => {
      const u = new URL(req.url);
      const body = Buffer.from(await req.body.arrayBuffer());
      if (body.length !== Number(u.searchParams.get("size")) || nodeCrypto.createHash("sha256").update(body).digest("base64") !== u.searchParams.get("sha")) {
        throw new ApiError(403, "upload_failed", "signature mismatch");
      }
      stored.set(Number(u.pathname.split("/").pop()), body);
      onSent(body.length);
      return "";
    };
    const engine = { api, state: { get: () => ({ server: null }) }, session: { token: () => "t", reauthenticate: async () => false } } as unknown as Engine;
    return { engine, send, stored, completed: () => completed, deleted: () => deleted };
  }

  it("uploads every part with its own hash, then completes with the store's ETags; the parts are the ciphertext", async () => {
    const f = fakeServer(5 * MB);
    const plain = nodeCrypto.randomBytes(12 * MB + 3);
    const ref = await uploadLarge(f.engine, "c1", { name: "x.bin", type: "application/octet-stream", size: plain.length, slice: (a, b) => new Blob([plain]).slice(a, b) }, { send: f.send });
    expect(f.stored.size).toBe(3);
    expect(f.completed()?.parts.map((p) => [p.n, p.etag])).toEqual([
      [1, '"e1"'],
      [2, '"e2"'],
      [3, '"e3"'],
    ]);
    const ct = Buffer.concat([1, 2, 3].map((n) => f.stored.get(n)!));
    expect(Buffer.from(await decryptFile(ct, ref)).equals(plain)).toBe(true);
    expect(ref).toMatchObject({ id: "a_1", size: plain.length, chunk: MB });
  });

  it("removes a half-done upload when a part is refused", async () => {
    const f = fakeServer(5 * MB);
    const plain = nodeCrypto.randomBytes(7 * MB);
    const failing: BodySender = async (req, onSent) => {
      if (req.url.includes("/part/2")) throw new ApiError(500, "upload_failed", "boom");
      return f.send(req, onSent);
    };
    await expect(uploadLarge(f.engine, "c1", { name: "x", type: "", size: plain.length, slice: (a, b) => new Blob([plain]).slice(a, b) }, { send: failing })).rejects.toThrow("boom");
    expect(f.deleted()).toBe(true);
  });
});
