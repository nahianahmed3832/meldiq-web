import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openEnvelope, sealEnvelope } from "../src/crypto/envelope";
import { generateDeviceKeys } from "../src/crypto/identity";
import { x25519KeysPersist } from "../src/crypto/keyStorage";
import { sign, verify } from "../src/crypto/ed25519";
import type { DeviceRecord } from "../src/model/types";
import { LocalStore } from "../src/store/db";

/** The suite run with the fallback curves (ORBIT_LEGACY_CURVES=1, test/support/legacyCurvesSetup.ts): Safari before 17. */
const legacy = process.env.ORBIT_LEGACY_CURVES === "1";

const record = (keys: DeviceRecord["keys"]): DeviceRecord => ({ userId: "u-1", deviceId: "d-web", username: "alice", identityKey: "", keys, history: null, linkedAt: 1, deviceName: "test" });

async function roundTrip(keys: DeviceRecord["keys"], name: string): Promise<{ loaded: DeviceRecord; raw: unknown }> {
  const store = await LocalStore.open(name);
  await store.saveDevice(record(keys));
  store.close();
  const again = await LocalStore.open(name);
  const loaded = (await again.device())!;
  const raw = await again.getValue("device");
  again.close();
  return { loaded, raw };
}

async function opens(loaded: DeviceRecord): Promise<boolean> {
  const sender = await generateDeviceKeys();
  const header = { messageId: "m-1", conversationId: "c-1", senderUserId: "u-2", senderDeviceId: "d-2", sentAt: 1, cls: "message" as const };
  const sealed = await sealEnvelope(header, "secret ✓", [{ deviceId: "d-web", encryptionKey: loaded.keys.encryptionPublic }], sender.signing.privateKey);
  const w = sealed.recipients[0];
  return (
    (await openEnvelope(
      { header, nonce: sealed.nonce, ciphertext: sealed.ciphertext, signature: sealed.signature, enc: w.enc, wrappedKey: w.wrappedKey },
      sender.signingPublic,
      "d-web",
      loaded.keys.encryption,
    )) === "secret ✓"
  );
}

describe("keeping the device's encryption key across page loads", () => {
  it.skipIf(legacy)("stores non-extractable keys directly where the browser supports it", async () => {
    expect(await x25519KeysPersist()).toBe(true); // Node, like Chromium and Firefox
    const keys = await generateDeviceKeys();
    expect(keys.sealedEncryption).toBeUndefined();
    const { loaded } = await roundTrip(keys, "ks-direct");
    expect(await opens(loaded)).toBe(true);
  });

  it.skipIf(legacy)("stores only the sealed form where the browser can't keep X25519 keys (WebKit), and rebuilds a working key", async () => {
    const keys = await generateDeviceKeys({ sealEncryptionKey: true });
    expect(keys.sealedEncryption).toBeDefined();
    await expect(crypto.subtle.exportKey("pkcs8", keys.encryption.privateKey)).rejects.toThrow(); // the session copy is non-extractable
    await expect(crypto.subtle.exportKey("raw", keys.sealedEncryption!.wrappingKey)).rejects.toThrow();
    const { loaded, raw } = await roundTrip(keys, "ks-sealed");
    expect((raw as DeviceRecord).keys.encryption).toBeNull(); // no CryptoKey of the X25519 kind in storage
    expect(loaded.keys.encryption.privateKey).toBeInstanceOf(CryptoKey);
    await expect(crypto.subtle.exportKey("pkcs8", loaded.keys.encryption.privateKey)).rejects.toThrow();
    expect(await opens(loaded)).toBe(true);
  });

  it.runIf(legacy)("without native Ed25519/X25519 (Safari before 17), stores both private keys only sealed and rebuilds working ones", async () => {
    const keys = await generateDeviceKeys();
    expect(keys.sealedSigning && keys.sealedEncryption).toBeTruthy();
    const { loaded, raw } = await roundTrip(keys, "ks-legacy");
    expect((raw as DeviceRecord).keys.signing).toBeNull();
    expect((raw as DeviceRecord).keys.encryption).toBeNull();
    expect(await opens(loaded)).toBe(true);
    const proof = await sign(loaded.keys.signing.privateKey, "login proof");
    expect(await verify(keys.signingPublic, "login proof", proof)).toBe(true);
  });
});
