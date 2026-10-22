import nodeCrypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fromB64, toB64, utf8 } from "../src/crypto/bytes";
import { canonical } from "../src/crypto/canonical";
import { sign, signingKeyFromSeed, verify, publicKeyFromSeed } from "../src/crypto/ed25519";
import { openEnvelope, sealEnvelope } from "../src/crypto/envelope";
import { generateDeviceKeys } from "../src/crypto/identity";
import { ed25519KeysPersist, unsealEd25519, unsealX25519, x25519KeysPersist } from "../src/crypto/keyStorage";
import { installLegacyCurves, LegacyKey } from "../src/crypto/legacyCurves";
import { readVectors, x25519PairFromRaw } from "./support/reference";

/**
 * The fallback Ed25519/X25519 (Safari before 17, every iPhone 8), forced on in this test file only (vitest runs each
 * file on its own). Checked against the shared vectors the Android app and the server also verify, and against Node's
 * own native implementation (node:crypto, which the patched WebCrypto object doesn't touch).
 */
const v = readVectors("griip-envelope-v1-vectors.json");

beforeAll(async () => {
  expect(await installLegacyCurves(globalThis.crypto, { force: true })).toEqual(["Ed25519", "X25519"]);
});

describe("fallback Ed25519 and X25519 (browsers without them in WebCrypto)", () => {
  it("is what answers now, and its keys can't be read or kept by cloning", async () => {
    const k = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
    expect(k.privateKey).toBeInstanceOf(LegacyKey);
    await expect(crypto.subtle.exportKey("pkcs8", k.privateKey)).rejects.toThrow(/not extractable/);
    expect(await ed25519KeysPersist()).toBe(false);
    expect(await x25519KeysPersist()).toBe(false);
  });

  it("signs exactly the shared vectors' certificate and login proof", async () => {
    const identity = await signingKeyFromSeed(fromB64(v.sender.identitySeed));
    const device = await signingKeyFromSeed(fromB64(v.sender.deviceSignSeed));
    const s = v.sender;
    expect(await sign(identity, canonical.deviceCert(s.identityKey, s.deviceSigningKey, s.deviceEncPublic))).toBe(s.certificate);
    expect(await sign(device, v.authProof.message)).toBe(v.authProof.signature);
    expect(await publicKeyFromSeed(fromB64(v.sender.identitySeed))).toBe(s.identityKey);
    expect(await verify(s.deviceSigningKey, v.authProof.message, v.authProof.signature)).toBe(true);
    expect(await verify(s.deviceSigningKey, v.authProof.message + "x", v.authProof.signature)).toBe(false);
  });

  it("verifies and is verified by the native implementation", async () => {
    const native = nodeCrypto.generateKeyPairSync("ed25519");
    const pub = native.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const message = "native to fallback";
    const signature = nodeCrypto.sign(null, Buffer.from(message), native.privateKey);
    expect(await verify(toB64(pub), message, toB64(signature))).toBe(true);
    const ours = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const oursPub = new Uint8Array(await crypto.subtle.exportKey("raw", ours.publicKey));
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, ours.privateKey, utf8("fallback to native")));
    const nativePub = nodeCrypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), oursPub]), format: "der", type: "spki" });
    expect(nodeCrypto.verify(null, Buffer.from("fallback to native"), nativePub, sig)).toBe(true);
  });

  it("agrees on X25519 shared secrets with the native implementation", async () => {
    const native = nodeCrypto.generateKeyPairSync("x25519");
    const nativePub = native.publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    const ours = (await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
    const oursPub = new Uint8Array(await crypto.subtle.exportKey("raw", ours.publicKey));
    const peer = await crypto.subtle.importKey("raw", nativePub, { name: "X25519" }, true, []);
    const mine = new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: peer } as AlgorithmIdentifier, ours.privateKey, 256));
    const theirs = nodeCrypto.diffieHellman({
      privateKey: native.privateKey,
      publicKey: nodeCrypto.createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b656e032100", "hex"), oursPub]), format: "der", type: "spki" }),
    });
    expect(toB64(mine)).toBe(toB64(theirs));
    // A small-order point gives all zeros: refused, as WebCrypto does.
    const zero = await crypto.subtle.importKey("raw", new Uint8Array(32), { name: "X25519" }, true, []);
    await expect(crypto.subtle.deriveBits({ name: "X25519", public: zero } as AlgorithmIdentifier, ours.privateKey, 256)).rejects.toThrow();
  });

  it("opens the envelope the Node reference client sealed (the format the phone uses)", async () => {
    const e = v.envelope;
    const me = await x25519PairFromRaw(fromB64(v.recipient.encPrivate), fromB64(v.recipient.encPublic));
    expect(me.privateKey).toBeInstanceOf(LegacyKey);
    const text = await openEnvelope(
      { header: e.header, nonce: e.nonce, ciphertext: e.ciphertext, signature: e.signature, enc: e.enc, wrappedKey: e.wrappedKey },
      v.sender.deviceSigningKey,
      v.recipient.deviceId,
      me,
    );
    expect(text).toBe(e.plaintext);
  });

  it("keeps device keys sealed at rest; after a reload (structured clone) they still sign and decrypt", async () => {
    const sender = await generateDeviceKeys();
    const recipient = await generateDeviceKeys();
    expect(sender.sealedSigning && sender.sealedEncryption).toBeTruthy();
    // What IndexedDB keeps: the sealed forms (the session's key objects can't be cloned with their material).
    const stored = structuredClone({ sealedSigning: recipient.sealedSigning!, sealedEncryption: recipient.sealedEncryption! });
    const reloaded = { privateKey: await unsealX25519(stored.sealedEncryption), publicKey: recipient.encryption.publicKey };
    const header = { conversationId: "c1", messageId: "m1", senderUserId: "u1", senderDeviceId: "d1", sentAt: 1, cls: "message" as const };
    const sealed = await sealEnvelope(header, "hello from iOS 16", [{ deviceId: "d2", encryptionKey: recipient.encryptionPublic }], sender.signing.privateKey);
    const wrap = sealed.recipients[0];
    const text = await openEnvelope(
      { header: sealed.header, nonce: sealed.nonce, ciphertext: sealed.ciphertext, signature: sealed.signature, enc: wrap.enc, wrappedKey: wrap.wrappedKey },
      sender.signingPublic,
      "d2",
      reloaded,
    );
    expect(text).toBe("hello from iOS 16");
    const signer = await unsealEd25519(stored.sealedSigning);
    expect(await verify(recipient.signingPublic, "proof", await sign(signer, "proof"))).toBe(true);
  });
});
