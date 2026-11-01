import { z } from "zod";

/** A value the server sent that this version doesn't know (a newer enum member). Shown as such, never as a real one. */
export const UNKNOWN = "unknown" as const;
export type Unknown = typeof UNKNOWN;

/**
 * An enum the server may extend within an API version (docs/api/README.md › Rules for clients): a value this version
 * doesn't know parses as "unknown" instead of failing the whole answer, or becoming a real value it isn't (an unknown
 * overwrite kind read as a role, an unknown privacy setting read as "everyone" and saved back that way). Screens show
 * "unknown" as such and don't offer to change what they can't read. The contract test reports every such value
 * (test/contract-fixtures.test.ts, strict pass).
 */
export function openEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, UNKNOWN] as unknown as [T[number] | Unknown, ...(T[number] | Unknown)[]]).catch(UNKNOWN);
}
