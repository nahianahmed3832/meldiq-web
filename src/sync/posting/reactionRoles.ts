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
  if (rows.length > REACTION_ROLES_MAX) return `A message takes ${REACTION_ROLES_MAX} reaction roles at most.`;
  if (rows.some((r) => !r.roleId)) return "Pick a role for every emoji.";
  if (rows.some((r) => !r.emoji.trim() || [...r.emoji].length > REACTION_EMOJI_MAX)) return "Every row needs one emoji.";
  if (new Set(rows.map((r) => r.emoji)).size !== rows.length) return "Each emoji can give one role.";
  if (new Set(rows.map((r) => r.roleId)).size !== rows.length) return "Each role can be given by one emoji.";
  return null;
}
