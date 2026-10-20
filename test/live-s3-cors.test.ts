import nodeCrypto from "node:crypto";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { decryptFile, encryptFile } from "../src/crypto/attachment";
import type { Engine } from "../src/sync/engine";
import { openAttachment, resetAttachmentRoute, streamAttachment } from "../src/sync/attachments";
import { resetUploadRoute, uploadLarge } from "../src/sync/largeUpload";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";
import { nodeChunkedEncrypt } from "./support/reference";
import { serverDir } from "./support/serverDir";

/**
 * A server keeping files in S3 whose bucket has no CORS rule for the web app (production until one is added): the
 * browser can't follow the API's link to the bucket, nor upload to it. While browser code runs, fetch here refuses any
 * request that ends at the bucket's origin, as a browser does. `/media/attachments/<id>` is answered the way the web
 * server's nginx snippet does it (deploy/nginx/meldiq-web-media.conf.template, tested on its own against nginx): the API
 * is asked with the person's token, and its link to the bucket is followed without it. The S3 stand-in is the server's
 * own (signatures checked); every credential is generated for this run.
 */
const MB = 1024 * 1024;
let server: Server;
let alice: Phone;
let bob: Phone;
let web: Engine;
let dm: string;
let bucket: { url: string; uploads: Map<string, unknown>; close(): Promise<void> };
const original = globalThis.fetch;
const seen = { direct: 0, media: 0, bucketRefused: 0 };
let browser = false;
let mediaRoute = true;

/** The browser (no CORS on the bucket) and the web server (nginx's /media/attachments/), while [browser] is on. */
const fetchAsBrowser: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!browser) return original(input, init);
  if (url.origin === new URL(bucket.url).origin) {
    seen.bucketRefused++;
    throw new TypeError("Failed to fetch");
  }
  const media = /^\/media\/attachments\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
  if (media) {
    seen.media++;
    if (!mediaRoute) return new Response("<!doctype html><title>Meldiq</title>", { status: 200, headers: { "content-type": "text/html" } });
    const headers = new Headers(init?.headers);
    const api = await original(`${url.origin}/v1/attachments/${media[1]}`, { headers, redirect: "manual" });
    const location = api.headers.get("location");
    if (api.status < 300 || api.status >= 400 || !location) return api;
    if (!location.startsWith(`${bucket.url}/`)) return new Response("", { status: 502 });
    headers.delete("authorization");
    return original(location, { headers });
  }
  if (/^\/v1\/attachments\/[^/]+$/.test(url.pathname) && (init?.method ?? "GET") === "GET") {
    seen.direct++;
    const res = await original(input, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) return fetchAsBrowser(location, { ...init, headers: undefined });
    return res;
  }
  return original(input, init);
};

/** Runs [fn] as the browser would, with the counters reset. */
async function asBrowser<T>(fn: () => Promise<T>): Promise<T> {
  Object.assign(seen, { direct: 0, media: 0, bucketRefused: 0 });
  browser = true;
  try {
    return await fn();
  } finally {
    browser = false;
  }
}

/** A file the phone sends: encrypted on the phone, uploaded to the API, which stores it in the bucket. */
async function phoneFile(plain: Buffer, chunked = false) {
  if (chunked) {
    const enc = nodeChunkedEncrypt(plain, MB);
    const up = await bob.req("POST", `/v1/attachments?conversationId=${dm}`, undefined, enc.ciphertext);
    return { id: up.id as string, name: "clip.bin", mime: "application/octet-stream", size: plain.length, key: enc.key, nonce: enc.nonce, sha256: enc.sha256, chunk: MB };
  }
  const enc = await encryptFile(new Uint8Array(plain));
  const up = await bob.req("POST", `/v1/attachments?conversationId=${dm}`, undefined, Buffer.from(enc.ciphertext));
  return { id: up.id as string, name: "1000121611.jpg", mime: "image/jpeg", size: plain.length, key: enc.key, nonce: enc.nonce, sha256: enc.sha256 };
}

beforeAll(async () => {
  const fake = (await import(/* @vite-ignore */ path.join(serverDir(), "test/support/fakeS3.ts"))) as {
    startFakeS3(bucket: string, region: string, c: { accessKeyId: string; secretAccessKey: string }): Promise<{ url: string; uploads: Map<string, unknown>; close(): Promise<void> }>;
  };
  const creds = { accessKeyId: `AKIATEST${nodeCrypto.randomBytes(6).toString("hex").toUpperCase()}`, secretAccessKey: nodeCrypto.randomBytes(30).toString("base64") };
  bucket = await fake.startFakeS3("meldiq-test", "ap-southeast-1", creds);
  server = await startServer({
    STORAGE_BACKEND: "s3",
    S3_BUCKET: "meldiq-test",
    S3_REGION: "ap-southeast-1",
    S3_ENDPOINT: bucket.url,
    S3_FORCE_PATH_STYLE: "true",
    S3_ACCESS_KEY_ID: creds.accessKeyId,
    S3_SECRET_ACCESS_KEY: creds.secretAccessKey,
    S3_PART_SIZE: String(5 * MB),
    S3_MULTIPART_THRESHOLD: String(5 * MB),
    ATTACHMENT_MAX_BYTES: String(40 * MB),
  });
  alice = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  dm = (await bob.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  web = (await linkBrowser(server, alice)).engine;
  globalThis.fetch = fetchAsBrowser;
});
afterEach(() => {
  resetAttachmentRoute();
  resetUploadRoute();
  mediaRoute = true;
});
afterAll(async () => {
  globalThis.fetch = original;
  web?.stop();
  await server?.close();
  await bucket?.close();
});

describe("files kept in S3 without a CORS rule for the web app", () => {
  it("a photo from the phone opens: the refused bucket link is fetched again through the web server, and later files go there at once", async () => {
    const plain = nodeCrypto.randomBytes(300_000);
    const ref = await phoneFile(plain);
    const blob = await asBrowser(() => openAttachment(web, ref));
    expect(Buffer.from(await blob.arrayBuffer()).equals(plain)).toBe(true);
    expect(seen).toEqual({ direct: 1, bucketRefused: 1, media: 1 });

    const second = await phoneFile(nodeCrypto.randomBytes(1000));
    await asBrowser(() => openAttachment(web, second));
    expect(seen).toEqual({ direct: 0, bucketRefused: 0, media: 1 });
  });

  it("a large file from the phone streams through the web server too", async () => {
    const plain = nodeCrypto.randomBytes(6 * MB + 3);
    const ref = await phoneFile(plain, true);
    const hash = nodeCrypto.createHash("sha256");
    let got = 0;
    await asBrowser(() =>
      streamAttachment(web, ref, (p) => {
        got += p.length;
        hash.update(p);
      }),
    );
    expect(got).toBe(plain.length);
    expect(hash.digest("hex")).toBe(nodeCrypto.createHash("sha256").update(plain).digest("hex"));
  });

  it("where the site has no such route (a development server), the original error stays", async () => {
    mediaRoute = false;
    const ref = await phoneFile(nodeCrypto.randomBytes(500));
    await expect(asBrowser(() => openAttachment(web, ref))).rejects.toThrow("Can't reach the server");
  });

  it("an expired file still says so through the web server", async () => {
    const ref = await phoneFile(nodeCrypto.randomBytes(500));
    await asBrowser(() => openAttachment(web, ref));
    await expect(asBrowser(() => openAttachment(web, { ...ref, id: "nope-not-a-file" }))).rejects.toThrow("expired");
  });

  it("a large file from the browser: the refused direct upload is removed and the file goes through the API; the phone opens it", async () => {
    const plain = nodeCrypto.randomBytes(7 * MB + 11);
    const src = new Blob([plain]);
    const ref = await asBrowser(() => uploadLarge(web, dm, { name: "video.mp4", type: "video/mp4", size: plain.length, slice: (a, b) => src.slice(a, b) }));
    expect(seen.bucketRefused).toBeGreaterThan(0);
    const ct: Buffer = await bob.req("GET", `/v1/attachments/${ref.id}`);
    expect(Buffer.from(await decryptFile(ct, ref)).equals(plain)).toBe(true);
    // The refused multipart upload was removed from the bucket, not left half-done.
    expect(bucket.uploads.size).toBe(0);

    const again = await asBrowser(() => uploadLarge(web, dm, { name: "b.bin", type: "application/octet-stream", size: 6 * MB, slice: (a, b) => new Blob([new Uint8Array(6 * MB)]).slice(a, b) }));
    expect(again.id).toBeTruthy();
    expect(seen.bucketRefused).toBe(0);
  });
});
