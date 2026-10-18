import { type Bytes, copy } from "./bytes";

/** AES-256-GCM with a 128-bit tag appended to the ciphertext, as JCA, Node and WebCrypto all write it. */

async function aesKey(raw: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("AES-256 key must be 32 bytes");
  return crypto.subtle.importKey("raw", copy(raw), "AES-GCM", false, [usage]);
}

export async function aesGcmEncrypt(key: Uint8Array | CryptoKey, nonce: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): Promise<Bytes> {
  const k = key instanceof CryptoKey ? key : await aesKey(key, "encrypt");
  const params: AesGcmParams = { name: "AES-GCM", iv: copy(nonce), ...(aad ? { additionalData: copy(aad) } : {}) };
  return new Uint8Array(await crypto.subtle.encrypt(params, k, copy(plaintext)));
}

/** Throws if the ciphertext, nonce, associated data or key don't match (GCM authentication). */
export async function aesGcmDecrypt(key: Uint8Array | CryptoKey, nonce: Uint8Array, ciphertext: Uint8Array, aad?: Uint8Array): Promise<Bytes> {
  const k = key instanceof CryptoKey ? key : await aesKey(key, "decrypt");
  const params: AesGcmParams = { name: "AES-GCM", iv: copy(nonce), ...(aad ? { additionalData: copy(aad) } : {}) };
  return new Uint8Array(await crypto.subtle.decrypt(params, k, copy(ciphertext)));
}
