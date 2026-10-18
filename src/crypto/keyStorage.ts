import { type Bytes, copy, randomBytes } from "./bytes";

/**
 * Keeping X25519 private keys across page loads.
 *
 * Chromium and Firefox store non-extractable X25519 CryptoKeys in IndexedDB like any other key. WebKit (Safari) doesn't:
 * the key reads back as a plain object, so a browser would lose its encryption key on every reload (verified in
 * WebKit 27.2; Ed25519, AES and HMAC keys are unaffected). There the private key is generated extractable once, wrapped
 * with a non-extractable AES-256-GCM key that WebKit does store correctly, and only the wrapped bytes are kept; the
 * session uses a non-extractable copy. This protects the key at rest, but script running in the page could unwrap it,
 * which the non-extractable path prevents (docs/ORBIT_WEB_STATUS.md › Known limitations).
 */

export interface SealedPrivateKey {
  /** Non-extractable AES-GCM key allowed only to wrap and unwrap. */
  wrappingKey: CryptoKey;
  iv: Bytes;
  /** The PKCS#8 private key, AES-GCM encrypted. */
  wrapped: Bytes;
}

let persists: Promise<boolean> | null = null;

/** Whether this browser keeps X25519 CryptoKeys intact through structured cloning (what IndexedDB uses). */
export function x25519KeysPersist(): Promise<boolean> {
  persists ??= (async () => {
    try {
      const k = await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
      const clone = structuredClone((k as CryptoKeyPair).privateKey);
      return clone instanceof CryptoKey && clone.algorithm.name === "X25519";
    } catch {
      return false;
    }
  })();
  return persists;
}

/** A new X25519 pair for the session, plus its sealed form for storage. The session's private key is non-extractable. */
export async function generateSealedX25519(): Promise<{ pair: CryptoKeyPair; sealed: SealedPrivateKey }> {
  const extractable = (await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const wrappingKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey"]);
  const iv = randomBytes(12);
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey("pkcs8", extractable.privateKey, wrappingKey, { name: "AES-GCM", iv }));
  const sealed = { wrappingKey, iv, wrapped };
  return { pair: { publicKey: extractable.publicKey, privateKey: await unsealX25519(sealed) }, sealed };
}

/** The stored private key as a non-extractable CryptoKey. */
export async function unsealX25519(s: SealedPrivateKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey("pkcs8", copy(s.wrapped), s.wrappingKey, { name: "AES-GCM", iv: copy(s.iv) }, { name: "X25519" }, false, ["deriveBits"]);
}

export async function importX25519Public(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", copy(raw), { name: "X25519" }, true, []);
}
