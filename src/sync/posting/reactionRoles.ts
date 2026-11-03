import { text as uiText } from "../../i18n";
import type { PermissionDef, Role, RolesOverview } from "../roles";
/**
 * Reaction roles (community parity C, feature reaction-roles): on a message, an emoji that gives a role to whoever
 * reacts with it and takes it back when the reaction comes off. The rules the dialog keeps; the server checks again.
 */
export const REACTION_ROLES_MAX = 20;
export const REACTION_EMOJI_MAX = 64;
/** The reference's quick picks under the rows. */
export const QUICK_ROLE_EMOJI = ["✅", "🎮", "🎨", "🎵", "📢", "🔴", "🟢", "🔵", "⭐", "🔥"] as const;
export interface RoleRow {
  emoji: string;
  /** "" until a role is picked. */
  roleId: string;
}
/**
 * Roles a reaction may give: live roles this person may assign that carry no administrative power (the server's rule,
 * for owners too).
 */
export function givableRoles(overview: Pick<RolesOverview, "roles" | "catalog">): Role[] {
  const admin = new Set(overview.catalog.filter((p: PermissionDef) => p.admin).map((p) => p.key));
  return overview.roles.filter((r) => !r.archived && r.canAssign && !r.permissions.some((k) => admin.has(k)));
}
/** Adds a row for [emoji] (none when it's already there or the list is full). */
export function withEmoji(rows: readonly RoleRow[], emoji: string): RoleRow[] {
  const e = emoji.trim();
  if (!e || rows.length >= REACTION_ROLES_MAX || rows.some((r) => r.emoji === e)) return [...rows];
  return [...rows, { emoji: e, roleId: "" }];
}
/** Why the rows can't be saved, or null. An empty list removes the reaction roles. */
export function rowsProblem(rows: readonly RoleRow[]): string | null {
  if (rows.length > REACTION_ROLES_MAX) return uiText("organization.interface.a_message_takes_value0_reaction_roles_at_most_8548905", { value0: REACTION_ROLES_MAX });
  if (rows.some((r) => !r.roleId)) return uiText("organization.interface.pick_a_role_for_every_emoji_16d98f3");
  if (rows.some((r) => !r.emoji.trim() || [...r.emoji].length > REACTION_EMOJI_MAX)) return uiText("organization.interface.every_row_needs_one_emoji_cf14bec");
  if (new Set(rows.map((r) => r.emoji)).size !== rows.length) return uiText("organization.interface.each_emoji_can_give_one_role_bf87786");
  if (new Set(rows.map((r) => r.roleId)).size !== rows.length) return uiText("organization.interface.each_role_can_be_given_by_one_emoji_a56406c");
  return null;
}
