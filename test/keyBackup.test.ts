import { describe, expect, it } from "vitest";
import { fromB64 } from "../src/crypto/bytes";
import { publicKeyFromSeed } from "../src/crypto/ed25519";
import { type KeyBackup, openKeyBackup, sealKeyBackup, WrongBackupPassword } from "../src/crypto/keyBackup";

/** Keys backed up under the password (server docs/KEY_BACKUP.md). The vector is shared with android KeyBackupCryptoTest. */
const seed = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const password = "correct horse battery";

/** Made with Node's crypto (PBKDF2-HMAC-SHA256, AES-256-GCM): every client must open it. */
const vector: KeyBackup = {
  version: 1,
  iterations: 600_000,
  salt: "AAECAwQFBgcICQoLDA0ODw==",
  nonce: "ZGVmZ2hpamtsbW5v",
  ciphertext: "GPYZyJjo3d6pvIKo7LqJKcMCF8HSIvb4hSNxe9LLcnZHpITups5EOC0K9IfZbIS5",
  identityKey: "ebVWLo/mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ=",
};

describe("key backup", () => {
  it("opens the vector the other clients made", async () => {
    expect(await openKeyBackup(password, "acc_vector", vector)).toEqual(seed);
  });

  it("seals with a fresh salt and nonce, naming the identity, and opens again", async () => {
    const a = await sealKeyBackup(password, "acc_1", seed, 1000);
    const b = await sealKeyBackup(password, "acc_1", seed, 1000);
    expect(a.identityKey).toBe(await publicKeyFromSeed(seed));
    expect(a.salt).not.toBe(b.salt);
    expect(a.nonce).not.toBe(b.nonce);
    expect(fromB64(a.ciphertext)).toHaveLength(48);
    expect(await openKeyBackup(password, "acc_1", a)).toEqual(seed);
  });

  it("refuses a wrong password, another account's backup and a backup claiming another identity", async () => {
    await expect(openKeyBackup("not the password", "acc_vector", vector)).rejects.toBeInstanceOf(WrongBackupPassword);
    await expect(openKeyBackup(password, "acc_other", vector)).rejects.toBeInstanceOf(WrongBackupPassword);
    const other = await publicKeyFromSeed(new Uint8Array(32).fill(9));
    await expect(openKeyBackup(password, "acc_vector", { ...vector, identityKey: other })).rejects.toBeInstanceOf(WrongBackupPassword);
  });

  it("uses the password's UTF-8 bytes", async () => {
    const b = await sealKeyBackup("পাসওয়ার্ড 密码", "acc_1", seed, 1000);
    expect(await openKeyBackup("পাসওয়ার্ড 密码", "acc_1", b)).toEqual(seed);
  });
});
