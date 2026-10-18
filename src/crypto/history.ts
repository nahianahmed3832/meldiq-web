import { aesGcmDecrypt } from "./aead";
import { type Bytes, copy, toB64Url, utf8 } from "./bytes";

/**
 * Keys of the encrypted message history on the account's server (docs/MESSAGE_HISTORY.md, android crypto/HistoryCrypto.kt),
 * derived from the account identity seed with HKDF-SHA256. Both are non-extractable: this browser can decrypt history and
 * compute tags, but can't hand the keys to anyone.
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
  const enc = await crypto.subtle.deriveKey(hkdf("enc"), base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const tag = await crypto.subtle.deriveKey(hkdf("tag"), base, { name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  return { userId, enc, tag };
}

export async function historyTag(keys: HistoryKeys, kind: "m" | "c", id: string): Promise<string> {
  return toB64Url(new Uint8Array(await crypto.subtle.sign("HMAC", keys.tag, utf8(`${kind}|${id}`))));
}

/** The plaintext of an item, or an exception if it isn't this account's, was changed, or was moved to another tag. */
export async function openHistoryItem(keys: HistoryKeys, tag: string, sealed: Uint8Array): Promise<Bytes> {
  if (sealed.length <= 1 + 12 + 16 || sealed[0] !== VERSION) throw new Error("not a history item");
  return aesGcmDecrypt(keys.enc, sealed.subarray(1, 13), sealed.subarray(13), utf8(`orbit-history-v1|${keys.userId}|${tag}`));
}
