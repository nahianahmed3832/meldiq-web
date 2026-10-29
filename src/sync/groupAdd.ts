import { ApiError } from "../api/client";

/**
 * API 0.65.0: people choose who may add them to group chats (everyone, friends, nobody). Making a group or adding a
 * member someone's choice refuses answers 403 group_add_not_allowed with their ids; the web names them instead of
 * showing a generic failure.
 */

/** The ids a group_add_not_allowed refusal names, or null for any other error. */
export function groupAddRefused(e: unknown): string[] | null {
  if (!(e instanceof ApiError) || e.code !== "group_add_not_allowed") return null;
  const ids = (e.details as { userIds?: unknown } | null | undefined)?.userIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}

/** How many names a refusal spells out before "and N more". */
const NAMED_MAX = 2;

/** "Sam doesn't let you add them to group chats.", "Sam and Ana don't…", "Sam, Ana and 2 more don't…". */
export function groupAddRefusalText(ids: readonly string[], nameOf: (userId: string) => string | null | undefined): string {
  const names = ids.map((id) => nameOf(id) || "Someone");
  if (names.length === 0) return "Someone here doesn't let you add them to group chats.";
  if (names.length === 1) return `${names[0]} doesn't let you add them to group chats.`;
  const who = names.length <= NAMED_MAX ? `${names[0]} and ${names[1]}` : `${names.slice(0, NAMED_MAX).join(", ")} and ${names.length - NAMED_MAX} more`;
  return `${who} don't let you add them to group chats.`;
}

/** The sentence for a refusal, or null when [e] is some other error. */
export function groupAddProblem(e: unknown, nameOf: (userId: string) => string | null | undefined): string | null {
  const ids = groupAddRefused(e);
  return ids ? groupAddRefusalText(ids, nameOf) : null;
}
