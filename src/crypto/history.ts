import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";
import { type Bytes, copy, randomBytes, toB64Url, utf8 } from "./bytes";

/**
 * Keys of the encrypted message history on the account's server (docs/MESSAGE_HISTORY.md, android crypto/HistoryCrypto.kt),
 * derived from the account identity seed with HKDF-SHA256. Both are non-extractable: this browser can read and write
 * history and compute tags, but can't hand the keys to anyone. Browsers set up before 2026-10-28 derived a decrypt-only
 * key ([canWriteHistory] false): they write history once the seed is opened again (historyKeysUpgrade.ts).
 *
 * Item format: 0x01 ‖ nonce (12) ‖ AES-256-GCM ciphertext+tag, associated data "orbit-history-v1|<userId>|<tag>".
 * Tags: base64url (no padding) of HMAC-SHA256("m|<message id>" or "c|<conversation id>").
 */
const SALT = utf8("orbit-history-v1");
const VERSION = 1;

export interface HistoryKeys {
  userId: string;
  enc: CryptoKey;
  tag: CryptoKey;
}

export async function deriveHistoryKeys(identitySeed: Uint8Array, userId: string): Promise<HistoryKeys> {
  const base = await crypto.subtle.importKey("raw", copy(identitySeed), "HKDF", false, ["deriveKey"]);
  const hkdf = (label: string): HkdfParams => ({ name: "HKDF", hash: "SHA-256", salt: SALT, info: utf8(`${label}|${userId}`) });
  const enc = await crypto.subtle.deriveKey(hkdf("enc"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const tag = await crypto.subtle.deriveKey(hkdf("tag"), base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  return { userId, enc, tag };
}

export async function historyTag(keys: HistoryKeys, kind: "m" | "c", id: string): Promise<string> {
  return toB64Url(new Uint8Array(await crypto.subtle.sign("HMAC", keys.tag, utf8(`${kind}|${id}`))));
}

/** Whether these keys can write history (derived since 2026-10-28), not only read it. */
export function canWriteHistory(keys: HistoryKeys): boolean {
  return keys.enc.usages.includes("encrypt");
}

/** An item for [tag] (android HistoryKeys.seal): 0x01 ‖ a fresh random nonce ‖ ciphertext+tag, bound to the account and tag. */
export async function sealHistoryItem(keys: HistoryKeys, tag: string, plaintext: Uint8Array): Promise<Bytes> {
  const nonce = randomBytes(12);
  const sealed = await aesGcmEncrypt(keys.enc, nonce, plaintext, utf8(`orbit-history-v1|${keys.userId}|${tag}`));
  const out = new Uint8Array(1 + nonce.length + sealed.length);
  out[0] = VERSION;
  out.set(nonce, 1);
  out.set(sealed, 1 + nonce.length);
  return out;
}

/** The plaintext of an item, or an exception if it isn't this account's, was changed, or was moved to another tag. */
export async function openHistoryItem(keys: HistoryKeys, tag: string, sealed: Uint8Array): Promise<Bytes> {
  if (sealed.length <= 1 + 12 + 16 || sealed[0] !== VERSION) throw new Error("not a history item");
  return aesGcmDecrypt(keys.enc, sealed.subarray(1, 13), sealed.subarray(13), utf8(`orbit-history-v1|${keys.userId}|${tag}`));
}
