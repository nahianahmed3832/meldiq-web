import { z } from "zod";
import { ApiError } from "../api/client";
import { decryptFile, encryptFile } from "../crypto/attachment";
import { EnvelopeError } from "../crypto/envelope";
import { decryptStream } from "../crypto/fileStream";
import { type UploadProgress, uploadLarge } from "./largeUpload";
import type { AttachmentRef } from "../protocol/payload";
import type { Engine } from "./engine";
import { cachedMedia, forgetMediaEntry, keepMedia } from "../store/mediaCache";

/**
 * Files travel as ciphertext only (docs/ATTACHMENTS.md): encrypted here, uploaded through the existing authorised upload
 * route, and the key goes inside the end-to-end encrypted message. Downloads require membership of the conversation on the
 * server, then are checked (SHA-256) and decrypted here.
 */

/** Up to this size a file uses the single-message format every Orbit app opens; larger ones are encrypted in chunks. */
export const SINGLE_FORMAT_BYTES = 25 * 1024 * 1024;
/** Orbit 2.0's per-file limit (FILE_MAX_BYTES, 1 GiB); the server says its own in server-info (fileMaxBytes). */
export const MAX_FILE_BYTES = 1024 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 10;

/** The largest file this server takes: fileMaxBytes (Orbit 2.0), else attachmentMaxBytes less the encryption tag. */
export function fileLimit(server: { fileMaxBytes?: number; attachmentMaxBytes: number } | null): number {
  if (!server) return SINGLE_FORMAT_BYTES;
  return Math.min(MAX_FILE_BYTES, server.fileMaxBytes ?? server.attachmentMaxBytes - 16);
}

const zUploadRes = z.object({ id: z.string(), size: z.number(), expiresAt: z.number() });

export class AttachmentError extends Error {}

export interface PickedFile {
  name: string;
  type: string;
  size: number;
  bytes(): Promise<Uint8Array>;
  /** A voice message: its length, sent with the reference (docs/VOICE_MESSAGES.md). */
  voiceDurationMs?: number;
  /** The file itself, read in slices: required for files over the single-message size. */
  source?: Blob;
}

const sizeText = (n: number): string => (n >= 1024 * 1024 * 1024 ? `${(n / (1024 * 1024 * 1024)).toFixed(n % (1024 * 1024 * 1024) ? 1 : 0)} GB` : `${Math.floor(n / (1024 * 1024))} MB`);

export async function uploadFiles(
  engine: Engine,
  conversationId: string,
  files: PickedFile[],
  onProgress?: (done: number, total: number) => void,
  large?: { onProgress?: (file: string, p: UploadProgress) => void; signal?: AbortSignal },
): Promise<AttachmentRef[]> {
  if (files.length > MAX_FILES_PER_MESSAGE) throw new AttachmentError(`Send at most ${MAX_FILES_PER_MESSAGE} files in one message.`);
  const limit = fileLimit(engine.state.get().server);
  const tooBig = files.find((f) => f.size > limit);
  if (tooBig) throw new AttachmentError(`"${tooBig.name}" is larger than ${sizeText(limit)}, the most this server accepts per file.`);
  const empty = files.find((f) => f.size === 0);
  if (empty) throw new AttachmentError(`"${empty.name}" is empty.`);
  const refs: AttachmentRef[] = [];
  for (const [i, f] of files.entries()) {
    if (f.size > SINGLE_FORMAT_BYTES) {
      if (!f.source) throw new AttachmentError(`"${f.name}" is too large to send this way.`);
      refs.push(
        await uploadLarge(
          engine,
          conversationId,
          { name: f.name, type: f.type, size: f.size, slice: (a, b) => f.source!.slice(a, b) },
          {
            onProgress: (p) => large?.onProgress?.(f.name, p),
            signal: large?.signal,
            voiceDurationMs: f.voiceDurationMs,
          },
        ),
      );
      onProgress?.(i + 1, files.length);
      continue;
    }
    const enc = await encryptFile(await f.bytes());
    const res = await engine.api.json("POST", `/v1/attachments?conversationId=${encodeURIComponent(conversationId)}`, zUploadRes, { raw: enc.ciphertext });
    refs.push({
      id: res.id,
      name: f.name.slice(0, 200) || "file",
      mime: f.type || "application/octet-stream",
      size: f.size,
      key: enc.key,
      nonce: enc.nonce,
      sha256: enc.sha256,
      ...(f.voiceDurationMs !== undefined ? { voice: true, durationMs: Math.round(f.voiceDurationMs) } : {}),
    });
    onProgress?.(i + 1, files.length);
  }
  return refs;
}

/** Sends files (with an optional caption) as one message. */
export async function sendFiles(
  engine: Engine,
  conversationId: string,
  files: PickedFile[],
  caption: string,
  opts: { replyTo?: string; threadRoot?: string } = {},
  onProgress?: (done: number, total: number) => void,
  large?: { onProgress?: (file: string, p: UploadProgress) => void; signal?: AbortSignal },
): Promise<string> {
  const attachments = await uploadFiles(engine, conversationId, files, onProgress, large);
  return engine.sendText(conversationId, caption, { ...opts, attachments });
}

const cache = new Map<string, Promise<Blob>>();

/** Files up to this size are kept decrypted for the page's life (instant reopening); larger ones are fetched each time. */
const CACHE_LIMIT = 64 * 1024 * 1024;

/**
 * Downloads, verifies and decrypts a file: once per page load when small, and single-message files once per browser
 * (their ciphertext is kept in the media cache). Object URLs are made by the caller and revoked by it.
 */
export function openAttachment(engine: Engine, ref: AttachmentRef): Promise<Blob> {
  if (ref.chunk !== undefined) {
    const parts: Blob[] = [];
    const p = streamAttachment(engine, ref, (plain) => void parts.push(new Blob([new Uint8Array(plain)]))).then(() => new Blob(parts, { type: safeMime(ref.mime) }));
    if (ref.size > CACHE_LIMIT) return p;
    cache.set(ref.id, p);
    p.catch(() => cache.delete(ref.id));
    return p;
  }
  let p = cache.get(ref.id);
  if (!p) {
    p = openSingle(engine, ref);
    p.catch(() => cache.delete(ref.id));
    cache.set(ref.id, p);
  }
  return p;
}

/**
 * A single-message file: its ciphertext from this browser's media cache when an earlier visit downloaded it, else from
 * the server (then kept). A kept copy that fails its check is dropped and downloaded again.
 */
async function openSingle(engine: Engine, ref: AttachmentRef): Promise<Blob> {
  const key = `attachment:${ref.id}`;
  const kept = await cachedMedia(key);
  if (kept) {
    const plain = await decryptFile(kept, ref).catch(() => null);
    if (plain) return new Blob([new Uint8Array(plain)], { type: safeMime(ref.mime) });
    await forgetMediaEntry(key);
  }
  let ct: Uint8Array;
  try {
    ct = new Uint8Array(await (await attachmentResponse(engine, ref.id)).arrayBuffer());
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new AttachmentError("This file has expired on the server (files are kept 7 days unless saved with history).");
    throw e;
  }
  const plain = await decryptFile(ct, ref).catch(() => {
    throw new AttachmentError("This file didn't pass its integrity check and wasn't opened.");
  });
  void keepMedia(key, ct);
  return new Blob([new Uint8Array(plain)], { type: safeMime(ref.mime) });
}

/**
 * Servers that keep files in S3 answer a download with a short-lived S3 link. A browser follows it only if the bucket
 * allows this site (a CORS rule); without one the request fails as if offline. The file is then fetched through this
 * site's own web server, which follows the link itself (deploy/nginx, /media/attachments/), and later files in this tab
 * go that way at once. The phone apps aren't affected: CORS is a browser rule.
 */
let throughWebServer = false;

export async function attachmentResponse(engine: Engine, id: string, signal?: AbortSignal): Promise<Response> {
  const direct = `/v1/attachments/${encodeURIComponent(id)}`;
  if (throughWebServer) return (await viaWebServer(engine, id, signal)) ?? engine.api.response(direct, { signal });
  try {
    return await engine.api.response(direct, { signal });
  } catch (e) {
    if (!(e instanceof ApiError && e.code === "network") || signal?.aborted) throw e;
    let res: Response | null;
    try {
      res = await viaWebServer(engine, id, signal);
    } catch (again) {
      // The server's own answer (expired, not a member) is the one to show; still unreachable: the first error.
      throw again instanceof ApiError && again.code !== "network" ? again : e;
    }
    if (!res) throw e;
    throughWebServer = true;
    return res;
  }
}

/** Null where this site has no such route: a development server or an older install answers with the app's page. */
async function viaWebServer(engine: Engine, id: string, signal?: AbortSignal): Promise<Response | null> {
  const res = await engine.api.response(`/media/attachments/${encodeURIComponent(id)}`, { signal });
  if ((res.headers.get("content-type") ?? "").includes("text/html")) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  return res;
}

/** For tests: forget that this tab switched to the web server. */
export function resetAttachmentRoute(): void {
  throughWebServer = false;
}

/**
 * A chunked file, decrypted as it downloads and handed to [sink] chunk by chunk (decryptStream checks every chunk, the
 * count and the whole hash; on failure the caller discards what it got).
 */
export async function streamAttachment(engine: Engine, ref: AttachmentRef, sink: (plain: Uint8Array) => Promise<void> | void, signal?: AbortSignal): Promise<void> {
  let body: ReadableStream<Uint8Array>;
  try {
    const res = await attachmentResponse(engine, ref.id, signal);
    if (!res.body) throw new ApiError(res.status, "decode", "The server's answer had no body");
    body = res.body;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new AttachmentError("This file has expired on the server (files are kept 7 days unless saved with history).");
    throw e;
  }
  try {
    await decryptStream(readAll(body), { key: ref.key, nonce: ref.nonce, sha256: ref.sha256, chunk: ref.chunk ?? 0, size: ref.size }, sink);
  } catch (e) {
    if (e instanceof EnvelopeError) throw new AttachmentError("This file didn't pass its integrity check and wasn't opened.");
    throw e;
  }
}

async function* readAll(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Saves a file to disk. Where the browser lets a page write a file it chose (Chromium's File System Access), a large
 * file is decrypted straight into it, never whole in memory; a failed check deletes what was written. Elsewhere the
 * decrypted file is handed to the browser's download.
 */
export async function saveAttachment(engine: Engine, ref: AttachmentRef): Promise<void> {
  const picker = (window as unknown as { showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  if (ref.chunk !== undefined && ref.size > CACHE_LIMIT && picker) {
    const handle = await picker({ suggestedName: ref.name });
    const out = await handle.createWritable();
    try {
      await streamAttachment(engine, ref, (plain) => out.write(new Uint8Array(plain)));
      await out.close();
    } catch (e) {
      await out.abort().catch(() => undefined);
      throw e;
    }
    return;
  }
  const blob = await openAttachment(engine, ref);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ref.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Only inert types are shown inline; anything else is a download, never rendered as a page (no HTML or SVG). */
export function safeMime(mime: string): string {
  const m = mime.toLowerCase();
  if (/^image\/(png|jpe?g|gif|webp|avif|heic|heif|bmp)$/.test(m)) return m;
  if (/^(video\/(mp4|webm|quicktime)|audio\/(mp4|mpeg|ogg|webm|aac|wav|x-m4a))$/.test(m)) return m;
  return "application/octet-stream";
}

export function isInlineImage(ref: AttachmentRef): boolean {
  return safeMime(ref.mime).startsWith("image/");
}
