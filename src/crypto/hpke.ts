import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from "@hpke/core";
import { type Bytes, copy, fromB64, toB64 } from "./bytes";

/**
 * HPKE base mode, DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-256-GCM (RFC 9180): the suite the phone (BouncyCastle) and
 * the Node reference client (@hpke/core) use. X25519 runs on native WebCrypto.
 */
const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });

/** A non-extractable X25519 key pair (the private half can only be used, never read). */
export async function generateEncryptionKeys(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"])) as CryptoKeyPair;
}

export async function rawX25519Public(key: CryptoKey): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}

export interface Sealed {
  /** The encapsulated key (base64). */
  enc: string;
  /** The ciphertext (base64). */
  ct: string;
}

export async function seal(recipientPublicKeyB64: string, info: Uint8Array, aad: Uint8Array, plaintext: Uint8Array): Promise<Sealed> {
  const raw = fromB64(recipientPublicKeyB64);
  if (raw.length !== 32) throw new Error("X25519 public key must be 32 bytes");
  const recipientPublicKey = await suite.kem.deserializePublicKey(raw);
  const out = await suite.seal({ recipientPublicKey, info: copy(info) }, copy(plaintext), copy(aad));
  return { enc: toB64(new Uint8Array(out.enc)), ct: toB64(new Uint8Array(out.ct)) };
}

/** Opens with a key pair: passing the pair keeps the private key non-extractable (its public half is read directly). */
export async function open(recipient: CryptoKeyPair, encB64: string, info: Uint8Array, aad: Uint8Array, ctB64: string): Promise<Bytes> {
  const pt = await suite.open({ recipientKey: recipient, enc: fromB64(encB64), info: copy(info) }, fromB64(ctB64), copy(aad));
  return new Uint8Array(pt);
}
