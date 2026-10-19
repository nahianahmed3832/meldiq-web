import { describe, expect, it } from "vitest";
import { fromB64, randomBytes, toB64 } from "../src/crypto/bytes";
import { publicKeyFromSeed, sign, signingKeyFromSeed, verify } from "../src/crypto/ed25519";
import { decodeRecoveryCode, encodeRecoveryCode } from "../src/crypto/recoveryCode";

const hex = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));

describe("recovery key (android RecoveryCode)", () => {
  it("encodes exactly as an independent implementation of the Android algorithm", async () => {
    // Reference codes computed with a separate Python port of IdentityStore.kt RecoveryCode.encode.
    expect(await encodeRecoveryCode(new Uint8Array(32).map((_, i) => i))).toBe("AAAS-EA2E-AWDA-QCAK-BJFS-2DJQ-B6JB-CESV-CSLT-NF22-DEPB-YHA7-D2RY-GDJ");
    expect(await encodeRecoveryCode(new Uint8Array(32).map((_, i) => (i * 7) & 255))).toBe("AADS-6FJ6-ENXD-CQB9-J3GX-JY5C-PF2H-Q9WF-TUK3-XJPJ-X85M-5TGM-4MNU-59J");
  });

  it("round-trips random seeds", async () => {
    for (let i = 0; i < 50; i++) {
      const seed = randomBytes(32);
      expect(await decodeRecoveryCode(await encodeRecoveryCode(seed))).toEqual(seed);
    }
  });

  it("tolerates how people type it: lower case, spaces, no dashes", async () => {
    const seed = new Uint8Array(32).map((_, i) => i);
    const code = await encodeRecoveryCode(seed);
    expect(await decodeRecoveryCode(code.toLowerCase())).toEqual(seed);
    expect(await decodeRecoveryCode(code.replace(/-/g, " "))).toEqual(seed);
    expect(await decodeRecoveryCode(code.replace(/-/g, ""))).toEqual(seed);
  });

  it("refuses a typo or a truncated key rather than restoring the wrong identity", async () => {
    const code = await encodeRecoveryCode(new Uint8Array(32).map((_, i) => (i * 7) & 255));
    const typo = (code[0] === "A" ? "B" : "A") + code.slice(1);
    expect(await decodeRecoveryCode(typo)).toBeNull();
    expect(await decodeRecoveryCode(code.slice(0, -6))).toBeNull();
    expect(await decodeRecoveryCode("")).toBeNull();
  });
});

describe("identity key from a seed", () => {
  it("matches RFC 8032 test 1", async () => {
    const seed = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
    expect(fromB64(await publicKeyFromSeed(seed))).toEqual(hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"));
  });

  it("is the key that verifies what the seed signs", async () => {
    const seed = randomBytes(32);
    const pub = await publicKeyFromSeed(seed);
    expect(await verify(pub, "orbit", await sign(await signingKeyFromSeed(seed), "orbit"))).toBe(true);
    expect(toB64(fromB64(pub))).toBe(pub);
  });
});
