import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";
import { concat, copy, fromB64, randomBytes, toB64Url, utf8 } from "./bytes";

/**
 * The key that seals reminder content kept on the server (server docs/REMINDERS.md, android crypto/ReminderCrypto.kt),
 * derived like the history keys from the account identity seed with HKDF-SHA256 (salt "meldiq-reminders-v1", info
 * "enc|<userId>"). Every device of the account derives the same key; the server never has it. Non-extractable here.
 *
 * Format: 0x01 ‖ nonce (12) ‖ AES-256-GCM ciphertext+tag, base64url; associated data "meldiq-reminder-v1|<userId>|<id>",
 * so the server can't move content between reminders or accounts.
 */
const SALT = utf8("meldiq-reminders-v1");
const VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface ReminderKey {
  userId: string;
  key: CryptoKey;
}

export async function deriveReminderKey(identitySeed: Uint8Array, userId: string): Promise<ReminderKey> {
  const base = await crypto.subtle.importKey("raw", copy(identitySeed), "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: SALT, info: utf8(`enc|${userId}`) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { userId, key };
}

const aad = (k: ReminderKey, reminderId: string) => utf8(`meldiq-reminder-v1|${k.userId}|${reminderId}`);

export async function sealReminder(k: ReminderKey, reminderId: string, plaintext: Uint8Array): Promise<string> {
  const nonce = randomBytes(NONCE_BYTES);
  return toB64Url(concat(new Uint8Array([VERSION]), nonce, await aesGcmEncrypt(k.key, nonce, plaintext, aad(k, reminderId))));
}

/** The plaintext, or an exception if the content isn't this account's, was changed, or belongs to another reminder. */
export async function openReminder(k: ReminderKey, reminderId: string, sealed: string): Promise<Uint8Array> {
  const std = sealed.trim().replace(/-/g, "+").replace(/_/g, "/");
  const bytes = fromB64(std.padEnd(std.length + ((4 - (std.length % 4)) % 4), "="));
  if (bytes.length <= 1 + NONCE_BYTES + TAG_BYTES || bytes[0] !== VERSION) throw new Error("not a sealed reminder");
  return aesGcmDecrypt(k.key, bytes.subarray(1, 1 + NONCE_BYTES), bytes.subarray(1 + NONCE_BYTES), aad(k, reminderId));
}
