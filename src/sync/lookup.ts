/**
 * What someone typed to find a person (android ContactsScreen): a name or username (searched), a phone number (exact
 * lookup, only if that person allows it), or a full address on another server (@name:domain, exact, through federation).
 */
export type LookupKind = "name" | "phone" | "address";

const PHONE = /^\+?[\d\s().-]{7,20}$/;
const PHONE_DIGITS_MIN = 7;
const ADDRESS = /^@?[a-z0-9._-]{2,40}:[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function lookupKind(input: string): LookupKind {
  const v = input.trim();
  if (ADDRESS.test(v)) return "address";
  if (PHONE.test(v) && v.replace(/\D/g, "").length >= PHONE_DIGITS_MIN) return "phone";
  return "name";
}

/** The address as the server expects it: "@name:domain", lower-case. */
export function normalAddress(input: string): string {
  const v = input.trim().toLowerCase();
  return v.startsWith("@") ? v : `@${v}`;
}
