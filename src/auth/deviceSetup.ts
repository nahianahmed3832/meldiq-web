import type { AccountView } from "../api/accountSchemas";
import { randomBytes } from "../crypto/bytes";
import { canonical } from "../crypto/canonical";
import { publicKeyFromSeed, sign, signingKeyFromSeed } from "../crypto/ed25519";
import { deriveHistoryKeys } from "../crypto/history";
import { type DeviceKeys, generateDeviceKeys } from "../crypto/identity";
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
      linkedAt: Date.now(),
      deviceName,
      account: { id: account.id, email: account.email },
    },
  };
}

/**
 * The account's first device (docs/ORBIT_2_ARCHITECTURE §3): makes the encryption identity here. The recovery key is
 * returned to be shown once; the seed itself is wiped before this returns.
 */
export async function createIdentity(accounts: AccountApi, account: AccountView, deviceName: string): Promise<Enrolled & { recoveryCode: string }> {
  const seed = randomBytes(SEED_BYTES);
  try {
    const identityKey = await publicKeyFromSeed(seed);
    const enrolled = await enroll(accounts, account, seed, identityKey, await generateDeviceKeys(), deviceName, "register");
    return { ...enrolled, recoveryCode: await encodeRecoveryCode(seed) };
  } finally {
    seed.fill(0);
  }
}

/**
 * Adds this browser to an account that already has an identity, certified with its seed: typed in as the recovery key, or
 * handed over by another device (pairing). The seed must be this account's, or nothing is sent.
 */
export async function enrollWithSeed(accounts: AccountApi, account: AccountView, seed: Uint8Array, deviceName: string, keys?: DeviceKeys): Promise<Enrolled> {
  const identityKey = account.identity?.identityKey;
  if (!identityKey) throw new SetupError("This account has no encryption keys yet.");
  if ((await publicKeyFromSeed(seed)) !== identityKey) throw new SetupError("That recovery key belongs to a different Orbit account.");
  return enroll(accounts, account, seed, identityKey, keys ?? (await generateDeviceKeys()), deviceName, "add-device");
}
