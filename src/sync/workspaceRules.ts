import type { OrgRole } from "../api/workspaceSchemas";

/**
 * Who may change an organisation member's role or title, or remove them: the server's rules (server/src/roles.ts),
 * mirrored only to decide which actions to offer. The server checks every change again and refuses the rest.
 */
const isLow = (r: OrgRole): boolean => r === "MEMBER" || r === "GUEST";

/** The roles [actor] may give [target] (excluding the role they already have). Empty: no change is allowed. */
export function assignableRoles(actorRole: OrgRole, targetRole: OrgRole, self: boolean, ownerCount: number): OrgRole[] {
  const all: OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "GUEST"];
  return all.filter((r) => r !== targetRole && roleChangeAllowed(actorRole, targetRole, r, self, ownerCount));
}

export function roleChangeAllowed(actorRole: OrgRole, targetRole: OrgRole, newRole: OrgRole, self: boolean, ownerCount: number): boolean {
  if (newRole === targetRole) return true;
  if (actorRole === "OWNER") return !(targetRole === "OWNER" && ownerCount <= 1);
  if (actorRole === "ADMIN") return (self && targetRole === "ADMIN" && isLow(newRole)) || (isLow(targetRole) && isLow(newRole));
  return false;
}

export function titleChangeAllowed(actorRole: OrgRole, targetRole: OrgRole, self: boolean): boolean {
  if (self || actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && isLow(targetRole);
}

/** Removing someone else; the last owner is protected besides. */
export function removalAllowed(actorRole: OrgRole, targetRole: OrgRole, ownerCount: number): boolean {
  if (targetRole === "OWNER" && ownerCount <= 1) return false;
  if (actorRole === "OWNER") return true;
  return actorRole === "ADMIN" && isLow(targetRole);
}

/** Roles an invitation may carry from [actorRole]: only owners invite admins. */
export function invitableRoles(actorRole: OrgRole): OrgRole[] {
  return actorRole === "OWNER" ? ["ADMIN", "MEMBER", "GUEST"] : ["MEMBER", "GUEST"];
}

export function roleName(role: string | null | undefined): string {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "ADMIN":
      return "Admin";
    case "GUEST":
      return "Guest";
    case "MANAGER":
      return "Manager";
    case "LEAD":
      return "Lead";
    default:
      return "Member";
  }
}

/** "ABCD-EFGH-JKLM", or typed with spaces or lower case: the code the server expects (it ignores dashes itself). */
export function cleanInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * The member list in groups (batch B12, android MemberGroups): each role shown separately heads its own group, in role
 * order, and a person appears once, under their highest such role; everyone else comes last under Members (null).
 */
export function memberGroups<T extends { customRoles: { id: string; name: string; hoist: boolean; position: number; color: string | null }[] }>(
  members: readonly T[],
): { role: { id: string; name: string; color: string | null } | null; members: T[] }[] {
  const top = (m: T) => m.customRoles.filter((r) => r.hoist).sort((a, b) => a.position - b.position)[0] ?? null;
  const roles = new Map<string, { id: string; name: string; color: string | null; position: number }>();
  for (const m of members) {
    const r = top(m);
    if (r && !roles.has(r.id)) roles.set(r.id, r);
  }
  const groups = [...roles.values()].sort((a, b) => a.position - b.position).map((r) => ({ role: { id: r.id, name: r.name, color: r.color }, members: members.filter((m) => top(m)?.id === r.id) }));
  const rest = members.filter((m) => top(m) === null);
  return rest.length ? [...groups, { role: null, members: rest }] : groups;
}
