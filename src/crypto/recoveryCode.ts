import { type Bytes, sha256 } from "./bytes";

/**
 * The recovery key people write down: the 32-byte identity seed plus the first two bytes of its SHA-256, in base32
 * (no 0, 1, I or O), grouped in fours (android crypto/IdentityStore.kt `RecoveryCode`). Decoding tolerates case,
 * spaces and missing dashes, and refuses a typo or a truncated key instead of restoring the wrong identity.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEED_BYTES = 32;
const CHECK_BYTES = 2;
const GROUP = 4;

export async function encodeRecoveryCode(seed: Uint8Array): Promise<string> {
  if (seed.length !== SEED_BYTES) throw new Error("an identity seed is 32 bytes");
  const check = (await sha256(seed)).subarray(0, CHECK_BYTES);
  const data = [...seed, ...check];
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const b of data) {
    buffer = ((buffer << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return (out.match(new RegExp(`.{1,${GROUP}}`, "g")) ?? []).join("-");
}

/** The identity seed in [code], or null when it isn't a whole, correctly typed recovery key. */
export async function decodeRecoveryCode(code: string): Promise<Bytes | null> {
  const clean = [...code.toUpperCase()].filter((c) => ALPHABET.includes(c));
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const c of clean) {
    buffer = ((buffer << 5) | ALPHABET.indexOf(c)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (bytes.length < SEED_BYTES + CHECK_BYTES) return null;
  const seed = new Uint8Array(bytes.slice(0, SEED_BYTES));
  const check = (await sha256(seed)).subarray(0, CHECK_BYTES);
  return check[0] === bytes[SEED_BYTES] && check[1] === bytes[SEED_BYTES + 1] ? seed : null;
}
