import { text as uiText } from "../i18n";
import { z } from "zod";
import { ApiError, toApiError } from "../api/client";
import { randomBytes, toB64 } from "../crypto/bytes";
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
const zHave = z.object({ parts: z.array(z.object({ n: z.number().int().positive(), etag: z.string(), size: z.number().int().positive(), sha256: z.string().nullish() })) });
const zDone = z.object({ id: z.string(), size: z.number(), expiresAt: z.number() });
export interface LargeFile extends PlainSource {
  name: string;
  type: string;
}
export interface UploadProgress {
  phase: "hashing" | "uploading" | "verifying";
  done: number;
  total: number;
}
/** Sends a body to a URL (a presigned S3 PUT, or the API), reporting bytes sent where the browser can; resolves to the answer's text. */
export type BodySender = (
  req: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: Blob;
  },
  onSent: (bytes: number) => void,
  signal?: AbortSignal,
  onETag?: (etag: string | null) => void,
) => Promise<string>;
export class UploadCancelled extends Error {}
/** Headers a page may not set; the browser sets them itself (content-length from the body, which is the signed size). */
const FORBIDDEN = new Set(["content-length", "host", "connection"]);
const settable = (headers: Record<string, string>) => Object.fromEntries(Object.entries(headers).filter(([k]) => !FORBIDDEN.has(k.toLowerCase())));
/** XMLHttpRequest where it exists (fetch can't report upload progress), fetch elsewhere (tests). */
export const sendBody: BodySender = (raw, onSent, signal, onETag) => {
  if (signal?.aborted) return Promise.reject(new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1")));
  const req = { ...raw, headers: settable(raw.headers) };
  if (typeof XMLHttpRequest === "undefined") {
    return fetch(req.url, { method: req.method, headers: req.headers, body: req.body, credentials: "omit", signal }).then(
      async (res) => {
        if (!res.ok) {
          if (req.method === "POST") throw await toApiError(res);
          throw new ApiError(res.status, "upload_failed", uiText("workspace.interface.the_upload_was_refused_value0_ac65b7a", { value0: res.status }));
        }
        onSent(req.body.size);
        onETag?.(res.headers.get("etag"));
        return res.text();
      },
      (e: unknown) => {
        // As XMLHttpRequest reports it: a refused or failed request, unless it was cancelled.
        if (signal?.aborted) throw e;
        throw new ApiError(0, "network", uiText("workspace.interface.the_upload_was_interrupted_check_your_connection_and_try_aga_76fb28a"));
      },
    );
  }
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(req.method, req.url);
    for (const [k, v] of Object.entries(req.headers)) x.setRequestHeader(k, v);
    let stall: ReturnType<typeof setTimeout>;
    const watch = () => {
      clearTimeout(stall);
      // Slow links can take several minutes per part. Bound inactivity rather than total transfer time.
      stall = setTimeout(() => {
        reject(new ApiError(0, "network", uiText("workspace.interface.the_upload_timed_out_try_again_to_resume_9b28c59")));
        x.abort();
      }, 120000);
    };
    x.upload.onprogress = (e) => {
      watch();
      onSent(e.loaded);
    };
    const abort = () => x.abort();
    x.onloadend = () => {
      clearTimeout(stall);
      signal?.removeEventListener("abort", abort);
    };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        onSent(req.body.size);
        if (onETag) onETag(/^etag:\s*(.+)$/im.exec(x.getAllResponseHeaders())?.[1]?.trim() ?? null);
        resolve(x.responseText);
      } else if (x.status >= 400 && req.method === "POST") {
        void toApiError(new Response(x.responseText, { status: x.status, headers: { "retry-after": x.getResponseHeader("retry-after") ?? "" } })).then(reject);
      } else reject(new ApiError(x.status, "upload_failed", uiText("workspace.interface.the_upload_was_refused_value0_ac65b7a", { value0: x.status })));
    };
    x.onerror = () => reject(new ApiError(0, "network", uiText("workspace.interface.the_upload_was_interrupted_check_your_connection_and_try_aga_76fb28a")));
    x.onabort = () => reject(new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1")));
    signal?.addEventListener("abort", abort, { once: true });
    try {
      x.send(req.body);
      watch();
    } catch (e) {
      signal?.removeEventListener("abort", abort);
      reject(e);
    }
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
  singleUploaded?: boolean;
  /** Kept before finalizing, so retry works even after S3 has assembled and removed the parts. */
  parts?: {
    n: number;
    etag: string;
    sha256: string;
  }[];
}
/** Parts sent at once to the store: enough to fill the connection, few enough not to swamp the browser or the server. */
const PART_CONCURRENCY = 3;
/** Tries per part for a dropped connection, waiting 1 s, 2 s, 4 s between them. */
const PART_TRIES = 4;
/** Encrypts [file] once (in the cipher worker), hashing as it goes. The key and nonce are new for every file. */
export async function prepareLarge(
  file: LargeFile & {
    source: Blob;
  },
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
    voiceDurationMs?: number;
  } = {},
): Promise<PreparedFile> {
  const rawKey = randomBytes(32);
  const nonce = randomBytes(12);
  const k = await importChunkKey(rawKey, nonce, "encrypt");
  const total = cipherSize(file.size);
  try {
    const { blob, sha256 } = await encryptFileOnce(file.source, k, CHUNK_BYTES, { signal: opts.signal, onProgress: (done) => opts.onProgress?.({ phase: "hashing", done, total }) });
    return { name: file.name, type: file.type, size: file.size, rawKey, nonce, ciphertext: blob, sha256, voiceDurationMs: opts.voiceDurationMs };
  } catch (e) {
    rawKey.fill(0);
    if (e instanceof CancelledError || opts.signal?.aborted) throw new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1"));
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
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
    send?: BodySender;
    voiceDurationMs?: number;
  } = {},
): Promise<AttachmentRef> {
  // A Blob (a picked File) is read in slices by the worker; other sources (tests) are read here.
  const given = (
    file as {
      source?: unknown;
    }
  ).source;
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
  opts: {
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
    send?: BodySender;
    checkpoint?: UploadCheckpoint;
    onCheckpoint?: (c: UploadCheckpoint) => void | Promise<void>;
  } = {},
): Promise<string> {
  const send = opts.send ?? sendBody;
  const total = f.ciphertext.size;
  const report = (done: number) => opts.onProgress?.({ phase: "uploading", done, total });
  const viaApi = async () => {
    checkUploadSignal(opts.signal);
    await opts.onCheckpoint?.({ route: "api" });
    return (await sendViaApi(engine, conversationId, f.ciphertext, send, report, opts.signal)).id;
  };
  checkUploadSignal(opts.signal);
  if (opts.checkpoint?.route === "api") return viaApi();
  let start: z.infer<typeof zStart> | null = null;
  let enc = opts.checkpoint?.uploadId ? encodeURIComponent(opts.checkpoint.uploadId) : "";
  const resuming = !!opts.checkpoint?.uploadId;
  if (!resuming) {
    try {
      start = await engine.api.json("POST", "/v1/attachments/uploads", zStart, { signal: opts.signal, body: { conversationId, size: total, sha256: f.sha256 } });
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "direct_upload_unavailable")) throw e;
      return viaApi();
    }
    enc = encodeURIComponent(start.uploadId);
    await opts.onCheckpoint?.({ route: "direct", uploadId: start.uploadId, mode: start.mode, ...(start.mode === "multipart" ? { partSize: start.partSize } : {}) });
  }
  const checkpoint: UploadCheckpoint = start ? { route: "direct", uploadId: start.uploadId, mode: start.mode, ...(start.mode === "multipart" ? { partSize: start.partSize } : {}) } : opts.checkpoint!;
  const complete = async (parts?: UploadCheckpoint["parts"]) => {
    checkUploadSignal(opts.signal);
    opts.onProgress?.({ phase: "verifying", done: total, total });
    return (await engine.api.json("POST", `/v1/attachments/uploads/${enc}/complete`, zDone, { signal: opts.signal, body: parts ? { parts } : {} })).id;
  };
  try {
    if (checkpoint.parts) return await complete(checkpoint.parts);
    if (checkpoint.mode === "single") {
      if (checkpoint.singleUploaded) {
        try {
          return await complete();
        } catch (e) {
          if (!(e instanceof ApiError && e.code === "not_uploaded")) throw e;
          await opts.onCheckpoint?.({ ...checkpoint, singleUploaded: false });
        }
      }
      const renew = async () => (await engine.api.json("POST", `/v1/attachments/uploads/${enc}/url`, z.object({ upload: zPresigned }), { signal: opts.signal, body: {} })).upload;
      let signed = start?.mode === "single" ? start.upload : await renew();
      for (let attempt = 1; ; attempt++) {
        checkUploadSignal(opts.signal);
        try {
          await send({ method: "PUT", url: signed.url, headers: signed.headers, body: f.ciphertext }, report, opts.signal);
          break;
        } catch (e) {
          // A lost successful PUT answer: verify through /complete instead of replacing the object.
          if (e instanceof ApiError && e.status === 412) break;
          if (!retryableUpload(e) && !(e instanceof ApiError && e.status === 403)) throw e;
          if (attempt >= PART_TRIES) {
            if (!(e instanceof ApiError && e.code === "network") || (typeof navigator !== "undefined" && navigator.onLine === false)) throw e;
            try {
              return await complete();
            } catch (verification) {
              // An ambiguous verification failure must keep the direct session. Only a confirmed missing object can use the fallback.
              if (!(verification instanceof ApiError && verification.code === "not_uploaded")) throw verification;
            }
            await engine.api.call("DELETE", `/v1/attachments/uploads/${enc}`, { signal: opts.signal }).catch(() => undefined);
            return await viaApi();
          }
          report(0);
          await uploadBackoff(attempt, opts.signal);
          signed = await renew();
        }
      }
      await opts.onCheckpoint?.({ ...checkpoint, singleUploaded: true });
      return await complete();
    }
    const partSize = checkpoint.partSize;
    if (!partSize || !Number.isSafeInteger(partSize) || partSize <= 0) throw new ApiError(0, "decode", uiText("workspace.interface.the_upload_part_size_is_invalid_d18c33b"));
    const parts = await sendParts(engine, enc, f.ciphertext, partSize, send, report, opts.signal, resuming);
    await opts.onCheckpoint?.({ ...checkpoint, parts });
    return await complete(parts);
  } catch (e) {
    if (e instanceof UploadCancelled || opts.signal?.aborted) throw new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1"));
    if (resuming && e instanceof ApiError && (e.status === 404 || e.status === 410)) {
      return uploadPrepared(engine, conversationId, f, { ...opts, checkpoint: undefined });
    }
    if (e instanceof ApiError && e.code === "upload_incomplete") await opts.onCheckpoint?.({ ...checkpoint, parts: undefined });
    // Keep recoverable sessions and their parts. A network failure alone cannot diagnose CORS or justify discarding them.
    if (!retryableUpload(e) && !(e instanceof ApiError && [409].includes(e.status))) {
      await engine.api.call("DELETE", `/v1/attachments/uploads/${enc}`).catch(() => undefined);
    }
    throw e;
  }
}
export function checkUploadSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1"));
}
export function retryableUpload(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "network" || e.status === 408 || e.status === 429 || (e.status >= 500 && e.status !== 507));
}
/** Backoff remains cancellable even while offline. */
export function uploadBackoff(attempt: number, signal?: AbortSignal): Promise<void> {
  checkUploadSignal(signal);
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, 1000 * 2 ** (attempt - 1));
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new UploadCancelled(uiText("workspace.interface.upload_cancelled_13737e1")));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
/** Sign one batch per upload window. A retry signs only the affected part. */
async function sendParts(
  engine: Engine,
  enc: string,
  ct: Blob,
  partSize: number,
  send: BodySender,
  report: (b: number) => void,
  signal: AbortSignal | undefined,
  resuming: boolean,
): Promise<NonNullable<UploadCheckpoint["parts"]>> {
  const count = Math.ceil(ct.size / partSize);
  const pending = new Map<number, number>();
  const uploaded = new Map<number, { n: number; etag: string; sha256: string }>();
  let uploadedBytes = 0;
  const bodyOf = (n: number) => ct.slice((n - 1) * partSize, n * partSize);
  // Blob.arrayBuffer owns its bytes. Hand the buffer to WebCrypto without an extra part-sized copy.
  const hash = async (body: Blob) => toB64(new Uint8Array(await crypto.subtle.digest("SHA-256", await body.arrayBuffer())));
  if (resuming) {
    for (const part of (await engine.api.json("GET", `/v1/attachments/uploads/${enc}/parts`, zHave, { signal })).parts) {
      if (part.n > count || !part.sha256 || !part.etag) continue;
      checkUploadSignal(signal);
      const body = bodyOf(part.n);
      if (body.size !== part.size || (await hash(body)) !== part.sha256) continue;
      uploaded.set(part.n, { n: part.n, etag: part.etag, sha256: part.sha256 });
      uploadedBytes += body.size;
    }
  }
  const show = () => report(uploadedBytes + [...pending.values()].reduce((sum, bytes) => sum + bytes, 0));
  show();
  const todo = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !uploaded.has(n));
  const sign = async (parts: { n: number; size: number; sha256: string }[], signal?: AbortSignal) => {
    for (let attempt = 1; ; attempt++) {
      checkUploadSignal(signal);
      try {
        const result = await engine.api.json("POST", `/v1/attachments/uploads/${enc}/parts`, zParts, { signal, body: { parts } });
        const signed = new Map(result.parts.map((part) => [part.n, part.upload]));
        if (parts.some(({ n }) => !signed.has(n))) throw new ApiError(500, "server", uiText("workspace.interface.the_server_didn_t_sign_the_upload_9b72c90"));
        return signed;
      } catch (e) {
        if (!retryableUpload(e) || attempt >= PART_TRIES) throw e;
        await uploadBackoff(attempt, signal);
      }
    }
  };
  const pool = new AbortController();
  const active = pool.signal;
  const stop = () => pool.abort();
  checkUploadSignal(signal);
  signal?.addEventListener("abort", stop, { once: true });
  const prepareBatch = async (first: number) => {
    checkUploadSignal(active);
    const batch = await Promise.all(
      todo.slice(first, first + PART_CONCURRENCY).map(async (n) => {
        const body = bodyOf(n);
        return { body, spec: { n, size: body.size, sha256: await hash(body) } };
      }),
    );
    const signed = await sign(
      batch.map(({ spec }) => spec),
      active,
    );
    return batch.map((part) => ({ ...part, put: signed.get(part.spec.n)! }));
  };
  const batches = new Map<number, ReturnType<typeof prepareBatch>>();
  const batchAt = (first: number) => {
    let batch = batches.get(first);
    if (!batch) {
      batch = prepareBatch(first);
      batches.set(first, batch);
      // A prefetched window may be cancelled before a worker takes it.
      void batch.catch(() => undefined);
    }
    return batch;
  };
  let cursor = 0;
  const takePart = async () => {
    checkUploadSignal(active);
    const index = cursor++;
    if (index >= todo.length) return null;
    const offset = index % PART_CONCURRENCY;
    const first = index - offset;
    const batch = await batchAt(first);
    // Have the next window ready while this one's bytes are in flight.
    if (offset === 0 && first + PART_CONCURRENCY < todo.length) batchAt(first + PART_CONCURRENCY);
    if (offset === batch.length - 1) batches.delete(first);
    return batch[offset];
  };
  let failure: unknown;
  try {
    await Promise.all(
      Array.from({ length: Math.min(todo.length, PART_CONCURRENCY) }, async () => {
        try {
          for (let part = await takePart(); part; part = await takePart()) {
            const { body, spec } = part;
            const { n, sha256 } = spec;
            let put = part.put;
            let etag = "";
            for (let attempt = 1; ; attempt++) {
              checkUploadSignal(active);
              try {
                await send(
                  { method: "PUT", url: put.url, headers: put.headers, body },
                  (bytes) => {
                    pending.set(n, Math.min(bytes, body.size));
                    show();
                  },
                  active,
                  (value) => {
                    etag = value ?? "";
                  },
                );
                break;
              } catch (e) {
                if (!(retryableUpload(e) || (e instanceof ApiError && e.status === 403)) || attempt >= PART_TRIES) throw e;
                pending.delete(n);
                show();
                await uploadBackoff(attempt, active);
                put = (await sign([spec], active)).get(n)!;
              }
            }
            pending.delete(n);
            uploaded.set(n, { n, etag, sha256 });
            uploadedBytes += body.size;
            show();
          }
        } catch (e) {
          failure ??= e;
          pool.abort();
        }
      }),
    );
    if (pool.signal.aborted) throw failure;
    checkUploadSignal(signal);
  } finally {
    signal?.removeEventListener("abort", stop);
    await Promise.allSettled(batches.values());
  }
  // Older bucket CORS rules hide ETag. Verify the missing ETags via the existing authorized endpoint.
  if ([...uploaded.values()].some((part) => !part.etag)) {
    const stored = new Map((await engine.api.json("GET", `/v1/attachments/uploads/${enc}/parts`, zHave, { signal })).parts.map((part) => [part.n, part]));
    for (const part of uploaded.values()) {
      if (part.etag) continue;
      const kept = stored.get(part.n);
      if (!kept?.etag || kept.size !== bodyOf(part.n).size || (kept.sha256 && kept.sha256 !== part.sha256)) {
        throw new ApiError(409, "upload_incomplete", uiText("workspace.interface.the_server_didn_t_sign_the_upload_9b72c90"));
      }
      part.etag = kept.etag;
    }
  }
  return [...uploaded.values()].sort((a, b) => a.n - b.n);
}
/** For tests: forget that this tab switched to uploading through the API. */
export function resetUploadRoute(): void {
  // Kept for compatibility with older callers; network errors no longer disable S3 for the whole tab.
}
/** POST /v1/attachments with the ciphertext as one streamed body; a token that ran out meanwhile is renewed once. */
async function sendViaApi(engine: Engine, conversationId: string, body: Blob, send: BodySender, report: (b: number) => void, signal?: AbortSignal): Promise<z.infer<typeof zDone>> {
  const max = engine.state.get().server?.attachmentMaxBytes ?? 0;
  if (max && body.size > max) throw new ApiError(413, "too_large", uiText("workspace.interface.this_server_accepts_files_up_to_value0_mb_ba31d92", { value0: Math.floor(max / (1024 * 1024)) }));
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
