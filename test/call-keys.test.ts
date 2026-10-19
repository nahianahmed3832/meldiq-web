import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { CallKeyRing, isWellFormedKey, judgeKey, KeyRequestPacer, newCallKey, verificationCode, VERIFY_EMOJI } from "../src/call/callKeys";
import { AuditBook, decodedVerdict, encodedVerdict, FRAME_OVERHEAD, inspectIncoming, isAuditMessage } from "../src/call/frameAudit";

/** An independent implementation of android CallVerification.code, on Node's own HKDF. */
function referenceCode(key: string, callId: string): { emoji: string[]; digits: string } {
  const okm = Buffer.from(crypto.hkdfSync("sha256", Buffer.from(key, "utf8"), Buffer.from("orbit-call-verify-v1"), Buffer.from(callId), 8));
  const bits = okm.readBigUInt64BE(0);
  const emoji = [58n, 52n, 46n, 40n].map((s) => VERIFY_EMOJI[Number((bits >> s) & 63n)]);
  const n = Number((bits >> 4n) & 0xfffffn) % 1_000_000;
  return { emoji, digits: `${String(Math.floor(n / 1000)).padStart(3, "0")} ${String(n % 1000).padStart(3, "0")}` };
}

describe("call keys", () => {
  it("makes 256-bit keys in the Android format and refuses anything else", () => {
    const k = newCallKey();
    expect(k).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(Buffer.from(k, "base64")).toHaveLength(32);
    expect(newCallKey()).not.toBe(k);
    expect(isWellFormedKey(k)).toBe(true);
    expect(isWellFormedKey(Buffer.alloc(16).toString("base64"))).toBe(false);
    expect(isWellFormedKey("not base64!")).toBe(false);
    expect(isWellFormedKey("")).toBe(false);
  });

  it("accepts a key only from the call's creator, in the call's conversation, while it's live (T5.2)", () => {
    const call = { conversationId: "c1", createdBy: "alice", state: "RINGING" };
    expect(judgeKey(call, "c1", "alice")).toBeNull();
    expect(judgeKey(call, "c1", "mallory")).toBe("not_creator");
    expect(judgeKey(call, "c2", "alice")).toBe("wrong_conversation");
    expect(judgeKey(null, "c1", "alice")).toBe("unknown_call");
    expect(judgeKey({ ...call, state: "ENDED" }, "c1", "alice")).toBe("ended");
  });

  it("in a voice room, someone connected to its call may pass the key on; outside voice rooms only the creator counts (android CallKeyVerifierTest)", () => {
    const room = { conversationId: "c1", createdBy: "alice", state: "ACTIVE", voiceRoom: true, participants: [{ userId: "bob" }] };
    expect(judgeKey(room, "c1", "alice")).toBeNull();
    expect(judgeKey(room, "c1", "bob")).toBeNull();
    expect(judgeKey(room, "c1", "mallory")).toBe("not_creator");
    expect(judgeKey(room, "c2", "bob")).toBe("wrong_conversation");
    expect(judgeKey({ ...room, voiceRoom: false }, "c1", "bob")).toBe("not_creator");
  });

  it("keeps the first key for a call: a later invite can't swap it mid-call", () => {
    const ring = new CallKeyRing();
    const first = newCallKey();
    expect(ring.accept({ callId: "k1", conversationId: "c1", fromUserId: "alice", key: first })).toBe("accepted");
    expect(ring.accept({ callId: "k1", conversationId: "c1", fromUserId: "alice", key: newCallKey() })).toBe("duplicate");
    expect(ring.get("k1")?.key).toBe(first);
    expect(ring.accept({ callId: "k2", conversationId: "c1", fromUserId: "alice", key: "short" })).toBe("malformed");
    expect(ring.get("k2")).toBeNull();
    ring.drop("k1");
    expect(ring.get("k1")).toBeNull();
  });

  it("holds at most 64 calls' keys, forgetting the oldest", () => {
    const ring = new CallKeyRing();
    for (let i = 0; i < 70; i++) ring.accept({ callId: `k${i}`, conversationId: "c", fromUserId: "a", key: newCallKey() });
    expect(ring.get("k0")).toBeNull();
    expect(ring.get("k5")).toBeNull();
    expect(ring.get("k6")).not.toBeNull();
    expect(ring.get("k69")).not.toBeNull();
  });

  it("asks for a missing key after a grace period, then at most every 5 s; the creator answers at most every 5 s (T5.3)", () => {
    let now = 0;
    const p = new KeyRequestPacer(() => now);
    expect(p.shouldRequest("c")).toBe(false); // the key is usually just in flight
    now = 1_000;
    expect(p.shouldRequest("c")).toBe(false);
    now = 1_500;
    expect(p.shouldRequest("c")).toBe(true);
    now = 3_000;
    expect(p.shouldRequest("c")).toBe(false);
    now = 6_500;
    expect(p.shouldRequest("c")).toBe(true);
    expect(p.shouldAnswer("c")).toBe(true);
    now = 7_000;
    expect(p.shouldAnswer("c")).toBe(false);
    now = 11_500;
    expect(p.shouldAnswer("c")).toBe(true);
  });

  it("derives the same verification code as the Android algorithm, from the key and the call id", async () => {
    const key = "q83vEjRWeJA0ZVYDAhXzG7m0z1aE0t7K1oVQ3m0X9iY="; // the key in android CallVerificationTest
    const a = await verificationCode(key, "call_1");
    expect(a).toEqual(referenceCode(key, "call_1"));
    expect(a.emoji).toHaveLength(4);
    expect(a.digits).toMatch(/^\d{3} \d{3}$/);
    expect(await verificationCode(key, "call_1")).toEqual(a);
    expect(await verificationCode("q83vEjRWeJA0ZVYDAhXzG7m0z1aE0t7K1oVQ3m0X9iZ=", "call_1")).not.toEqual(a);
    expect(await verificationCode(key, "call_2")).not.toEqual(a);
    for (let i = 0; i < 20; i++) {
      const k = newCallKey();
      expect(await verificationCode(k, `call_${i}`)).toEqual(referenceCode(k, `call_${i}`));
    }
    expect(new Set(VERIFY_EMOJI).size).toBe(64);
  });

  it("uses WebCrypto's HKDF as RFC 5869 defines it (test case 1)", async () => {
    const ikm = await crypto.webcrypto.subtle.importKey("raw", Buffer.alloc(22, 0x0b), "HKDF", false, ["deriveBits"]);
    const okm = await crypto.webcrypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: Buffer.from("000102030405060708090a0b0c", "hex"), info: Buffer.from("f0f1f2f3f4f5f6f7f8f9", "hex") },
      ikm,
      42 * 8,
    );
    expect(Buffer.from(okm).toString("hex")).toBe("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865");
  });
});

/** A frame as LiveKit's cryptor writes it: header ‖ ciphertext+tag ‖ IV ‖ [12, keyIndex]. */
function encryptedFrame(payload: number, header = 1): ArrayBuffer {
  const out = new Uint8Array(header + payload + FRAME_OVERHEAD);
  out[out.length - 2] = 12;
  out[out.length - 1] = 0;
  return out.buffer;
}

describe("frame audit", () => {
  it("counts a received frame as verified only when the cryptor authenticated and shortened it", () => {
    const enc = encryptedFrame(100);
    const seen = inspectIncoming(enc, null);
    expect(seen).toEqual({ length: 131, ivLength: 12, serverInjected: false });
    expect(decodedVerdict(seen, 101)).toBe("verified"); // header + plaintext
    expect(decodedVerdict(seen, 131)).toBe("unencrypted"); // passed through unchanged
    expect(decodedVerdict(seen, 120)).toBe("unencrypted"); // not shortened by the full overhead
    expect(decodedVerdict(inspectIncoming(new Uint8Array([1, 2, 3, 4]).buffer, null), 4)).toBe("unencrypted");
    expect(decodedVerdict(undefined, 50)).toBe("unencrypted"); // a frame the audit never saw going in
  });

  it("passes empty frames and the media server's injected frames, without counting them as proof", () => {
    expect(decodedVerdict(inspectIncoming(new ArrayBuffer(0), null), 0)).toBe("empty");
    const trailer = new Uint8Array([0x4c, 0x4b, 0x2d, 0x52]);
    const sif = new Uint8Array([9, 9, 9, 0x4c, 0x4b, 0x2d, 0x52]);
    const seen = inspectIncoming(sif.buffer, trailer);
    expect(seen.serverInjected).toBe(true);
    expect(decodedVerdict(seen, 3)).toBe("injected");
    expect(inspectIncoming(sif.buffer, null).serverInjected).toBe(false);
    expect(inspectIncoming(sif.buffer, new Uint8Array(0)).serverInjected).toBe(false);
  });

  it("counts an outgoing frame as verified only when it grew by the encryption overhead and ends in the trailer", () => {
    expect(encodedVerdict(101, encryptedFrame(100))).toBe("verified");
    expect(encodedVerdict(101, new Uint8Array(101).buffer)).toBe("unencrypted"); // sent as it was
    const noTrailer = new Uint8Array(200);
    expect(encodedVerdict(101, noTrailer.buffer)).toBe("unencrypted");
    expect(encodedVerdict(0, new ArrayBuffer(0))).toBe("empty");
    expect(encodedVerdict(undefined, encryptedFrame(100))).toBe("unencrypted");
  });

  it("reports what changed per track since the last report, following a reused transceiver's new id", () => {
    const book = new AuditBook();
    const a = book.open("decode", "bob.d1", "t1");
    a.frames += 3;
    book.record(a, "verified");
    book.record(a, "verified");
    book.record(a, "unencrypted");
    book.record(a, "empty");
    book.open("encode", "me.d0", "t2");
    expect(book.drain()).toEqual([{ op: "decode", participantIdentity: "bob.d1", trackId: "t1", frames: 3, verified: 2, unencrypted: 1, injected: 0 }]);
    expect(book.drain()).toEqual([]);
    book.rename("decode", "t1", "t9", "carol.d2");
    a.frames++;
    book.record(a, "injected");
    expect(book.drain()).toEqual([{ op: "decode", participantIdentity: "carol.d2", trackId: "t9", frames: 1, verified: 0, unencrypted: 0, injected: 1 }]);
    expect(isAuditMessage({ kind: "orbit.frameAudit", data: { tracks: [] } })).toBe(true);
    expect(isAuditMessage({ kind: "log", data: {} })).toBe(false);
    expect(isAuditMessage(null)).toBe(false);
  });
});
