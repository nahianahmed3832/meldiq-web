import { z } from "zod";
import { openEnum } from "./enums";
import { zConversation, zOrg } from "./schemas";

/**
 * Community answers (server/src/routes/community.ts, applications.ts, reports.ts; docs/COMMUNITY_REBUILD_2026-10-21.md).
 * Validated at the boundary like every other answer; unknown fields are dropped.
 */

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const nullableNumber = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

export const zCategory = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int().default(0),
  channelCount: z.number().int().default(0),
  canManage: z.boolean().default(false),
  canCreateChannels: z.boolean().default(false),
});
export type Category = z.infer<typeof zCategory>;
export const zCategories = z.object({ categories: z.array(zCategory) });

/** The channel capabilities an overwrite can allow or deny (server permissions/channel.ts). */
export const zCapability = z.object({ key: z.string(), label: z.string(), description: nullableString });
export const zOverwrite = z.object({
  subject: z.string(),
  kind: openEnum(["everyone", "role", "member"]),
  label: z.string(),
  color: nullableString,
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});
export type Overwrite = z.infer<typeof zOverwrite>;
export const zOverwrites = z.object({
  overwrites: z.array(zOverwrite),
  capabilities: z.array(zCapability),
  roles: z.array(z.object({ id: z.string(), name: z.string(), color: nullableString })),
  canManage: z.boolean().default(false),
  /** After a change: how many memberships the server removed because people lost access. */
  removed: z.number().int().default(0),
});
export type Overwrites = z.infer<typeof zOverwrites>;

export const zDiscovered = z.object({
  id: z.string(),
  name: z.string(),
  description: nullableString,
  memberCount: z.number().int().default(0),
  photoRev: nullableNumber,
  joinPolicy: openEnum(["invite", "open"]),
  applications: z.boolean().default(false),
  joined: z.boolean().default(false),
});
export type Discovered = z.infer<typeof zDiscovered>;
export const zDiscoverPage = z.object({ communities: z.array(zDiscovered), nextCursor: nullableNumber });

export const zApplicationStatus = openEnum(["pending", "approved", "denied", "withdrawn"]);
export const zPreview = z.object({
  community: zOrg,
  channels: z.array(z.object({ id: z.string(), name: nullableString, topic: nullableString, kind: nullableString, voice: z.boolean().default(false), format: z.string().default("text") })),
  joined: z.boolean(),
  banned: z.boolean().default(false),
  application: z
    .object({ id: z.string(), status: zApplicationStatus, createdAt: z.number() })
    .nullish()
    .transform((v) => v ?? null),
});
export type CommunityPreview = z.infer<typeof zPreview>;
export const zJoined = z.object({ org: zOrg, alreadyMember: z.boolean().default(false) });

export const zBan = z.object({
  userId: z.string(),
  displayName: z.string(),
  username: z.string(),
  reason: nullableString,
  bannedAt: z.number(),
  bannedBy: nullableString,
  bannedByName: nullableString,
});
export type Ban = z.infer<typeof zBan>;
export const zBans = z.object({ bans: z.array(zBan) });

export const zTemplate = z.object({
  id: z.string(),
  categories: z.array(
    z.object({ name: z.string(), channels: z.array(z.object({ name: z.string(), voice: z.boolean().default(false), format: z.string().default("text"), kind: z.string().default("PUBLIC") })) }),
  ),
});
export type CommunityTemplate = z.infer<typeof zTemplate>;
export const zTemplates = z.object({ templates: z.array(zTemplate) });

export const zSecurity = z.object({ invitesPausedUntil: nullableNumber, dmsPausedUntil: nullableNumber, activityAlerts: z.boolean().default(true) });
export type SecurityState = z.infer<typeof zSecurity>;

export const zApplication = z.object({
  id: z.string(),
  orgId: z.string(),
  user: z.object({ id: z.string(), username: nullableString, displayName: nullableString }),
  questions: z.array(z.string()).default([]),
  answers: z.array(z.string()).default([]),
  status: zApplicationStatus,
  createdAt: z.number(),
  handledAt: nullableNumber,
  handledByName: nullableString,
  note: nullableString,
});
export type JoinApplication = z.infer<typeof zApplication>;
export const zApplications = z.object({ applications: z.array(zApplication), pending: z.number().int().default(0) });
export const zApplicationOut = z.object({ application: zApplication, repeated: z.boolean().optional() });

export const zChannelList = z.object({ channels: z.array(zConversation) });
export const zLayoutResult = z.object({ ok: z.boolean(), removed: z.number().int().default(0), categories: z.array(zCategory).default([]) });
