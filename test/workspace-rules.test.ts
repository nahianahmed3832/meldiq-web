import { describe, expect, it } from "vitest";
import type { OrgRole } from "../src/api/workspaceSchemas";
import { assignableRoles, cleanInviteCode, invitableRoles, removalAllowed, roleName, titleChangeAllowed } from "../src/sync/workspaceRules";
import { members, untilWhen } from "../src/ui/format";

/**
 * The browser's mirror of the server's role rules (server/src/roles.ts), checked against the same table as the server's
 * roles.test.ts and the Android app's WorkspaceRolesTest, so the three can't drift silently. Two owners unless stated.
 */
const ROLES: OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "GUEST"];
const OTHERS: Record<OrgRole, Record<OrgRole, OrgRole[]>> = {
  OWNER: { OWNER: ["ADMIN", "MEMBER", "GUEST"], ADMIN: ["OWNER", "MEMBER", "GUEST"], MEMBER: ["OWNER", "ADMIN", "GUEST"], GUEST: ["OWNER", "ADMIN", "MEMBER"] },
  ADMIN: { OWNER: [], ADMIN: [], MEMBER: ["GUEST"], GUEST: ["MEMBER"] },
  MEMBER: { OWNER: [], ADMIN: [], MEMBER: [], GUEST: [] },
  GUEST: { OWNER: [], ADMIN: [], MEMBER: [], GUEST: [] },
};
const SELF: Record<OrgRole, OrgRole[]> = { OWNER: ["ADMIN", "MEMBER", "GUEST"], ADMIN: ["MEMBER", "GUEST"], MEMBER: [], GUEST: [] };

describe("workspace role rules (same table as the server)", () => {
  it("offers exactly the role changes the server allows for someone else", () => {
    for (const actor of ROLES) for (const target of ROLES) expect([actor, target, assignableRoles(actor, target, false, 2)]).toEqual([actor, target, OTHERS[actor][target]]);
  });

  it("offers exactly the changes the server allows to your own role", () => {
    for (const actor of ROLES) expect([actor, assignableRoles(actor, actor, true, 2)]).toEqual([actor, SELF[actor]]);
  });

  it("never offers to demote the last owner", () => {
    expect(assignableRoles("OWNER", "OWNER", true, 1)).toEqual([]);
    expect(assignableRoles("OWNER", "OWNER", false, 2)).toEqual(["ADMIN", "MEMBER", "GUEST"]);
  });

  it("limits titles, removal and invitations", () => {
    expect(ROLES.filter((t) => titleChangeAllowed("ADMIN", t, false))).toEqual(["MEMBER", "GUEST"]);
    expect(ROLES.filter((t) => titleChangeAllowed("OWNER", t, false))).toEqual(ROLES);
    expect(ROLES.filter((t) => titleChangeAllowed("MEMBER", t, false))).toEqual([]);
    expect(titleChangeAllowed("GUEST", "GUEST", true)).toBe(true);
    expect(ROLES.filter((t) => removalAllowed("ADMIN", t, 2))).toEqual(["MEMBER", "GUEST"]);
    expect(ROLES.filter((t) => removalAllowed("OWNER", t, 2))).toEqual(ROLES);
    expect(removalAllowed("OWNER", "OWNER", 1)).toBe(false);
    expect(ROLES.filter((t) => removalAllowed("MEMBER", t, 2))).toEqual([]);
    expect(invitableRoles("OWNER")).toEqual(["ADMIN", "MEMBER", "GUEST"]);
    expect(invitableRoles("ADMIN")).toEqual(["MEMBER", "GUEST"]);
  });

  it("names roles and tidies typed invitation codes", () => {
    expect(ROLES.map(roleName)).toEqual(["Owner", "Admin", "Member", "Guest"]);
    expect(roleName(null)).toBe("Member");
    expect(cleanInviteCode("  abcd-efgh-jklm ")).toBe("ABCD-EFGH-JKLM");
    expect(cleanInviteCode("abcd efgh jklm")).toBe("ABCDEFGHJKLM");
  });

  it("formats counts and expiry times", () => {
    expect([members(0), members(1), members(2)]).toEqual(["0 members", "1 member", "2 members"]);
    const now = 1_000_000_000_000;
    expect(untilWhen(now - 1, now)).toBe("now");
    expect(untilWhen(now + 20 * 60_000, now)).toBe("in 20 min");
    expect(untilWhen(now + 5 * 3_600_000, now)).toBe("in 5 h");
    expect(untilWhen(now + 3 * 86_400_000, now)).toBe("in 3 days");
    expect(untilWhen(now + 86_400_000, now)).toBe("in 1 day");
  });
});
