import { ApiError } from "../api/client";
import { normalizeEmail } from "./rules";

/**
 * Deleting the account (server docs/ACCOUNT_DELETION.md, android ui/screens/account/DeleteAccount.kt): the person types
 * the account's email and the password, the server deletes the account (`DELETE /v2/account`), then this browser erases
 * its copy. These are the rules the page follows; unit-tested in test/delete-account-rules.test.ts.
 */

/** The button needs the account's email (case and surrounding spaces don't matter) and a password. */
export function canDeleteAccount(typedEmail: string, accountEmail: string, password: string): boolean {
  return accountEmail.trim() !== "" && password !== "" && normalizeEmail(typedEmail) === normalizeEmail(accountEmail);
}

/** Why the account wasn't deleted. Only "offline" and "other" can't promise that nothing was deleted. */
export type DeletionProblem = { kind: "mismatch" } | { kind: "password" } | { kind: "owner"; workspaces: string[] } | { kind: "unavailable" } | { kind: "offline" } | { kind: "other" };

export function deletionProblem(e: unknown): DeletionProblem {
  if (!(e instanceof ApiError)) return { kind: "other" };
  if (e.code === "confirm_mismatch") return { kind: "mismatch" };
  if (e.code === "invalid_credentials") return { kind: "password" };
  if (e.code === "owns_workspaces") return { kind: "owner", workspaces: workspaceNames(e.details) };
  if (e.status === 404) return { kind: "unavailable" };
  if (e.status === 0) return { kind: "offline" };
  return { kind: "other" };
}

/** The workspaces named in an `owns_workspaces` refusal: `{ workspaces: [{ id, name, members }] }`. */
function workspaceNames(details: unknown): string[] {
  const list = (details as { workspaces?: unknown } | null | undefined)?.workspaces;
  if (!Array.isArray(list)) return [];
  return list.map((w) => (w as { name?: unknown })?.name).filter((n): n is string => typeof n === "string");
}

export function deletionProblemText(p: DeletionProblem): string {
  switch (p.kind) {
    case "mismatch":
      return "Type your account's email address exactly. Nothing was deleted.";
    case "password":
      return "That password isn't right. Nothing was deleted.";
    case "owner":
      return `You're the only owner of ${p.workspaces.join(", ") || "a workspace"}. Make someone else an owner, or delete it, first. Nothing was deleted.`;
    case "unavailable":
      return "This server can't delete accounts yet. Nothing was deleted.";
    case "offline":
      return "Couldn't reach the server. Check your connection and try again.";
    case "other":
      return "Something went wrong, and your account may not have been deleted. Try again.";
  }
}
