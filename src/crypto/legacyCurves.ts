import { ed25519, x25519 } from "@noble/curves/ed25519";

/**
 * Ed25519 and X25519 for browsers whose WebCrypto doesn't have them: Safari and iOS before 17, so every iPhone 8 (it
 * stops at iOS 16.7). Without them Meldiq can't sign in or open a single message there (docs/MELDIQ_WEB_BROWSERS.md).
 *
 * Installed only where the native algorithms are missing: then `crypto.subtle` answers for these two names with
 * @noble/curves (audited, pure TypeScript), and passes everything else to the browser. Same algorithms, same bytes on
 * the wire, so phones and other browsers can't tell. The difference is where the private key lives: in this page's
 * memory, not inside the browser's crypto engine. At rest it's sealed with a non-extractable AES-GCM key, as WebKit's
 * X25519 keys already are (keyStorage.ts).
 */

type Curve = "Ed25519" | "X25519";
const CURVES: readonly Curve[] = ["Ed25519", "X25519"];

/** PKCS#8 for a 32-byte private key: the RFC 8410 prefix, then the key. */
const PKCS8: Record<Curve, Uint8Array> = {
  Ed25519: new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]),
  X25519: new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]),
};

/** Key bytes, kept out of the key objects themselves (and so out of anything that clones or logs them). */
const material = new WeakMap<LegacyKey, Uint8Array>();

/** Stands in for a CryptoKey of one of the two curves; `instanceof CryptoKey` is false, as for any foreign object. */
export class LegacyKey {
  constructor(
    readonly type: "public" | "private",
    readonly algorithm: { name: Curve },
    readonly extractable: boolean,
    readonly usages: KeyUsage[],
    bytes: Uint8Array,
  ) {
    material.set(this, fresh(bytes));
  }
}

/** A copy in a buffer of its own (a Node Buffer's slice() is a view into a shared pool, and .buffer would be the pool). */
const fresh = (b: Uint8Array): Uint8Array => Uint8Array.from(b);
const out = (b: Uint8Array): ArrayBuffer => fresh(b).buffer as ArrayBuffer;
const opError = (m: string) => new DOMException(m, "OperationError");
const curveOf = (alg: unknown): Curve | null => {
  const name = typeof alg === "string" ? alg : (alg as { name?: unknown } | null)?.name;
  return CURVES.find((c) => typeof name === "string" && c.toLowerCase() === name.toLowerCase()) ?? null;
};
const bytesOf = (d: BufferSource): Uint8Array => (d instanceof Uint8Array ? d : ArrayBuffer.isView(d) ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength) : new Uint8Array(d as ArrayBuffer));
const b64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const keyBytes = (k: LegacyKey): Uint8Array => {
  const b = material.get(k);
  if (!b) throw opError("This key's material is gone (keys made by the fallback can't be copied)");
  return b;
};
const publicOf = (curve: Curve, priv: Uint8Array): Uint8Array => (curve === "Ed25519" ? ed25519.getPublicKey(priv) : x25519.getPublicKey(priv));

function privateFromPkcs8(curve: Curve, der: Uint8Array): Uint8Array {
  const prefix = PKCS8[curve];
  if (der.length !== prefix.length + 32 || prefix.some((b, i) => der[i] !== b)) throw new DOMException(`Not a ${curve} PKCS#8 key`, "DataError");
  return fresh(der.subarray(prefix.length));
}

/** Whether this browser's own WebCrypto has [curve]. */
async function nativeHas(subtle: SubtleCrypto, curve: Curve): Promise<boolean> {
  try {
    await subtle.generateKey({ name: curve }, false, curve === "Ed25519" ? ["sign", "verify"] : ["deriveBits"]);
    return true;
  } catch {
    return false;
  }
}

let installed: Promise<Curve[]> | null = null;

/** Adds what's missing to `crypto.subtle` (once). Resolves to the curves the fallback provides (none on most browsers). */
export function installLegacyCurves(target: Crypto = globalThis.crypto, opts: { force?: boolean } = {}): Promise<Curve[]> {
  installed ??= (async () => {
    const subtle = target?.subtle;
    if (!subtle) return [];
    const missing: Curve[] = [];
    for (const c of CURVES) if (opts.force || !(await nativeHas(subtle, c))) missing.push(c);
    if (missing.length) patch(subtle, missing);
    return missing;
  })();
  return installed;
}

/** For tests: forget the installation (the patched methods stay on the object they were put on). */
export function resetLegacyCurvesForTests(): void {
  installed = null;
}

function patch(subtle: SubtleCrypto, missing: Curve[]): void {
  const native = {
    generateKey: subtle.generateKey.bind(subtle),
    importKey: subtle.importKey.bind(subtle),
    exportKey: subtle.exportKey.bind(subtle),
    sign: subtle.sign.bind(subtle),
    verify: subtle.verify.bind(subtle),
    deriveBits: subtle.deriveBits.bind(subtle),
    wrapKey: subtle.wrapKey.bind(subtle),
    unwrapKey: subtle.unwrapKey.bind(subtle),
  };
  const ours = (alg: unknown): Curve | null => {
    const c = curveOf(alg);
    return c && missing.includes(c) ? c : null;
  };
  const legacy = (k: unknown): k is LegacyKey => k instanceof LegacyKey;

  const generateKey = async (alg: AlgorithmIdentifier, extractable: boolean, usages: KeyUsage[]) => {
    const c = ours(alg);
    if (!c) return native.generateKey(alg as AlgorithmIdentifier, extractable, usages);
    const priv = c === "Ed25519" ? ed25519.utils.randomPrivateKey() : x25519.utils.randomPrivateKey();
    const pubUsages = usages.filter((u) => u === "verify");
    const privUsages = usages.filter((u) => u === "sign" || u === "deriveBits" || u === "deriveKey");
    return { publicKey: new LegacyKey("public", { name: c }, true, pubUsages, publicOf(c, priv)), privateKey: new LegacyKey("private", { name: c }, extractable, privUsages, priv) };
  };

  const importKey = async (format: KeyFormat, data: BufferSource | JsonWebKey, alg: AlgorithmIdentifier, extractable: boolean, usages: KeyUsage[]) => {
    const c = ours(alg);
    if (!c) return native.importKey(format as "raw", data as BufferSource, alg, extractable, usages);
    if (format === "raw") {
      const raw = bytesOf(data as BufferSource);
      if (raw.length !== 32) throw new DOMException(`${c} public keys are 32 bytes`, "DataError");
      return new LegacyKey("public", { name: c }, true, usages, raw);
    }
    if (format === "pkcs8") return new LegacyKey("private", { name: c }, extractable, usages, privateFromPkcs8(c, bytesOf(data as BufferSource)));
    if (format === "jwk") {
      const jwk = data as JsonWebKey;
      if (jwk.d) return new LegacyKey("private", { name: c }, extractable, usages, fromB64u(jwk.d));
      if (jwk.x) return new LegacyKey("public", { name: c }, true, usages, fromB64u(jwk.x));
    }
    throw new DOMException(`Unsupported ${c} key format ${format}`, "NotSupportedError");
  };

  const exportKey = async (format: KeyFormat, key: CryptoKey) => {
    if (!legacy(key)) return native.exportKey(format as "raw", key);
    const c = key.algorithm.name;
    const b = keyBytes(key);
    if (key.type === "private" && !key.extractable) throw new DOMException("key is not extractable", "InvalidAccessError");
    if (format === "raw" && key.type === "public") return out(b);
    if (format === "pkcs8" && key.type === "private") {
      const der = new Uint8Array(PKCS8[c].length + 32);
      der.set(PKCS8[c]);
      der.set(b, PKCS8[c].length);
      return der.buffer as ArrayBuffer;
    }
    if (format === "jwk") {
      const x = key.type === "private" ? publicOf(c, b) : b;
      return { kty: "OKP", crv: c, x: b64u(x), ...(key.type === "private" ? { d: b64u(b) } : {}), ext: true } as JsonWebKey;
    }
    throw new DOMException(`Unsupported ${c} export format ${format}`, "NotSupportedError");
  };

  const sign = async (alg: AlgorithmIdentifier, key: CryptoKey, data: BufferSource) => {
    if (!legacy(key) || !ours(alg)) return native.sign(alg, key, data);
    if (key.type !== "private") throw new DOMException("sign needs a private key", "InvalidAccessError");
    return out(ed25519.sign(bytesOf(data), keyBytes(key)));
  };

  const verify = async (alg: AlgorithmIdentifier, key: CryptoKey, signature: BufferSource, data: BufferSource) => {
    if (!legacy(key) || !ours(alg)) return native.verify(alg, key, signature, data);
    try {
      return ed25519.verify(bytesOf(signature), bytesOf(data), keyBytes(key), { zip215: false });
    } catch {
      return false;
    }
  };

  const deriveBits = async (alg: AlgorithmIdentifier & { public?: CryptoKey }, key: CryptoKey, length?: number | null) => {
    if (!legacy(key) || !ours(alg)) return native.deriveBits(alg as AlgorithmIdentifier, key, length ?? null);
    const peer = alg.public;
    if (!legacy(peer) || peer.type !== "public") throw new DOMException("X25519 needs the other side's public key", "InvalidAccessError");
    const shared = x25519.getSharedSecret(keyBytes(key), keyBytes(peer));
    // As WebCrypto does: a small-order public key gives all zeros, which is refused.
    if (shared.every((b) => b === 0)) throw opError("X25519 produced an all-zero secret");
    const bits = length ?? 256;
    return out(shared.subarray(0, Math.ceil(bits / 8)));
  };

  // Sealing a fallback key: its PKCS#8 bytes go through the browser's own AES-GCM wrap as a raw HMAC key, which gives
  // exactly the ciphertext wrapKey("pkcs8", …) would; unwrapping reverses it. So sealed keys are the same either way.
  const HMAC = { name: "HMAC", hash: "SHA-256" } as const;
  const wrapKey = async (format: KeyFormat, key: CryptoKey, wrappingKey: CryptoKey, wrapAlg: AlgorithmIdentifier) => {
    if (!legacy(key)) return native.wrapKey(format, key, wrappingKey, wrapAlg);
    const der = new Uint8Array((await exportKey(format, key)) as ArrayBuffer);
    const carrier = await native.importKey("raw", der, { ...HMAC, length: der.length * 8 }, true, ["sign"]);
    return native.wrapKey("raw", carrier, wrappingKey, wrapAlg);
  };
  const unwrapKey = async (
    format: KeyFormat,
    wrapped: BufferSource,
    unwrappingKey: CryptoKey,
    unwrapAlg: AlgorithmIdentifier,
    keyAlg: AlgorithmIdentifier,
    extractable: boolean,
    usages: KeyUsage[],
  ) => {
    if (!ours(keyAlg)) return native.unwrapKey(format, wrapped, unwrappingKey, unwrapAlg, keyAlg, extractable, usages);
    const carrier = await native.unwrapKey("raw", wrapped, unwrappingKey, unwrapAlg, HMAC, true, ["sign"]);
    return importKey(format, new Uint8Array(await native.exportKey("raw", carrier)), keyAlg, extractable, usages);
  };

  const methods = { generateKey, importKey, exportKey, sign, verify, deriveBits, wrapKey, unwrapKey };
  for (const [name, fn] of Object.entries(methods)) Object.defineProperty(subtle, name, { value: fn, configurable: true, writable: true });
}
