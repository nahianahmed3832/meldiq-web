// A lossless decimal representation of existing URL-safe IDs. The leading 1
// preserves leading zero digits in base 64. Keep the alphabet and encoding stable.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const LEGACY_LINK_ID = "[A-Za-z0-9_-]{1,128}";
export const DECIMAL_LINK_ID = "[1-9][0-9]{0,231}";
const legacyId = new RegExp(`^${LEGACY_LINK_ID}$`);
const decimalId = new RegExp(`^${DECIMAL_LINK_ID}$`);

export function encodeLinkId(id: string): string {
  if (!legacyId.test(id)) throw new Error("Invalid link ID");
  let value = 1n;
  for (const char of id) value = (value << 6n) | BigInt(ALPHABET.indexOf(char));
  return value.toString(10);
}

export function decodeLinkId(segment: string): string | null {
  if (!decimalId.test(segment)) return null;
  let value = BigInt(segment);
  let id = "";
  while (value >= 64n && id.length < 128) {
    id = ALPHABET[Number(value & 63n)] + id;
    value >>= 6n;
  }
  return value === 1n && id ? id : null;
}
