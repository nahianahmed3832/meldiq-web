import { z } from "zod";
import { zConversation, zMember, zOrg } from "./schemas";

/** Workspace administration answers (server/src/routes/orgs.ts, docs/WORKSPACE_ADMINISTRATION.md). */

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

export const zOrgRole = z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]);
export type OrgRole = z.infer<typeof zOrgRole>;

export const zBranch = z.object({
  id: z.string(),
  name: z.string(),
  description: nullableString,
  location: nullableString,
  myRole: nullableString,
  canAccess: z.boolean(),
  canManage: z.boolean().default(false),
  memberCount: z.number(),
});
export type Branch = z.infer<typeof zBranch>;

export const zTeam = z.object({
  id: z.string(),
  name: z.string(),
  description: nullableString,
  branchId: nullableString,
  crossBranch: z.boolean().default(false),
  myRole: nullableString,
  canAccess: z.boolean(),
  canManage: z.boolean().default(false),
  memberCount: z.number(),
  /** The department of its branch it's grouped under (no access of its own); null when ungrouped or cross-branch. */
  departmentId: nullableString.default(null),
});
export type Team = z.infer<typeof zTeam>;

/** A group of one branch's teams (docs/WORKSPACE_ADMINISTRATION.md D-15): it organises, it grants no access. */
export const zDepartment = z.object({ id: z.string(), branchId: z.string(), name: z.string(), description: nullableString });
export type Department = z.infer<typeof zDepartment>;

export const zOrgPermissions = z.object({
  canManageOrg: z.boolean(),
  canInvite: z.boolean(),
  canCreateChannels: z.boolean(),
  canViewDirectory: z.boolean(),
  isOwner: z.boolean(),
  canLeave: z.boolean().default(true),
  canRestore: z.boolean().default(false),
  // Custom roles, audit, usage and ownership (API 0.6+, docs/WORKSPACE_ROLES.md); false on older servers.
  canViewRoles: z.boolean().default(false),
  canManageRoles: z.boolean().default(false),
  canAssignRoles: z.boolean().default(false),
  canViewAudit: z.boolean().default(false),
  canViewUsage: z.boolean().default(false),
  canViewApps: z.boolean().default(false),
  canManageApps: z.boolean().default(false),
  // Round 7 (API with workflows, groups, developer access, policies); false on older servers.
  canManageWorkflows: z.boolean().default(false),
  canManageGroups: z.boolean().default(false),
  canManageDevelopers: z.boolean().default(false),
  canManagePolicies: z.boolean().default(false),
  canTransferOwnership: z.boolean().default(false),
  effective: z.array(z.string()).default([]),
});
export type OrgPermissions = z.infer<typeof zOrgPermissions>;

export const zOrgAdminDetail = z.object({
  org: zOrg,
  branches: z.array(zBranch),
  teams: z.array(zTeam),
  departments: z.array(zDepartment).default([]),
  stats: z.object({ members: z.number(), teams: z.number(), channels: z.number(), branches: z.number() }),
  permissions: zOrgPermissions,
});
export type OrgAdminDetail = z.infer<typeof zOrgAdminDetail>;

export const zDirectoryMember = zMember.extend({
  title: nullableString,
  /** A guest's end date (round 7); null for members and guests without one. */
  expiresAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  branches: z.array(z.object({ id: z.string(), role: nullableString })).default([]),
  teams: z.array(z.object({ id: z.string(), role: nullableString })).default([]),
});
export type DirectoryMember = z.infer<typeof zDirectoryMember>;

export const zInviteStatus = z.enum(["active", "revoked", "expired", "used_up"]);
export const zInvite = z.object({
  id: z.string(),
  hint: z.string(),
  role: z.string(),
  branchId: nullableString,
  teamId: nullableString,
  maxUses: z.number(),
  uses: z.number(),
  createdAt: z.number(),
  expiresAt: z.number(),
  status: zInviteStatus,
  createdBy: nullableString,
  createdByName: nullableString,
});
export type Invite = z.infer<typeof zInvite>;

export const zNewInvite = z.object({ id: z.string(), code: z.string(), role: z.string(), maxUses: z.number(), expiresAt: z.number() });
export type NewInvite = z.infer<typeof zNewInvite>;

export const zInvitePreview = z.object({
  org: z.object({ id: z.string(), name: z.string(), description: nullableString }),
  role: z.string(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
  team: z.object({ id: z.string(), name: z.string() }).nullable(),
  alreadyMember: z.boolean(),
});
export type InvitePreview = z.infer<typeof zInvitePreview>;

export const zArchived = z.object({
  branches: z.array(z.object({ id: z.string(), name: z.string(), archivedAt: z.number().nullable() })),
  teams: z.array(z.object({ id: z.string(), name: z.string(), branchId: nullableString, archivedAt: z.number().nullable(), branchArchived: z.boolean().default(false) })),
});
export type Archived = z.infer<typeof zArchived>;

export const zConversationOut = z.object({ conversation: zConversation });
export const zChannelOut = z.object({ channel: zConversation });
export const zOrgOut = z.object({ org: zOrg });
