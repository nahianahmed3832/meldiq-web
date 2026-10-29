import type { AccountView } from "../api/accountSchemas";
import { randomBytes } from "../crypto/bytes";
import { canonical } from "../crypto/canonical";
import { publicKeyFromSeed, sign, signingKeyFromSeed } from "../crypto/ed25519";
import { deriveHistoryKeys } from "../crypto/history";
import { deriveReminderKey } from "../crypto/reminderKeys";
import { type DeviceKeys, generateDeviceKeys } from "../crypto/identity";
import { openKeyBackup, sealKeyBackup, WrongBackupPassword } from "../crypto/keyBackup";
import { encodeRecoveryCode } from "../crypto/recoveryCode";
import type { DeviceRecord } from "../model/types";
import type { AccountApi } from "./accountApi";

/** Something the person can act on: the recovery key belongs to another account, the approval wasn't for this one. */
export class SetupError extends Error {}

const SEED_BYTES = 32;

interface Enrolled {
  device: DeviceRecord;
}

async function certify(seed: Uint8Array, identityKey: string, keys: DeviceKeys): Promise<string> {
  return sign(await signingKeyFromSeed(seed), canonical.deviceCert(identityKey, keys.signingPublic, keys.encryptionPublic));
}

async function enroll(accounts: AccountApi, account: AccountView, seed: Uint8Array, identityKey: string, keys: DeviceKeys, deviceName: string, purpose: "register" | "add-device"): Promise<Enrolled> {
  const certificate = await certify(seed, identityKey, keys);
  const nonce = await accounts.challenge();
  const signature = await sign(keys.signing.privateKey, canonical.authProof(purpose, nonce, keys.signingPublic));
  const device = { name: deviceName, signingKey: keys.signingPublic, encryptionKey: keys.encryptionPublic, certificate };
  const r = await accounts.enroll(purpose === "register" ? { identityKey, device, nonce, signature } : { device, nonce, signature });
  return {
    device: {
      userId: r.userId,
      deviceId: r.deviceId,
      username: r.username,
      identityKey,
      keys,
      history: await deriveHistoryKeys(seed, r.userId),
      reminders: await deriveReminderKey(seed, r.userId),
      linkedAt: Date.now(),
      deviceName,
      account: { id: account.id, email: account.email },
    },
  };
}

/**
 * Seals [seed] under the sign-in [password] and saves it when the account has no usable key backup (server
 * docs/KEY_BACKUP.md), so the next new device needs only the password and an emailed code. This browser keeps no seed
 * afterwards, so this is its only chance. Best effort, true when saved: the device is already set up, and a phone
 * signing in later backs the keys up instead.
 */
export async function backUpKeysIfMissing(accounts: AccountApi, accountId: string, seed: Uint8Array, password: string | undefined): Promise<boolean> {
  if (!password) return false;
  try {
    if ((await accounts.keyBackupStatus()).exists) return false;
    await accounts.saveKeyBackup(password, await sealKeyBackup(password, accountId, seed));
    return true;
  } catch {
    // Reported as false: the caller's setup has worked either way.
    return false;
  }
}

/**
 * The emailed [code] (null when the unlock step said it needs none) gets the sealed keys back and [password] opens them.
 * The caller wipes the seed it gets.
 */
export async function openKeyBackupWithCode(accounts: AccountApi, accountId: string, code: string | null, password: string): Promise<Uint8Array> {
  const backup = await accounts.keyUnlock(code === null ? null : code.replace(/\D/g, ""));
  try {
    return await openKeyBackup(password, accountId, backup);
  } catch (e) {
    if (e instanceof WrongBackupPassword) throw new SetupError("That password doesn't open your key backup. Use your recovery key or your phone instead.");
    throw e;
  }
}

/**
 * The emailed [code] gets the sealed keys back and [password] opens them; this browser is then added like with the
 * recovery key. The seed is wiped before this returns.
 */
export async function enrollWithEmailCode(accounts: AccountApi, account: AccountView, code: string | null, password: string, deviceName: string): Promise<Enrolled> {
  const seed = await openKeyBackupWithCode(accounts, account.id, code, password);
  try {
    return await enrollWithSeed(accounts, account, seed, deviceName);
  } finally {
    seed.fill(0);
  }
}

/**
 * The account's first device (docs/ORBIT_2_ARCHITECTURE §3): makes the encryption identity here and backs it up under
 * [password] when given. The recovery key is returned to be shown once; the seed itself is wiped before this returns.
 */
export async function createIdentity(accounts: AccountApi, account: AccountView, deviceName: string, password?: string): Promise<Enrolled & { recoveryCode: string }> {
  const seed = randomBytes(SEED_BYTES);
  try {
    const identityKey = await publicKeyFromSeed(seed);
    const enrolled = await enroll(accounts, account, seed, identityKey, await generateDeviceKeys(), deviceName, "register");
    await backUpKeysIfMissing(accounts, account.id, seed, password);
    return { ...enrolled, recoveryCode: await encodeRecoveryCode(seed) };
  } finally {
    seed.fill(0);
  }
}

/**
 * Adds this browser to an account that already has an identity, certified with its seed: typed in as the recovery key, or
 * handed over by another device (pairing). The seed must be this account's, or nothing is sent.
 */
export async function enrollWithSeed(accounts: AccountApi, account: AccountView, seed: Uint8Array, deviceName: string, keys?: DeviceKeys, password?: string): Promise<Enrolled> {
  const identityKey = account.identity?.identityKey;
  if (!identityKey) throw new SetupError("This account has no encryption keys yet.");
  if ((await publicKeyFromSeed(seed)) !== identityKey) throw new SetupError("That recovery key belongs to a different Meldiq account.");
  const enrolled = await enroll(accounts, account, seed, identityKey, keys ?? (await generateDeviceKeys()), deviceName, "add-device");
  await backUpKeysIfMissing(accounts, account.id, seed, password);
  return enrolled;
}
