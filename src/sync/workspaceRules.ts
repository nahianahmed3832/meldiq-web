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
