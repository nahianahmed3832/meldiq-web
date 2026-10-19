import { z } from "zod";
import { ApiError } from "../api/client";
import { decryptFile, encryptFile } from "../crypto/attachment";
import type { AttachmentRef } from "../protocol/payload";
import type { Engine } from "./engine";

/**
 * Files travel as ciphertext only (docs/ATTACHMENTS.md): encrypted here, uploaded through the existing authorised upload
 * route, and the key goes inside the end-to-end encrypted message. Downloads require membership of the conversation on the
 * server, then are checked (SHA-256) and decrypted here.
 */

/** The single-message format every Orbit app opens: 25 MB, the server's default per-file limit. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Larger (chunked) files are decrypted in memory here; past this size they're opened on the phone instead. */
export const MAX_BROWSER_DOWNLOAD_BYTES = 200 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 10;

const zUploadRes = z.object({ id: z.string(), size: z.number(), expiresAt: z.number() });

export class AttachmentError extends Error {}

export interface PickedFile {
  name: string;
  type: string;
  size: number;
  bytes(): Promise<Uint8Array>;
  /** A voice message: its length, sent with the reference (docs/VOICE_MESSAGES.md). */
  voiceDurationMs?: number;
}

export async function uploadFiles(engine: Engine, conversationId: string, files: PickedFile[], onProgress?: (done: number, total: number) => void): Promise<AttachmentRef[]> {
  if (files.length > MAX_FILES_PER_MESSAGE) throw new AttachmentError(`Send at most ${MAX_FILES_PER_MESSAGE} files in one message.`);
  const limit = Math.min(MAX_UPLOAD_BYTES, engine.state.get().server?.attachmentMaxBytes ?? MAX_UPLOAD_BYTES);
  const tooBig = files.find((f) => f.size > limit - 16);
  if (tooBig) throw new AttachmentError(`"${tooBig.name}" is larger than ${Math.floor(limit / (1024 * 1024))} MB, the most this server accepts per file.`);
  const empty = files.find((f) => f.size === 0);
  if (empty) throw new AttachmentError(`"${empty.name}" is empty.`);
  const refs: AttachmentRef[] = [];
  for (const [i, f] of files.entries()) {
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
): Promise<string> {
  const attachments = await uploadFiles(engine, conversationId, files, onProgress);
  return engine.sendText(conversationId, caption, { ...opts, attachments });
}

const cache = new Map<string, Promise<Blob>>();

/** Downloads, verifies and decrypts a file once per page load. Object URLs are made by the caller and revoked by it. */
export function openAttachment(engine: Engine, ref: AttachmentRef): Promise<Blob> {
  let p = cache.get(ref.id);
  if (!p) {
    p = (async () => {
      if (ref.size > MAX_BROWSER_DOWNLOAD_BYTES) throw new AttachmentError("This file is too large to open in the browser. Open it on your phone.");
      let ct: Uint8Array;
      try {
        ct = await engine.api.bytes(`/v1/attachments/${encodeURIComponent(ref.id)}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) throw new AttachmentError("This file has expired on the server (files are kept 7 days unless saved with history).");
        throw e;
      }
      const plain = await decryptFile(ct, ref).catch(() => {
        throw new AttachmentError("This file didn't pass its integrity check and wasn't opened.");
      });
      return new Blob([new Uint8Array(plain)], { type: safeMime(ref.mime) });
    })();
    p.catch(() => cache.delete(ref.id));
    cache.set(ref.id, p);
  }
  return p;
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
