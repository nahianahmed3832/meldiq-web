import { text as uiText } from "../i18n";
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
export type DeletionProblem =
  | {
      kind: "mismatch";
    }
  | {
      kind: "password";
    }
  | {
      kind: "owner";
      workspaces: string[];
    }
  | {
      kind: "unavailable";
    }
  | {
      kind: "offline";
    }
  | {
      kind: "other";
    };
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
  const list = (
    details as
      | {
          workspaces?: unknown;
        }
      | null
      | undefined
  )?.workspaces;
  if (!Array.isArray(list)) return [];
  return list
    .map(
      (w) =>
        (
          w as {
            name?: unknown;
          }
        )?.name,
    )
    .filter((n): n is string => typeof n === "string");
}
export function deletionProblemText(p: DeletionProblem): string {
  switch (p.kind) {
    case "mismatch":
      return uiText("auth.interface.type_your_account_s_email_address_exactly_nothing_was_deleted_d165365");
    case "password":
      return uiText("auth.interface.that_password_isn_t_right_nothing_was_deleted_d6c9e18");
    case "owner":
      return uiText("auth.interface.you_re_the_only_owner_of_value0_make_someone_else_an_owner_or_del_ff62067", { value0: p.workspaces.join(", ") || uiText("auth.interface.a_workspace_b7c8a44") });
    case "unavailable":
      return uiText("auth.interface.this_server_can_t_delete_accounts_yet_nothing_was_deleted_ad46068");
    case "offline":
      return uiText("auth.interface.couldn_t_reach_the_server_check_your_connection_and_try_again_6aefd56");
    case "other":
      return uiText("auth.interface.something_went_wrong_and_your_account_may_not_have_been_deleted_t_2ae2a91");
  }
}
