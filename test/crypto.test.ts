import nodeCrypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { aesGcmDecrypt, aesGcmEncrypt } from "../src/crypto/aead";
import { decryptFile, encryptFile } from "../src/crypto/attachment";
import { fromB64, fromUtf8, randomBytes, toB64, toB64Url, utf8 } from "../src/crypto/bytes";
import { canonical, type EnvelopeHeader } from "../src/crypto/canonical";
import { seedMatchesPublicKey, sign, signingKeyFromSeed, verify } from "../src/crypto/ed25519";
import { EnvelopeError, openEnvelope, sealEnvelope } from "../src/crypto/envelope";
import { deriveHistoryKeys, historyTag, openHistoryItem } from "../src/crypto/history";
import { fingerprint, generateDeviceKeys, generateTransferKeys, openSealedSeed, safetyNumber } from "../src/crypto/identity";
import { b64, nodeAesGcmDecrypt, nodeChunkedEncrypt, nodeHistory, nodeSealSeed, readVectors, unb64, x25519PairFromRaw } from "./support/reference";

const v = readVectors("griip-envelope-v1-vectors.json");

describe("shared griip-envelope-v1 vectors (also verified by the Android and server tests)", () => {
  it("reproduces the deterministic certificate and login proof signatures", async () => {
    const identity = await signingKeyFromSeed(fromB64(v.sender.identitySeed));
    const device = await signingKeyFromSeed(fromB64(v.sender.deviceSignSeed));
    const s = v.sender;
    expect(await sign(identity, canonical.deviceCert(s.identityKey, s.deviceSigningKey, s.deviceEncPublic))).toBe(s.certificate);
    expect(await sign(device, v.authProof.message)).toBe(v.authProof.signature);
  });

  it("matches the identity fingerprint the phone and server show", async () => {
    expect(await fingerprint(v.sender.identityKey)).toBe(v.sender.fingerprint);
  });

  it("reproduces the AES-256-GCM vector", async () => {
    const a = v.aesGcm;
    expect(toB64(await aesGcmEncrypt(fromB64(a.key), fromB64(a.nonce), fromB64(a.plaintext), fromB64(a.aad)))).toBe(a.ciphertext);
  });

  it("opens and verifies the envelope sealed by the Node reference client", async () => {
    const e = v.envelope;
    const me = await x25519PairFromRaw(fromB64(v.recipient.encPrivate), fromB64(v.recipient.encPublic));
    const text = await openEnvelope(
      { header: e.header, nonce: e.nonce, ciphertext: e.ciphertext, signature: e.signature, enc: e.enc, wrappedKey: e.wrappedKey },
      v.sender.deviceSigningKey,
      v.recipient.deviceId,
      me,
    );
    expect(text).toBe(e.plaintext);
  });

  it("refuses the vector envelope when anything signed or bound is changed", async () => {
    const e = v.envelope;
    const me = await x25519PairFromRaw(fromB64(v.recipient.encPrivate), fromB64(v.recipient.encPublic));
    const base = { header: e.header, nonce: e.nonce, ciphertext: e.ciphertext, signature: e.signature, enc: e.enc, wrappedKey: e.wrappedKey };
    const tries: (() => Promise<string>)[] = [
      () => openEnvelope({ ...base, header: { ...e.header, conversationId: "c_other" } }, v.sender.deviceSigningKey, v.recipient.deviceId, me),
      () => openEnvelope({ ...base, header: { ...e.header, sentAt: e.header.sentAt + 1 } }, v.sender.deviceSigningKey, v.recipient.deviceId, me),
      () => openEnvelope(base, v.sender.identityKey, v.recipient.deviceId, me), // wrong signing key
      () => openEnvelope(base, v.sender.deviceSigningKey, "d_someone_else", me), // key wrap bound to another device
    ];
    for (const t of tries) await expect(t()).rejects.toBeInstanceOf(EnvelopeError);
  });

  it("checks that a seed belongs to an identity key without exporting it", async () => {
    expect(await seedMatchesPublicKey(fromB64(v.sender.identitySeed), v.sender.identityKey)).toBe(true);
    expect(await seedMatchesPublicKey(fromB64(v.sender.deviceSignSeed), v.sender.identityKey)).toBe(false);
  });
});

describe("envelopes sealed in the browser", () => {
  const header = (over: Partial<EnvelopeHeader> = {}): EnvelopeHeader => ({
    messageId: "m-web-1",
    conversationId: "c-1",
    senderUserId: "u-web",
    senderDeviceId: "d-web",
    sentAt: 1_792_125_196_867,
    cls: "message",
    ...over,
  });

  it("open for every recipient with Node's own AES-GCM after an HPKE unwrap by the reference suite", async () => {
    const sender = await generateDeviceKeys();
    const phone = nodeCrypto.generateKeyPairSync("x25519");
    const phonePub = Buffer.from((phone.publicKey.export({ format: "jwk" }) as { x: string }).x, "base64url");
    const phonePriv = Buffer.from((phone.privateKey.export({ format: "jwk" }) as { d: string }).d, "base64url");
    const other = await generateDeviceKeys();
    const sealed = await sealEnvelope(
      header(),
      '{"type":"text","text":"from the browser ✓"}',
      [
        { deviceId: "d-phone", encryptionKey: b64(phonePub) },
        { deviceId: "d-other", encryptionKey: other.encryptionPublic },
      ],
      sender.signing.privateKey,
    );

    // Wire format the server validates (messages.ts zEnvelope).
    expect(sealed.nonce).toHaveLength(16);
    expect(sealed.signature).toHaveLength(88);
    for (const r of sealed.recipients) {
      expect(r.enc).toHaveLength(44);
      expect(r.wrappedKey).toHaveLength(64);
    }
    // The phone's side, in Node: verify, unwrap with the reference HPKE suite, decrypt.
    const h = canonical.header(header());
    expect(await verify(sender.signingPublic, `${h}\n${sealed.nonce}\n${sealed.ciphertext}`, sealed.signature)).toBe(true);
    const { nodeSuite } = await import("./support/reference");
    const wrap = sealed.recipients.find((r) => r.deviceId === "d-phone")!;
    const contentKey = Buffer.from(
      await nodeSuite.open(
        { recipientKey: await nodeSuite.kem.deserializePrivateKey(phonePriv), enc: unb64(wrap.enc), info: Buffer.from("griip-envelope-v1/key") },
        unb64(wrap.wrappedKey),
        Buffer.from("m-web-1\nd-phone"),
      ),
    );
    expect(nodeAesGcmDecrypt(contentKey, unb64(sealed.nonce), unb64(sealed.ciphertext), Buffer.from(h)).toString("utf8")).toBe('{"type":"text","text":"from the browser ✓"}');
    // And the other browser device opens its own copy.
    const otherWrap = sealed.recipients.find((r) => r.deviceId === "d-other")!;
    expect(
      await openEnvelope(
        { header: header(), nonce: sealed.nonce, ciphertext: sealed.ciphertext, signature: sealed.signature, enc: otherWrap.enc, wrappedKey: otherWrap.wrappedKey },
        sender.signingPublic,
        "d-other",
        other.encryption,
      ),
    ).toContain("from the browser");
  });

  it("keeps private keys non-extractable", async () => {
    const k = await generateDeviceKeys();
    await expect(crypto.subtle.exportKey("pkcs8", k.signing.privateKey)).rejects.toThrow();
    await expect(crypto.subtle.exportKey("pkcs8", k.encryption.privateKey)).rejects.toThrow();
    expect(fromB64(k.signingPublic)).toHaveLength(32);
    expect(fromB64(k.encryptionPublic)).toHaveLength(32);
  });

  it("verify is false, never an exception, for malformed input", async () => {
    expect(await verify("not base64!", "m", "sig")).toBe(false);
    expect(await verify(toB64(randomBytes(31)), "m", toB64(randomBytes(64)))).toBe(false);
  });
});

describe("attachments", () => {
  it("round-trip in the single-message format, readable by Node's AES-GCM", async () => {
    const plain = utf8("a file's bytes ✓".repeat(1000));
    const enc = await encryptFile(plain);
    expect(fromUtf8(await decryptFile(enc.ciphertext, enc))).toBe(fromUtf8(plain));
    expect(nodeAesGcmDecrypt(unb64(enc.key), unb64(enc.nonce), Buffer.from(enc.ciphertext)).equals(Buffer.from(plain))).toBe(true);
    expect(nodeCrypto.createHash("sha256").update(enc.ciphertext).digest("base64")).toBe(enc.sha256);
  });

  it("decrypt chunked files written the way the phone writes them", async () => {
    for (const size of [0, 1, 1024, 5000, 3 * 1024]) {
      const plain = nodeCrypto.randomBytes(size);
      const f = nodeChunkedEncrypt(plain, 1024);
      expect(Buffer.from(await decryptFile(f.ciphertext, f)).equals(plain)).toBe(true);
    }
  });

  it("refuse a changed, truncated or reordered file", async () => {
    const f = nodeChunkedEncrypt(nodeCrypto.randomBytes(4000), 1024);
    const flipped = Buffer.from(f.ciphertext);
    flipped[10] ^= 1;
    await expect(decryptFile(flipped, f)).rejects.toBeInstanceOf(EnvelopeError);
    const cut = f.ciphertext.subarray(0, 1040 * 2); // whole chunks, last one missing
    const hashOf = (b: Buffer) => nodeCrypto.createHash("sha256").update(b).digest("base64");
    await expect(decryptFile(cut, { ...f, sha256: hashOf(cut) })).rejects.toBeInstanceOf(EnvelopeError);
    const swapped = Buffer.concat([f.ciphertext.subarray(1040, 2080), f.ciphertext.subarray(0, 1040), f.ciphertext.subarray(2080)]);
    await expect(decryptFile(swapped, { ...f, sha256: hashOf(swapped) })).rejects.toBeInstanceOf(EnvelopeError);
    await expect(decryptFile(f.ciphertext, { ...f, chunk: 12 })).rejects.toBeInstanceOf(EnvelopeError);
  });
});

describe("encrypted history items", () => {
  const seed = nodeCrypto.randomBytes(32);

  it("opens items the phone's algorithm sealed and computes the same tags", async () => {
    const node = nodeHistory(seed, "u_alice");
    const keys = await deriveHistoryKeys(seed, "u_alice");
    const tag = await historyTag(keys, "m", "m-1");
    expect(tag).toBe(node.tag("m", "m-1"));
    expect(await historyTag(keys, "c", "c-1")).toBe(node.tag("c", "c-1"));
    expect(tag).not.toBe(await historyTag(keys, "c", "m-1"));
    const sealed = node.seal(tag, '{"v":1,"message":{"id":"m-1"}}');
    expect(fromUtf8(await openHistoryItem(keys, tag, sealed))).toBe('{"v":1,"message":{"id":"m-1"}}');
  });

  it("refuses items of another account, moved to another tag, or changed", async () => {
    const node = nodeHistory(seed, "u_alice");
    const tag = node.tag("m", "m-1");
    const sealed = node.seal(tag, "secret");
    await expect(openHistoryItem(await deriveHistoryKeys(seed, "u_bob"), tag, sealed)).rejects.toThrow();
    const keys = await deriveHistoryKeys(seed, "u_alice");
    await expect(openHistoryItem(keys, node.tag("m", "m-2"), sealed)).rejects.toThrow();
    const changed = Buffer.from(sealed);
    changed[changed.length - 1] ^= 1;
    await expect(openHistoryItem(keys, tag, changed)).rejects.toThrow();
    await expect(openHistoryItem(keys, tag, Buffer.from([2, ...sealed.subarray(1)]))).rejects.toThrow("not a history item");
  });

  it("derives non-extractable keys", async () => {
    const keys = await deriveHistoryKeys(seed, "u_alice");
    await expect(crypto.subtle.exportKey("raw", keys.enc)).rejects.toThrow();
    await expect(crypto.subtle.exportKey("raw", keys.tag)).rejects.toThrow();
  });
});

describe("linking", () => {
  it("opens the identity seed the phone sealed to this browser's transfer key", async () => {
    const device = await generateDeviceKeys();
    const transfer = await generateTransferKeys();
    const seed = nodeCrypto.randomBytes(32);
    const sealed = await nodeSealSeed(transfer.publicKey, device.signingPublic, seed);
    const opened = await openSealedSeed(transfer.pair, sealed.sealedEnc, sealed.sealedIdentity, device.signingPublic);
    expect(Buffer.from(opened).equals(seed)).toBe(true);
    // Bound to this browser's signing key: another device's key can't open it.
    const other = await generateDeviceKeys();
    await expect(openSealedSeed(transfer.pair, sealed.sealedEnc, sealed.sealedIdentity, other.signingPublic)).rejects.toThrow();
  });

  it("shows the same device fingerprint the phone shows when approving", async () => {
    const device = await generateDeviceKeys();
    const h = nodeCrypto.createHash("sha256").update(unb64(device.signingPublic)).digest();
    const expected = Array.from({ length: 6 }, (_, i) => String(Number(h.readUIntBE(i * 5, 5) % 100000)).padStart(5, "0")).join(" ");
    expect(await fingerprint(device.signingPublic)).toBe(expected);
  });

  it("computes symmetric safety numbers", async () => {
    const a = (await generateDeviceKeys()).signingPublic;
    const b = (await generateDeviceKeys()).signingPublic;
    expect(await safetyNumber(a, b)).toBe(await safetyNumber(b, a));
  });
});

describe("bytes", () => {
  it("base64 and base64url match Node", () => {
    const b = nodeCrypto.randomBytes(100_001);
    expect(toB64(b)).toBe(b.toString("base64"));
    expect(toB64Url(b)).toBe(b.toString("base64url"));
    expect(Buffer.from(fromB64(b.toString("base64"))).equals(b)).toBe(true);
    expect(() => fromB64("a-b_")).toThrow();
  });

  it("refuses malformed UTF-8 instead of guessing", () => {
    expect(() => fromUtf8(new Uint8Array([0xff, 0xfe]))).toThrow();
  });

  it("GCM refuses a wrong key", async () => {
    const k = randomBytes(32);
    const n = randomBytes(12);
    const ct = await aesGcmEncrypt(k, n, utf8("x"));
    await expect(aesGcmDecrypt(randomBytes(32), n, ct)).rejects.toThrow();
  });
});
