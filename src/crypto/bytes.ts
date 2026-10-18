/** Byte helpers. Base64 is the standard alphabet with padding, as java.util.Base64 and Node write it (crypto/Bytes.kt). */

export type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function utf8(s: string): Bytes {
  return encoder.encode(s);
}

/** Decodes UTF-8, refusing malformed input rather than replacing it. */
export function fromUtf8(b: Uint8Array): string {
  return decoder.decode(b);
}

export function toB64(bytes: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Decodes standard base64 (padding optional). Throws on anything else. */
export function fromB64(b64: string): Bytes {
  const clean = b64.trim();
  if (!B64.test(clean)) throw new Error("not base64");
  const s = atob(clean);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** URL-safe base64 without padding (history tags, crypto/Bytes.kt `b64url`). */
export function toB64Url(bytes: Uint8Array): string {
  return toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomBytes(n: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function copy(b: Uint8Array): Bytes {
  return new Uint8Array(b);
}

export async function sha256(data: Uint8Array): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy(data)));
}
