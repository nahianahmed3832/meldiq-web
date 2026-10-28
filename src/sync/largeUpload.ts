import { z } from "zod";
import { ApiError } from "../api/client";
import { randomBytes, sha256, toB64 } from "../crypto/bytes";
import { CancelledError, encryptFileOnce } from "../crypto/cipherClient";
import { CHUNK_BYTES, cipherSize, importChunkKey, type PlainSource } from "../crypto/fileStream";
import type { AttachmentRef } from "../protocol/payload";
import type { Engine } from "./engine";

/**
 * Files over the single-message size (docs/ORBIT_2_ARCHITECTURE §7, up to 1 GiB): encrypted in 1 MiB chunks without
 * ever holding the file in memory. One pass (since 2026-10-27; it used to be two): the cipher worker encrypts and hashes
 * the ciphertext (the server and the recipients check the hash) into a Blob the browser keeps on disk, which is then
 * uploaded, part by part where the server uses S3, and can continue after an interruption (transfers.ts).
 *
 * - Servers with S3 take the ciphertext directly (POST /v1/attachments/uploads): one presigned PUT, or 16 MiB parts each
 *   bound to its size and SHA-256, then /complete. The bucket must allow PUT from the web origin (CORS).
 * - Others answer 409 direct_upload_unavailable, and the ciphertext goes to POST /v1/attachments as one streamed body.
 */

const zPresigned = z.object({ method: z.literal("PUT"), url: z.string().url(), headers: z.record(z.string(), z.string()).default({}), expiresAt: z.number() });
const zStart = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("single"), uploadId: z.string(), upload: zPresigned, expiresAt: z.number() }),
  z.object({ mode: z.literal("multipart"), uploadId: z.string(), partSize: z.number().int().positive(), partCount: z.number().int().positive(), expiresAt: z.number() }),
]);
const zParts = z.object({ parts: z.array(z.object({ n: z.number(), upload: zPresigned })) });
const zHave = z.object({ parts: z.array(z.object({ n: z.number(), etag: z.string(), size: z.number() })) });
const zDone = z.object({ id: z.string(), size: z.number(), expiresAt: z.number() });

export interface LargeFile extends PlainSource {
  name: string;
  type: string;
}

export interface UploadProgress {
  phase: "hashing" | "uploading";
  done: number;
  total: number;
}

/** Sends a body to a URL (a presigned S3 PUT, or the API), reporting bytes sent where the browser can; resolves to the answer's text. */
export type BodySender = (req: { method: string; url: string; headers: Record<string, string>; body: Blob }, onSent: (bytes: number) => void, signal?: AbortSignal) => Promise<string>;

export class UploadCancelled extends Error {}

/** Headers a page may not set; the browser sets them itself (content-length from the body, which is the signed size). */
const FORBIDDEN = new Set(["content-length", "host", "connection"]);
const settable = (headers: Record<string, string>) => Object.fromEntries(Object.entries(headers).filter(([k]) => !FORBIDDEN.has(k.toLowerCase())));

/** XMLHttpRequest where it exists (fetch can't report upload progress), fetch elsewhere (tests). */
export const sendBody: BodySender = (raw, onSent, signal) => {
  const req = { ...raw, headers: settable(raw.headers) };
  if (typeof XMLHttpRequest === "undefined") {
    return fetch(req.url, { method: req.method, headers: req.headers, body: req.body, credentials: "omit", signal }).then(
      async (res) => {
        if (!res.ok) throw new ApiError(res.status, "upload_failed", `The upload was refused (${res.status}).`);
        onSent(req.body.size);
        return res.text();
      },
      (e: unknown) => {
        // As XMLHttpRequest reports it: a refused or failed request, unless it was cancelled.
        if (signal?.aborted) throw e;
        throw new ApiError(0, "network", "The upload was interrupted. Check your connection and try again.");
      },
    );
  }
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(req.method, req.url);
    for (const [k, v] of Object.entries(req.headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => onSent(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve(x.responseText) : reject(new ApiError(x.status, "upload_failed", `The upload was refused (${x.status}).`)));
    x.onerror = () => reject(new ApiError(0, "network", "The upload was interrupted. Check your connection and try again."));
    x.onabort = () => reject(new UploadCancelled("Upload cancelled."));
    signal?.addEventListener("abort", () => x.abort(), { once: true });
    x.send(req.body);
  });
};

/** A file encrypted once and ready to send (its ciphertext kept as a Blob), with what its reference needs. */
export interface PreparedFile {
  name: string;
  type: string;
  size: number;
  rawKey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Blob;
  sha256: string;
  voiceDurationMs?: number;
}

/** Where an upload got to, saved so it can continue after an interruption (transfers.ts keeps it). */
export interface UploadCheckpoint {
  /** "direct": the S3 upload [uploadId]; "api": one body to POST /v1/attachments (no partial state there). */
  route: "direct" | "api";
  uploadId?: string;
  mode?: "single" | "multipart";
  partSize?: number;
}

/** Parts sent at once to the store: enough to fill the connection, few enough not to swamp the browser or the server. */
const PART_CONCURRENCY = 3;
/** Tries per part for a dropped connection, waiting 1 s, 2 s, 4 s between them. */
const PART_TRIES = 4;

/** Encrypts [file] once (in the cipher worker), hashing as it goes. The key and nonce are new for every file. */
export async function prepareLarge(file: LargeFile & { source: Blob }, opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal; voiceDurationMs?: number } = {}): Promise<PreparedFile> {
  const rawKey = randomBytes(32);
  const nonce = randomBytes(12);
  const k = await importChunkKey(rawKey, nonce, "encrypt");
  const total = cipherSize(file.size);
  try {
    const { blob, sha256 } = await encryptFileOnce(file.source, k, CHUNK_BYTES, { signal: opts.signal, onProgress: (done) => opts.onProgress?.({ phase: "hashing", done, total }) });
    return { name: file.name, type: file.type, size: file.size, rawKey, nonce, ciphertext: blob, sha256, voiceDurationMs: opts.voiceDurationMs };
  } catch (e) {
    rawKey.fill(0);
    if (e instanceof CancelledError || opts.signal?.aborted) throw new UploadCancelled("Upload cancelled.");
    throw e;
  }
}

/** The reference that goes inside the encrypted message once the ciphertext is stored as [id]. */
export function preparedRef(f: PreparedFile, id: string): AttachmentRef {
  return {
    id,
    name: f.name.slice(0, 200) || "file",
    mime: f.type || "application/octet-stream",
    size: f.size,
    key: toB64(f.rawKey),
    nonce: toB64(f.nonce),
    sha256: f.sha256,
    chunk: CHUNK_BYTES,
    ...(f.voiceDurationMs !== undefined ? { voice: true, durationMs: Math.round(f.voiceDurationMs) } : {}),
  };
}

export async function uploadLarge(
  engine: Engine,
  conversationId: string,
  file: LargeFile,
  opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal; send?: BodySender; voiceDurationMs?: number } = {},
): Promise<AttachmentRef> {
  // A Blob (a picked File) is read in slices by the worker; other sources (tests) are read here.
  const given = (file as { source?: unknown }).source;
  const source = given instanceof Blob ? given : file instanceof Blob ? file : new Blob([await file.slice(0, file.size).arrayBuffer()]);
  const prepared = await prepareLarge({ ...file, size: file.size, slice: file.slice.bind(file), name: file.name, type: file.type, source }, opts);
  try {
    const id = await uploadPrepared(engine, conversationId, prepared, { onProgress: opts.onProgress, signal: opts.signal, send: opts.send });
    return preparedRef(prepared, id);
  } finally {
    prepared.rawKey.fill(0);
  }
}

/**
 * Stores a prepared file's ciphertext and answers its attachment id. With a [checkpoint] from an earlier attempt, a
 * multipart upload continues: the server says which parts it already has (and their sizes), and only the rest go.
 */
export async function uploadPrepared(
  engine: Engine,
  conversationId: string,
  f: PreparedFile,
  opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal; send?: BodySender; checkpoint?: UploadCheckpoint; onCheckpoint?: (c: UploadCheckpoint) => void } = {},
): Promise<string> {
  const send = opts.send ?? sendBody;
  const total = f.ciphertext.size;
  const report = (done: number) => opts.onProgress?.({ phase: "uploading", done, total });
  const viaApi = async () => {
    opts.onCheckpoint?.({ route: "api" });
    return (await sendViaApi(engine, conversationId, f.ciphertext, send, report, opts.signal)).id;
  };
  if (directBlocked || opts.checkpoint?.route === "api") return viaApi();
  let start: z.infer<typeof zStart> | null = null;
  let enc = opts.checkpoint?.uploadId ? encodeURIComponent(opts.checkpoint.uploadId) : "";
  const resuming = !!(opts.checkpoint?.uploadId && opts.checkpoint.mode === "multipart" && opts.checkpoint.partSize);
  if (!resuming) {
    try {
      start = await engine.api.json("POST", "/v1/attachments/uploads", zStart, { body: { conversationId, size: total, sha256: f.sha256 } });
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "direct_upload_unavailable")) throw e;
      return viaApi();
    }
    enc = encodeURIComponent(start.uploadId);
    opts.onCheckpoint?.({ route: "direct", uploadId: start.uploadId, mode: start.mode, ...(start.mode === "multipart" ? { partSize: start.partSize } : {}) });
  }
  try {
    if (start?.mode === "single") {
      await send({ method: "PUT", url: start.upload.url, headers: start.upload.headers, body: f.ciphertext }, report, opts.signal);
      return (await engine.api.json("POST", `/v1/attachments/uploads/${enc}/complete`, zDone, { body: {} })).id;
    }
    const partSize = start?.mode === "multipart" ? start.partSize : opts.checkpoint!.partSize!;
    return await sendParts(engine, enc, f.ciphertext, partSize, send, report, opts.signal, resuming);
  } catch (e) {
    if (e instanceof UploadCancelled || opts.signal?.aborted) throw e;
    if (resuming && e instanceof ApiError && (e.status === 404 || e.status === 409 || e.status === 410)) {
      // The earlier upload expired on the server: start a new one (the ciphertext is still here, nothing is re-encrypted).
      return uploadPrepared(engine, conversationId, f, { ...opts, checkpoint: undefined });
    }
    if (!(e instanceof ApiError && e.code === "network")) {
      // Refused for good: whatever reached the store is removed (the server also expires abandoned uploads).
      await engine.api.call("DELETE", `/v1/attachments/uploads/${enc}`).catch(() => undefined);
      throw e;
    }
    if (!resuming && start === null) throw e;
    // Refused like an offline request on the first try: most likely a bucket without a CORS rule for this site. Try
    // the API instead; if this tab is really offline, that fails too and says so (and the checkpoint keeps the parts).
    if (!resuming) {
      await engine.api.call("DELETE", `/v1/attachments/uploads/${enc}`).catch(() => undefined);
      report(0);
      const id = await viaApi();
      directBlocked = true;
      return id;
    }
    throw e;
  }
}

/** The ciphertext's parts, [PART_CONCURRENCY] at a time, each retried on a dropped connection; then /complete. */
async function sendParts(engine: Engine, enc: string, ct: Blob, partSize: number, send: BodySender, report: (b: number) => void, signal: AbortSignal | undefined, resuming: boolean): Promise<string> {
  const count = Math.max(1, Math.ceil(ct.size / partSize));
  const sizeOf = (n: number) => Math.min(partSize, ct.size - (n - 1) * partSize);
  const have = new Map<number, { etag: string; size: number }>();
  if (resuming) for (const p of (await engine.api.json("GET", `/v1/attachments/uploads/${enc}/parts`, zHave)).parts) have.set(p.n, { etag: p.etag, size: p.size });
  const sent = new Map<number, number>();
  for (const [n, p] of have) if (p.size === sizeOf(n)) sent.set(n, p.size);
  const shown = () => report([...sent.values()].reduce((a, b) => a + b, 0));
  shown();
  const hashes = new Map<number, string>();
  const todo = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !sent.has(n));
  const one = async (n: number) => {
    const body = ct.slice((n - 1) * partSize, (n - 1) * partSize + sizeOf(n));
    const partHash = toB64(await sha256(new Uint8Array(await body.arrayBuffer())));
    hashes.set(n, partHash);
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) throw new UploadCancelled("Upload cancelled.");
      try {
        const { parts } = await engine.api.json("POST", `/v1/attachments/uploads/${enc}/parts`, zParts, { body: { parts: [{ n, size: body.size, sha256: partHash }] } });
        const signed = parts.find((p) => p.n === n);
        if (!signed) throw new ApiError(500, "server", "The server didn't sign the upload.");
        await send({ method: "PUT", url: signed.upload.url, headers: signed.upload.headers, body }, (b) => (sent.set(n, b), shown()), signal);
        sent.set(n, body.size);
        shown();
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.code === "network") || attempt >= PART_TRIES || signal?.aborted) throw e;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  };
  // A small pool: each runner takes the next part until none are left.
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: Math.min(PART_CONCURRENCY, queue.length) }, async () => {
      for (let n = queue.shift(); n !== undefined; n = queue.shift()) await one(n);
    }),
  );
  // The store's own record of each part (its ETag), read through the server: no ETag header is needed from S3.
  const stored = new Map((await engine.api.json("GET", `/v1/attachments/uploads/${enc}/parts`, zHave)).parts.map((p) => [p.n, p.etag]));
  const parts: { n: number; etag: string; sha256: string }[] = [];
  for (let n = 1; n <= count; n++) {
    const h = hashes.get(n) ?? toB64(await sha256(new Uint8Array(await ct.slice((n - 1) * partSize, (n - 1) * partSize + sizeOf(n)).arrayBuffer())));
    parts.push({ n, etag: stored.get(n) ?? "", sha256: h });
  }
  return (await engine.api.json("POST", `/v1/attachments/uploads/${enc}/complete`, zDone, { body: { parts } })).id;
}

/**
 * Set once a direct upload to S3 was refused in this tab and the file then went through the API: a bucket without a
 * CORS rule for this site refuses browsers as if they were offline. Later files go through the API at once.
 */
let directBlocked = false;

/** For tests: forget that this tab switched to uploading through the API. */
export function resetUploadRoute(): void {
  directBlocked = false;
}

/** POST /v1/attachments with the ciphertext as one streamed body; a token that ran out meanwhile is renewed once. */
async function sendViaApi(engine: Engine, conversationId: string, body: Blob, send: BodySender, report: (b: number) => void, signal?: AbortSignal): Promise<z.infer<typeof zDone>> {
  const max = engine.state.get().server?.attachmentMaxBytes ?? 0;
  if (max && body.size > max) throw new ApiError(413, "too_large", `This server accepts files up to ${Math.floor(max / (1024 * 1024))} MB.`);
  const attempt = () => {
    const token = engine.session.token();
    return send(
      {
        method: "POST",
        url: `${engine.api.base}/v1/attachments?conversationId=${encodeURIComponent(conversationId)}`,
        headers: { "content-type": "application/octet-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body,
      },
      report,
      signal,
    );
  };
  let text: string;
  try {
    text = await attempt();
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401 && (await engine.session.reauthenticate()))) throw e;
    text = await attempt();
  }
  return zDone.parse(JSON.parse(text));
}
