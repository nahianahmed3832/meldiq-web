import { z } from "zod";
import { ApiError } from "../api/client";
import { randomBytes, sha256, toB64 } from "../crypto/bytes";
import { CHUNK_BYTES, cipherHash, cipherSize, encryptChunks, importChunkKey, type PlainSource, rechunk } from "../crypto/fileStream";
import type { AttachmentRef } from "../protocol/payload";
import type { Engine } from "./engine";

/**
 * Files over the single-message size (docs/ORBIT_2_ARCHITECTURE §7, up to 1 GiB): encrypted in 1 MiB chunks and sent
 * without ever holding the file in memory. Two passes over the file: the first hashes the ciphertext (the server and the
 * recipients check it), the second encrypts again, identically, while uploading.
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
    return fetch(req.url, { method: req.method, headers: req.headers, body: req.body, credentials: "omit", signal }).then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, "upload_failed", `The upload was refused (${res.status}).`);
      onSent(req.body.size);
      return res.text();
    });
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

export async function uploadLarge(
  engine: Engine,
  conversationId: string,
  file: LargeFile,
  opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal; send?: BodySender; voiceDurationMs?: number } = {},
): Promise<AttachmentRef> {
  const send = opts.send ?? sendBody;
  const rawKey = randomBytes(32);
  const nonce = randomBytes(12);
  const k = await importChunkKey(rawKey, nonce, "encrypt");
  const total = cipherSize(file.size);
  const cancelled = () => {
    if (opts.signal?.aborted) throw new UploadCancelled("Upload cancelled.");
  };
  try {
    const hash = await cipherHash(file, k, CHUNK_BYTES, (done) => {
      cancelled();
      opts.onProgress?.({ phase: "hashing", done, total });
    });
    const id = await upload(engine, conversationId, file, k, total, hash, send, opts);
    return {
      id,
      name: file.name.slice(0, 200) || "file",
      mime: file.type || "application/octet-stream",
      size: file.size,
      key: toB64(rawKey),
      nonce: toB64(nonce),
      sha256: hash,
      chunk: CHUNK_BYTES,
      ...(opts.voiceDurationMs !== undefined ? { voice: true, durationMs: Math.round(opts.voiceDurationMs) } : {}),
    };
  } finally {
    rawKey.fill(0);
  }
}

async function upload(
  engine: Engine,
  conversationId: string,
  file: LargeFile,
  k: Awaited<ReturnType<typeof importChunkKey>>,
  total: number,
  hash: string,
  send: BodySender,
  opts: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal },
): Promise<string> {
  const report = (done: number) => opts.onProgress?.({ phase: "uploading", done, total });
  let start: z.infer<typeof zStart>;
  try {
    start = await engine.api.json("POST", "/v1/attachments/uploads", zStart, { body: { conversationId, size: total, sha256: hash } });
  } catch (e) {
    if (!(e instanceof ApiError && e.code === "direct_upload_unavailable")) throw e;
    // This server receives files itself: the ciphertext as one streamed body.
    const body = await cipherBlob(file, k);
    const res = await sendViaApi(engine, conversationId, body, send, report, opts.signal);
    return res.id;
  }
  const enc = encodeURIComponent(start.uploadId);
  try {
    if (start.mode === "single") {
      await send({ method: "PUT", url: start.upload.url, headers: start.upload.headers, body: await cipherBlob(file, k) }, report, opts.signal);
      return (await engine.api.json("POST", `/v1/attachments/uploads/${enc}/complete`, zDone, { body: {} })).id;
    }
    const sent: { n: number; sha256: string }[] = [];
    let n = 0;
    let before = 0;
    for await (const part of rechunk(encryptChunks(file, k), start.partSize)) {
      n++;
      const partHash = toB64(await sha256(part));
      const { parts } = await engine.api.json("POST", `/v1/attachments/uploads/${enc}/parts`, zParts, { body: { parts: [{ n, size: part.length, sha256: partHash }] } });
      const signed = parts.find((p) => p.n === n);
      if (!signed) throw new ApiError(500, "server", "The server didn't sign the upload.");
      const base = before;
      await send({ method: "PUT", url: signed.upload.url, headers: signed.upload.headers, body: new Blob([part]) }, (b) => report(base + b), opts.signal);
      before += part.length;
      sent.push({ n, sha256: partHash });
    }
    // The store's own record of each part (its ETag), read through the server: no ETag header is needed from S3.
    const have = new Map((await engine.api.json("GET", `/v1/attachments/uploads/${enc}/parts`, zHave)).parts.map((p) => [p.n, p.etag]));
    const parts = sent.map((p) => ({ n: p.n, etag: have.get(p.n) ?? "", sha256: p.sha256 }));
    return (await engine.api.json("POST", `/v1/attachments/uploads/${enc}/complete`, zDone, { body: { parts } })).id;
  } catch (e) {
    // Whatever reached the store is removed (the server also expires abandoned uploads).
    await engine.api.call("DELETE", `/v1/attachments/uploads/${enc}`).catch(() => undefined);
    throw e;
  }
}

/** The whole ciphertext as a Blob, built chunk by chunk (browsers keep large Blobs on disk rather than in memory). */
async function cipherBlob(file: LargeFile, k: Awaited<ReturnType<typeof importChunkKey>>): Promise<Blob> {
  const parts: Blob[] = [];
  for await (const c of encryptChunks(file, k)) parts.push(new Blob([c]));
  return new Blob(parts, { type: "application/octet-stream" });
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
