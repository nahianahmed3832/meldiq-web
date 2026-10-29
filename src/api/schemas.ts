import { z } from "zod";
import { openEnum } from "./enums";
import { zAboutMe, zAccent, zAvatarMedia, zBadges, zMojoMark, zProfileBanner, zProfileLinks, zProfileStyle, zWornTag } from "./profileSchemas";

export * from "./profileSchemas";

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
  /** Round 3 (servers with status-expiry): the status emoji; and whether they paused notifications, when their last-seen setting lets you see it. */
  statusEmoji: nullableString,
  notificationsPaused: z
    .boolean()
    .nullish()
    .transform((v) => v ?? null),
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
  /** Batch B6b: online, idle, do not disturb or offline, where their last-seen setting lets you see it. */
  presence: z
    .enum(["online", "idle", "dnd", "offline"])
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  /** Batch B12: pronouns, under the same privacy setting as the bio. */
  pronouns: nullableString,
  /** API 0.46.0: lists carry the animated avatar, the profile and name style, and the worn community tag. */
  avatarMedia: zAvatarMedia,
  profileStyle: zProfileStyle,
  tag: zWornTag,
  /** API 0.54.0: the Mojo badge they show (server docs/MOJO.md). */
  mojo: zMojoMark.optional(),
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
    .object({
      id: z.string(),
      video: z.boolean(),
      state: z.string(),
      startedAt: z.number(),
      /** Voice rooms: who is in the room's call now (at most 12, docs/VOICE_ROOMS.md). */
      participantIds: z.array(z.string()).max(12).default([]),
    })
    .nullish()
    .transform((v) => v ?? null),
  /** A voice room (API 0.7+): a channel whose call anyone in it can drop into, without ringing. */
  voice: z.boolean().default(false),
  // ── Communities (API 0.12+, docs/COMMUNITY_REBUILD_2026-10-21.md); older servers leave these out. ──
  /** The channel's category (null: none) and its place in it. */
  categoryId: nullableString,
  categoryName: nullableString,
  /** The category's place among the community's categories (API 0.48.0): the order before the category list loads. */
  categoryPosition: z
    .number()
    .int()
    .nullish()
    .transform((v) => v ?? null),
  position: z.number().int().default(0),
  /** "text", or "forum": posts with a title, each with its replies in a thread. */
  format: openEnum(["text", "forum"]).default("text"),
  forumTags: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .max(50)
    .default([]),
  /** Batch B8: a forum's post guidelines. */
  guidelines: nullableString,
  /** Batch B6b: a group's photo revision (GET /v1/conversations/:id/photo). */
  photoRev: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** Whether this person may share files here (a channel can take it away); older servers: whenever they may post. */
  canAttach: z.boolean().optional(),
  /** While this person is timed out in the community: when it ends. */
  timedOutUntil: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** Batch B3: slowmode seconds, whether it applies to this person, and when they may post next (null: now). */
  slowmodeSec: z.number().int().default(0),
  slowmodeExempt: z.boolean().default(false),
  nextPostAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** Voice channels: whether this person may join the call, and speak in it (listen-only otherwise). */
  canConnect: z.boolean().optional(),
  canSpeak: z.boolean().optional(),
  /** Batch B6: a message request (DMs): waiting for you ([incoming]), or yours waiting for them with how many you sent. */
  request: z
    .object({ state: z.string(), incoming: z.boolean(), sent: z.number().int().optional(), limit: z.number().int().default(3) })
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
  /** API 0.44.0: the community's accent ("#rrggbb") and banner revision; anything else (or older servers) means Meldiq's theme. */
  accent: zAccent,
  bannerRev: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** API 0.46.0: the tag members may wear by their names (2–4 capitals or digits); null without one or on older servers. */
  tag: z
    .string()
    .regex(/^[A-Z0-9]{2,4}$/)
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  /** Round 7 guest policy (docs/WORKSPACE_C5.md); older servers allow guests without a limit. */
  guestsAllowed: z.boolean().default(true),
  guestMaxDays: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** Meldiq 2.0 (docs/product/MELDIQ_2_DECISIONS.md): a team or a community; older servers send nothing (a team). */
  kind: openEnum(["team", "community"]).default("team"),
  // ── Communities (API 0.12+); older servers leave these out. ──
  /** Listed in Discover, and whether anyone may join from there or only with an invitation. */
  visibility: openEnum(["private", "public"]).default("private"),
  joinPolicy: openEnum(["invite", "open"]).default("invite"),
  rules: nullableString,
  /** Batch B4 Security actions: until when joining, and new DMs between members, are paused (null: not paused). */
  invitesPausedUntil: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  dmsPausedUntil: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** Batch B4b: the join questions (null: applications off), activity alerts on or off, and a recent alert (moderators). */
  joinQuestions: z
    .array(z.string())
    .max(10)
    .nullish()
    .transform((v) => v ?? null),
  activityAlerts: z.boolean().default(true),
  activityAlert: z
    .object({ count: z.number().int(), at: z.number() })
    .passthrough()
    .nullish()
    .transform((v) => v ?? null),
  /** Batch B8b: the community guide (members only) and whether onboarding questions are on. */
  guide: z
    .object({
      welcome: nullableString,
      tasks: z.array(z.object({ id: z.string().optional(), title: z.string(), channelId: nullableString })).default([]),
      resources: z.array(z.object({ id: z.string().optional(), title: z.string(), channelId: nullableString, description: nullableString.optional() })).default([]),
    })
    .passthrough()
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  onboarding: z.boolean().default(false),
});
export type Org = z.infer<typeof zOrg>;
export type OrgKind = Org["kind"];

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
  /** API 0.45.0: an animated avatar, a banner and a style (absent on older servers or when not shown to you). */
  avatarMedia: zAvatarMedia,
  profileBanner: zProfileBanner,
  profileStyle: zProfileStyle,
  /** API 0.46.0: the community tag they wear by their name, About me, links and badges. */
  tag: zWornTag,
  mojo: zMojoMark.optional(),
  aboutMe: zAboutMe,
  links: zProfileLinks,
  badges: zBadges,
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.number().int().default(0),
  statusText: nullableString,
  /** Round 3: the status emoji and when it ends; your own profile also says until when notifications are paused. */
  statusEmoji: nullableString,
  statusExpiresAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  notificationsPausedUntil: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
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
  presence: z
    .enum(["online", "idle", "dnd", "offline"])
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  pronouns: nullableString,
  /** Your own profile: your presence choice and until when (batch B6b). */
  presenceMode: openEnum(["auto", "idle", "dnd", "invisible"])
    .nullish()
    .transform((v) => v ?? null),
  presenceUntil: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  /** API 0.57.0: when they joined Meldiq (the profile's "Member since"). */
  memberSince: z.number().nullish(),
  /** API 0.57.0: communities you're both in, with when they joined each. */
  mutualCommunities: z
    .array(z.object({ id: z.string(), name: z.string(), photoRev: z.number().nullable(), joinedAt: z.number() }))
    .max(200)
    .nullish()
    .transform((v) => v ?? []),
  /** API 0.60.0: they have a profile decoration approved (the Artist badge). */
  decorationArtist: z
    .boolean()
    .nullish()
    .transform((v) => v === true),
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
/** A device removed from its account: never encrypted to; envelopes the server accepted up to `revokedAt` verify (T1.5). */
export const zRevokedDeviceKeys = zDeviceKeys.extend({ revokedAt: z.number() });
export const zUserKeys = z.object({
  userId: z.string(),
  identityKey: z.string(),
  devices: z.array(zDeviceKeys),
  /** Servers with the T1.5 fix list devices revoked within the queue lifetime; older ones omit it. */
  revokedDevices: z.array(zRevokedDeviceKeys).default([]),
});
export type UserKeys = z.infer<typeof zUserKeys>;

export const zSession = z.object({ userId: z.string(), deviceId: z.string(), sessionToken: z.string(), expiresAt: z.number() });
export type SessionGrant = z.infer<typeof zSession>;

export const zPairingStart = z.object({ pairingId: z.string(), code: z.string(), expiresAt: z.number() });
export const zPairingPoll = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("approved"), username: z.string(), identityKey: z.string(), certificate: z.string(), sealedIdentity: z.string(), sealedEnc: z.string() }),
]);

/**
 * A message or a change to one as the server stores and serves it (API 0.57.0, server docs/SERVER_MESSAGES.md): in
 * history pages, search results, and the delivery queue's "message" items. Readable: nothing to decrypt.
 */
export const zStoredEvent = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderUserId: z.string(),
  senderDeviceId: z.string().nullable(),
  cls: z.enum(["message", "control"]),
  payload: z.record(z.string(), z.unknown()),
  sentAt: z.number(),
  serverTs: z.number(),
  mentionAll: z.boolean(),
  importedBy: z.string().nullable().default(null),
});
export type StoredEvent = z.infer<typeof zStoredEvent>;

export const zServerHistoryPage = z.object({ messages: z.array(zStoredEvent), changes: z.array(zStoredEvent), more: z.boolean() });
export type ServerHistoryPage = z.infer<typeof zServerHistoryPage>;

/** One delivery-queue item (server hub.ts queueItemToWire). */
export const zQueueItem = z.object({
  id: z.number().int(),
  kind: z.enum(["envelope", "receipt", "message"]),
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
    /** A "message" item: the stored message or change itself. */
    event: zStoredEvent.optional(),
  }),
});
export type QueueItem = z.infer<typeof zQueueItem>;

/**
 * What identifies a queue item even when the rest doesn't parse (a newer item kind or payload): enough to keep a
 * placeholder in its conversation instead of dropping it (docs/api/README.md › Rules for clients).
 */
export const zQueueItemIdentity = z.object({
  id: z.number().int(),
  kind: z.string(),
  conversationId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(128),
  senderUserId: z.string().min(1).max(128),
  senderDeviceId: z.string().max(128).catch(""),
  createdAt: z.number().catch(() => Date.now()),
  expiresAt: z.number().catch(0),
});

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
  /** A voice room's call: nobody rings, people raise hands, the room's managers moderate (API 0.7+). */
  voiceRoom: z.boolean().default(false),
  /** Voice rooms: who raised a hand, in order. */
  hands: z.array(z.string()).max(500).default([]),
  /** Live calls: people sharing their screen now, from the media server (servers from 2026-10-26 send it). */
  sharing: z.array(z.string()).max(500).default([]),
});
export type Call = z.infer<typeof zCall>;

/** What `POST /v1/calls` and `POST /v1/calls/:id/join` return: the call and a room-scoped media pass. */
export const zCallGrant = z.object({
  call: zCall,
  media: z.object({
    url: z.string().max(2048),
    token: z.string().max(8192),
    room: z.string().max(128),
    /** API 0.54.0 (Meldiq Mojo): screen-share ceilings and the voice bitrate ceiling for this person here. */
    limits: z.object({ screen: z.array(z.object({ id: z.string(), width: z.number(), height: z.number(), fps: z.number() })).max(10), voiceKbps: z.number().int().min(8).max(510) }).nullish(),
  }),
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
  /** Federation with other servers (@name:domain addresses); null when this server doesn't federate. */
  federation: z.object({ domain: z.string() }).nullable().optional(),
  /** Passkeys (API 0.30.0, server docs/PASSKEYS.md): the web origins that are relying parties of their own; null when off. */
  passkeys: z
    .object({ webOrigins: z.array(z.string()) })
    .nullable()
    .optional(),
});
export type ServerInfo = z.infer<typeof zServerInfo>;

export const CLIENT_API = 1;
