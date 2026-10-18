import { type Bytes, concat, fromB64, toB64, utf8 } from "./bytes";

/**
 * Ed25519 with WebCrypto (RFC 8032). Private keys are created or imported non-extractable: page script can sign with
 * them but can never read their bytes.
 */
const ED25519 = { name: "Ed25519" } as const;
const PKCS8_PREFIX = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

export async function generateSigningKeys(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(ED25519, false, ["sign", "verify"])) as CryptoKeyPair;
}

/** A non-extractable signing key from a 32-byte seed (the account identity seed, during linking only). */
export async function signingKeyFromSeed(seed: Uint8Array): Promise<CryptoKey> {
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  return crypto.subtle.importKey("pkcs8", concat(PKCS8_PREFIX, seed), ED25519, false, ["sign"]);
}

export async function rawPublicKey(key: CryptoKey): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export async function sign(privateKey: CryptoKey, message: string): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.sign(ED25519, privateKey, utf8(message))));
}

/** False for any malformed key or signature, never an exception. */
export async function verify(publicKeyB64: string, message: string, signatureB64: string): Promise<boolean> {
  try {
    const pub = fromB64(publicKeyB64);
    const sig = fromB64(signatureB64);
    if (pub.length !== 32 || sig.length !== 64) return false;
    const key = await crypto.subtle.importKey("raw", pub, ED25519, false, ["verify"]);
    return await crypto.subtle.verify(ED25519, key, sig, utf8(message));
  } catch {
    return false;
  }
}

/**
 * Whether [seed] is the private half of [publicKeyB64], checked by signing with one and verifying with the other, so the
 * seed is never exported. Used when the phone hands this browser the account identity during linking.
 */
export async function seedMatchesPublicKey(seed: Uint8Array, publicKeyB64: string): Promise<boolean> {
  const probe = "orbit-web-seed-check";
  return verify(publicKeyB64, probe, await sign(await signingKeyFromSeed(seed), probe));
}
