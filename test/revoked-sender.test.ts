import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { ApiClient } from "../src/api/client";
import { toB64 } from "../src/crypto/bytes";
import { canonical } from "../src/crypto/canonical";
import { generateSigningKeys, rawPublicKey, sign } from "../src/crypto/ed25519";
import { LocalStore } from "../src/store/db";
import { Directory } from "../src/sync/directory";

/**
 * T1.5 in the browser (as android KeyDirectoryTest): a device revoked after it sent a message still verifies that
 * message, if the server accepted it no later than the revocation and the device is certified by the sender's pinned
 * identity key. Revoked devices are never encrypted to.
 */
async function device(identity: CryptoKeyPair, identityKey: string, id: string) {
  const signing = toB64(await rawPublicKey((await generateSigningKeys()).publicKey));
  const encryption = toB64(await rawPublicKey((await generateSigningKeys()).publicKey));
  const certificate = await sign(identity.privateKey, canonical.deviceCert(identityKey, signing, encryption));
  return { id, signingKey: signing, encryptionKey: encryption, certificate };
}

async function setup(name: string) {
  const bobIdentity = await generateSigningKeys();
  const bobKey = toB64(await rawPublicKey(bobIdentity.publicKey));
  const active = await device(bobIdentity, bobKey, "d-bob-1");
  const revoked = { ...(await device(bobIdentity, bobKey, "d-bob-2")), revokedAt: 5_000 };
  const strangerIdentity = await generateSigningKeys();
  const forged = { ...(await device(strangerIdentity, toB64(await rawPublicKey(strangerIdentity.publicKey)), "d-bob-3")), revokedAt: 5_000 };
  const entry = { userId: "u-bob", identityKey: bobKey, devices: [active], revokedDevices: [revoked, forged] };
  const api = {
    json: async (_method: string, _path: string, schema: { parse(v: unknown): unknown }) => schema.parse({ users: [entry] }),
  } as unknown as ApiClient;
  const store = await LocalStore.open(name);
  const dir = new Directory(api, store, { userId: "u-alice", deviceId: "d-web", identityKey: "unused" }, () => {});
  return { dir, active, revoked };
}

describe("messages from a device revoked after sending (T1.5)", () => {
  it("verifies what the revoked device sent before its revocation, and nothing later", async () => {
    const { dir, active, revoked } = await setup("revoked-sender-before-after");
    expect(await dir.senderKey("u-bob", active.id, 9_999)).toEqual({ kind: "trusted", signingKey: active.signingKey });
    expect(await dir.senderKey("u-bob", revoked.id, 4_999)).toEqual({ kind: "trusted", signingKey: revoked.signingKey });
    expect(await dir.senderKey("u-bob", revoked.id, 5_000)).toEqual({ kind: "trusted", signingKey: revoked.signingKey });
    expect(await dir.senderKey("u-bob", revoked.id, 5_001)).toEqual({ kind: "unknown" });
  });

  it("refuses a revoked device whose certificate isn't from the sender's identity", async () => {
    const { dir } = await setup("revoked-sender-forged");
    expect(await dir.senderKey("u-bob", "d-bob-3", 1_000)).toEqual({ kind: "unknown" });
  });

  it("never encrypts to a revoked device", async () => {
    const { dir, active } = await setup("revoked-sender-recipients");
    const r = await dir.recipients("c-dm");
    expect(r.devices.map((d) => d.deviceId)).toEqual([active.id]);
  });

  it("accepts a directory from a server without the T1.5 field", async () => {
    const { zUserKeys } = await import("../src/api/schemas");
    expect(zUserKeys.parse({ userId: "u", identityKey: "k", devices: [] }).revokedDevices).toEqual([]);
  });
});
