/**
 * Independent reference implementations in Node's own crypto, written from the Kotlin sources, to check the browser code
 * against something other than itself. Nothing here ships to the browser.
 */
import { Aes256Gcm, CipherSuite, DhkemX25519HkdfSha256, HkdfSha256 } from "@hpke/core";
import nodeCrypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
/**
 * Copies of the shared test vectors (android/app/src/test/resources in the Orbit repository): the contract the Android app
 * and the server's tests check too. Refresh them from there if the protocol is ever deliberately changed.
 */
export const VECTORS = path.resolve(here, "../vectors");

export function readVectors<T = any>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(VECTORS, name), "utf8")) as T;
}

export const b64 = (b: Uint8Array): string => Buffer.from(b).toString("base64");
export const unb64 = (s: string): Buffer => Buffer.from(s, "base64");

/** android crypto/HistoryCrypto.kt `HistoryKeys.seal` and `messageTag`, with Node's HKDF, HMAC and AES-GCM. */
export function nodeHistory(seed: Uint8Array, userId: string) {
  const salt = Buffer.from("orbit-history-v1");
  const enc = Buffer.from(nodeCrypto.hkdfSync("sha256", seed, salt, Buffer.from(`enc|${userId}`), 32));
  const tagKey = Buffer.from(nodeCrypto.hkdfSync("sha256", seed, salt, Buffer.from(`tag|${userId}`), 32));
  const tag = (kind: "m" | "c", id: string) => nodeCrypto.createHmac("sha256", tagKey).update(`${kind}|${id}`).digest("base64url");
  const seal = (t: string, plaintext: string) => {
    const nonce = nodeCrypto.randomBytes(12);
    const c = nodeCrypto.createCipheriv("aes-256-gcm", enc, nonce);
    c.setAAD(Buffer.from(`orbit-history-v1|${userId}|${t}`));
    return Buffer.concat([Buffer.from([1]), nonce, c.update(plaintext, "utf8"), c.final(), c.getAuthTag()]);
  };
  /** android `HistoryKeys.open`: what a phone reads from an item a browser wrote. */
  const open = (t: string, sealed: Uint8Array) => {
    const b = Buffer.from(sealed);
    if (b[0] !== 1) throw new Error("not a history item");
    const d = nodeCrypto.createDecipheriv("aes-256-gcm", enc, b.subarray(1, 13));
    d.setAAD(Buffer.from(`orbit-history-v1|${userId}|${t}`));
    d.setAuthTag(b.subarray(b.length - 16));
    return Buffer.concat([d.update(b.subarray(13, b.length - 16)), d.final()]).toString("utf8");
  };
  return { tag, seal, open };
}

/** android `ChunkedAttachmentCrypto.encryptFile`, with Node's AES-GCM. */
export function nodeChunkedEncrypt(plain: Buffer, chunk: number) {
  const key = nodeCrypto.randomBytes(32);
  const base = nodeCrypto.randomBytes(12);
  const count = plain.length === 0 ? 1 : Math.ceil(plain.length / chunk);
  const parts: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const nonce = Buffer.from(base);
    for (let b = 0; b < 4; b++) nonce[8 + b] ^= (i >>> (8 * (3 - b))) & 0xff;
    const final = i === count - 1;
    const c = nodeCrypto.createCipheriv("aes-256-gcm", key, nonce);
    c.setAAD(Buffer.concat([Buffer.from("orbit-att-chunk"), Buffer.from([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff, final ? 1 : 0])]));
    parts.push(Buffer.concat([c.update(plain.subarray(i * chunk, (i + 1) * chunk)), c.final(), c.getAuthTag()]));
  }
  const ciphertext = Buffer.concat(parts);
  return { ciphertext, key: b64(key), nonce: b64(base), sha256: nodeCrypto.createHash("sha256").update(ciphertext).digest("base64"), chunk };
}

export function nodeAesGcmDecrypt(key: Buffer, nonce: Buffer, ct: Buffer, aad?: Buffer): Buffer {
  const d = nodeCrypto.createDecipheriv("aes-256-gcm", key, nonce);
  if (aad) d.setAAD(aad);
  d.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
}

export const nodeSuite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });

/** The phone's side of linking (android SessionRepository.approvePairing): seal the identity seed to the transfer key. */
export async function nodeSealSeed(transferPublicB64: string, signingPublicB64: string, seed: Uint8Array) {
  const recipientPublicKey = await nodeSuite.kem.deserializePublicKey(unb64(transferPublicB64));
  const out = await nodeSuite.seal({ recipientPublicKey, info: Buffer.from("griip-pairing-v1") }, Buffer.from(seed), unb64(signingPublicB64));
  return { sealedEnc: b64(new Uint8Array(out.enc)), sealedIdentity: b64(new Uint8Array(out.ct)) };
}

/** Imports a raw X25519 private key (test vectors) as a non-extractable WebCrypto key pair. */
export async function x25519PairFromRaw(priv: Uint8Array, pub: Uint8Array): Promise<CryptoKeyPair> {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b656e04220420", "hex"), Buffer.from(priv)]);
  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "X25519" }, false, ["deriveBits"]);
  const publicKey = await crypto.subtle.importKey("raw", Buffer.from(pub), { name: "X25519" }, true, []);
  return { privateKey, publicKey };
}
