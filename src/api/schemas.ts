import { z } from "zod";

/**
 * The parts of the server's responses this client uses (server/src/routes). Validated at the boundary; unknown fields are
 * dropped, so newer servers' additions never break the client.
 */

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

export const zMember = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.number().int().default(0),
  statusText: nullableString,
  photoRev: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  homeServer: nullableString,
  role: nullableString,
  orgRole: nullableString,
  online: z
    .boolean()
    .nullish()
    .transform((v) => v ?? null),
});
export type Member = z.infer<typeof zMember>;

export const zConversationType = z.enum(["DM", "GROUP", "CHANNEL"]);
export type ConversationType = z.infer<typeof zConversationType>;

export const zConversation = z.object({
  id: z.string(),
  type: zConversationType,
  orgId: nullableString,
  scope: nullableString,
  scopeId: nullableString,
  scopeName: nullableString,
  kind: nullableString,
  name: nullableString,
  topic: nullableString,
  archived: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  memberCount: z.number().int(),
  members: z.array(zMember).optional(),
  joined: z.boolean(),
  myRole: nullableString,
  canPost: z.boolean(),
  canManage: z.boolean(),
  /** Whether this person may change the channel's access mode (its workspace, branch or team managers). */
  canManageAccess: z.boolean().default(false),
  canMentionAll: z.boolean().default(false),
  activeCall: z
    .object({ id: z.string(), video: z.boolean(), state: z.string(), startedAt: z.number() })
    .nullish()
    .transform((v) => v ?? null),
});
export type Conversation = z.infer<typeof zConversation>;

export const zOrg = z.object({
  id: z.string(),
  name: z.string(),
  slug: nullableString,
  description: nullableString,
  myRole: nullableString,
  memberCount: z.number().int(),
  createdAt: z.number(),
  /** The workspace photo's revision (GET /v1/orgs/:id/photo), null without one. */
  photoRev: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
});
export type Org = z.infer<typeof zOrg>;

export const zOrgDetail = z.object({
  org: zOrg,
  branches: z.array(z.object({ id: z.string(), name: z.string(), canAccess: z.boolean(), memberCount: z.number() })),
  teams: z.array(z.object({ id: z.string(), name: z.string(), branchId: nullableString, canAccess: z.boolean(), memberCount: z.number() })),
  stats: z.object({ members: z.number(), teams: z.number(), channels: z.number(), branches: z.number() }),
  permissions: z.object({ canManageOrg: z.boolean(), canInvite: z.boolean(), canCreateChannels: z.boolean(), canViewDirectory: z.boolean(), isOwner: z.boolean() }),
});
export type OrgDetail = z.infer<typeof zOrgDetail>;

export const zActivity = z.object({
  id: z.number(),
  at: z.number(),
  action: z.string(),
  actorId: nullableString,
  actorName: nullableString,
  target: nullableString,
  detail: nullableString,
});
export type Activity = z.infer<typeof zActivity>;

export const zProfile = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.number().int().default(0),
  statusText: nullableString,
  firstName: nullableString,
  lastName: nullableString,
  photoRev: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  identityKey: z.string(),
  fingerprint: z.string(),
  online: z
    .boolean()
    .nullish()
    .transform((v) => v ?? null),
  lastSeenAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
});
export type Profile = z.infer<typeof zProfile>;

export const zDevice = z.object({
  id: z.string(),
  name: z.string(),
  signingKey: z.string(),
  createdAt: z.number(),
  lastSeenAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  revokedAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  current: z.boolean(),
});
export type Device = z.infer<typeof zDevice>;

export const zDeviceKeys = z.object({ id: z.string(), signingKey: z.string(), encryptionKey: z.string(), certificate: z.string() });
export const zUserKeys = z.object({ userId: z.string(), identityKey: z.string(), devices: z.array(zDeviceKeys) });
export type UserKeys = z.infer<typeof zUserKeys>;

export const zSession = z.object({ userId: z.string(), deviceId: z.string(), sessionToken: z.string(), expiresAt: z.number() });
export type SessionGrant = z.infer<typeof zSession>;

export const zPairingStart = z.object({ pairingId: z.string(), code: z.string(), expiresAt: z.number() });
export const zPairingPoll = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("approved"), username: z.string(), identityKey: z.string(), certificate: z.string(), sealedIdentity: z.string(), sealedEnc: z.string() }),
]);

/** One delivery-queue item (server hub.ts queueItemToWire). */
export const zQueueItem = z.object({
  id: z.number().int(),
  kind: z.enum(["envelope", "receipt"]),
  conversationId: z.string(),
  messageId: z.string(),
  senderUserId: z.string(),
  senderDeviceId: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  payload: z.object({
    cls: z.enum(["message", "control"]).optional(),
    sentAt: z.number().optional(),
    serverTs: z.number().optional(),
    nonce: z.string().optional(),
    ciphertext: z.string().optional(),
    signature: z.string().optional(),
    enc: z.string().optional(),
    wrappedKey: z.string().optional(),
    mentionAll: z.boolean().optional(),
    status: z.string().optional(),
    at: z.number().optional(),
  }),
});
export type QueueItem = z.infer<typeof zQueueItem>;

export const zHistoryPage = z.object({
  items: z.array(z.object({ tag: z.string(), conv: z.string(), seq: z.number(), ts: z.number(), body: z.string().nullable() })),
  next: z.number(),
  more: z.boolean(),
});

export const zCall = z.object({
  id: z.string(),
  conversationId: z.string(),
  createdBy: z.string(),
  video: z.boolean(),
  state: z.string(),
  createdAt: z.number(),
  endedAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  endReason: nullableString,
  /** "DM", "GROUP" or "CHANNEL" (server 0.2.0 and later). */
  conversationType: nullableString.optional(),
  alertedAt: z.number().nullish().optional(),
  /** Devices connected to the call's media right now. */
  participants: z
    .array(z.object({ userId: z.string(), deviceId: z.string() }))
    .max(500)
    .optional(),
  /** When two different people were connected (null: never answered). */
  answeredAt: z.number().nullish().optional(),
  /** Ended calls: who connected and for how long (servers from 2026-10-17; older ones leave it out). */
  attended: z
    .array(z.object({ userId: z.string(), seconds: z.number() }))
    .max(500)
    .optional(),
});
export type Call = z.infer<typeof zCall>;

/** What `POST /v1/calls` and `POST /v1/calls/:id/join` return: the call and a room-scoped media pass. */
export const zCallGrant = z.object({
  call: zCall,
  media: z.object({ url: z.string().max(2048), token: z.string().max(8192), room: z.string().max(128) }),
  joinedExisting: z.boolean().optional(),
});
export const zCallList = z.object({ calls: z.array(zCall).max(500) });
export const zCallRes = z.object({ call: zCall });

export const zServerInfo = z.object({
  version: z.string(),
  api: z.number(),
  minClientApi: z.number(),
  instanceName: nullableString,
  registration: z.string(),
  calling: z.boolean(),
  attachmentMaxBytes: z.number(),
  /** Orbit 2.0: the largest file a person may send (bytes of the file itself). Older servers: attachmentMaxBytes. */
  fileMaxBytes: z.number().optional(),
  /** Orbit 2.0 accounts; absent on servers before them. */
  accounts: z
    .object({
      registration: z.boolean(),
      legacyLogin: z.boolean(),
      legacyRegistration: z.boolean(),
      legacyMigration: z.boolean(),
      legacyMigrationRequired: z.boolean().default(false),
    })
    .optional(),
  features: z.array(z.string()).default([]),
});
export type ServerInfo = z.infer<typeof zServerInfo>;

export const CLIENT_API = 1;
