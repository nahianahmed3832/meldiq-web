import { aesGcmDecrypt, aesGcmEncrypt } from "./aead";
import { type Bytes, copy, fromB64, randomBytes, toB64, utf8 } from "./bytes";
import { publicKeyFromSeed } from "./ed25519";

/**
 * The account's identity seed sealed under its password (server docs/KEY_BACKUP.md), the same as android
 * crypto/KeyBackupCrypto.kt; tested in test/keyBackup.test.ts with a vector shared with the Android and server tests.
 *
 * Key: PBKDF2-HMAC-SHA256 of the password's UTF-8 bytes with a random 16-byte salt, [KEY_BACKUP_ITERATIONS] rounds.
 * Sealed: AES-256-GCM with a random 12-byte nonce over the 32-byte seed; associated data
 * "meldiq-key-backup-v1\n<account id>\n<identity key>", so a backup can't be passed off as another account's.
 */
export const KEY_BACKUP_VERSION = 1;
export const KEY_BACKUP_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const SEED_BYTES = 32;

export interface KeyBackup {
  version: number;
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
  identityKey: string;
}

/** The password didn't open the backup, or the backup isn't this account's keys. */
export class WrongBackupPassword extends Error {
  constructor() {
    super("That password doesn't open the key backup.");
  }
}

export async function deriveBackupKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", utf8(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: copy(salt), iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const aad = (accountId: string, identityKey: string): Bytes => utf8(`meldiq-key-backup-v1\n${accountId}\n${identityKey}`);

export async function sealKeyBackup(password: string, accountId: string, seed: Uint8Array, iterations = KEY_BACKUP_ITERATIONS): Promise<KeyBackup> {
  if (seed.length !== SEED_BYTES) throw new Error("an identity seed is 32 bytes");
  const identityKey = await publicKeyFromSeed(seed);
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = await aesGcmEncrypt(await deriveBackupKey(password, salt, iterations), nonce, seed, aad(accountId, identityKey));
  return { version: KEY_BACKUP_VERSION, iterations, salt: toB64(salt), nonce: toB64(nonce), ciphertext: toB64(sealed), identityKey };
}

/** The seed in [b], checked against the identity key it names; [WrongBackupPassword] when it doesn't open or match. */
export async function openKeyBackup(password: string, accountId: string, b: KeyBackup): Promise<Bytes> {
  if (b.version !== KEY_BACKUP_VERSION) throw new Error("This key backup was made by a newer Meldiq. Reload the page.");
  let seed: Bytes;
  try {
    seed = await aesGcmDecrypt(await deriveBackupKey(password, fromB64(b.salt), b.iterations), fromB64(b.nonce), fromB64(b.ciphertext), aad(accountId, b.identityKey));
  } catch {
    throw new WrongBackupPassword();
  }
  if (seed.length !== SEED_BYTES || (await publicKeyFromSeed(seed)) !== b.identityKey) {
    seed.fill(0);
    throw new WrongBackupPassword();
  }
  return seed;
}
