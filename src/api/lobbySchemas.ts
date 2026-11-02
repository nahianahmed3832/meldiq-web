import { z } from "zod";

/**
 * The community lobby's answers (community parity B, feature "community-lobby"; server contracts
 * communityLobby.ts and communityLobbyView.ts, docs/COMMUNITY_PARITY_API.md › Lobby). Validated at the boundary like every
 * other answer: a look value or section this version doesn't know falls back to a default instead of failing the page.
 */

export const LOBBY_SECTION_KEYS = ["about", "main_channels", "live_now", "giveaways", "feed", "faq", "leaderboard", "pick_roles", "rules", "who_runs_it", "links"] as const;
export type LobbySectionKey = (typeof LOBBY_SECTION_KEYS)[number];
export const LOBBY_BOARDS = ["levels", "messages_week", "invites"] as const;
export type LobbyBoard = (typeof LOBBY_BOARDS)[number];
export const LOBBY_TEMPLATES = ["gaming", "study", "creators", "hangout", "minimal"] as const;
export type LobbyTemplateKey = (typeof LOBBY_TEMPLATES)[number];

export const LOBBY_LAYOUTS = ["classic", "spotlight", "magazine", "compact"] as const;
export const LOBBY_BACKGROUNDS = ["glow", "mesh", "banner_blur", "plain"] as const;
export const LOBBY_CARD_STYLES = ["filled", "glass", "outline"] as const;
export const LOBBY_FONTS = ["default", "rounded", "serif", "mono", "display"] as const;
export const LOBBY_BANNER_HEIGHTS = ["tall", "normal", "short"] as const;
export const LOBBY_TITLES = ["left", "centered"] as const;

/** The server's limits (LOBBY_LIMITS); the server checks them again. */
export const LOBBY_LIMITS = { tagline: 120, buttons: 4, buttonLabel: 40, url: 500, about: 2000, mainChannels: 6, faq: 10, question: 200, answer: 1000 } as const;

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const nullableNumber = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

export const zLobbyLook = z.object({
  layout: z.enum(LOBBY_LAYOUTS).catch("classic"),
  accent: z
    .string()
    .regex(/^(auto|#[0-9a-fA-F]{6})$/)
    .transform((v) => v.toLowerCase())
    .catch("auto"),
  background: z.enum(LOBBY_BACKGROUNDS).catch("glow"),
  cards: z.enum(LOBBY_CARD_STYLES).catch("filled"),
  font: z.enum(LOBBY_FONTS).catch("default"),
  bannerHeight: z.enum(LOBBY_BANNER_HEIGHTS).catch("normal"),
  title: z.enum(LOBBY_TITLES).catch("left"),
});
export type LobbyLook = z.infer<typeof zLobbyLook>;

export const zLobbySection = z.object({ key: z.string(), shown: z.boolean(), column: z.enum(["main", "side"]).catch("main") });
export type LobbySection = { key: LobbySectionKey; shown: boolean; column: "main" | "side" };

export const zLobbyButton = z.object({ label: z.string(), url: nullableString, channelId: nullableString });
export type LobbyButton = z.infer<typeof zLobbyButton>;
export const zLobbyFaqItem = z.object({ id: z.string(), question: z.string(), answer: z.string() });
export type LobbyFaqItem = z.infer<typeof zLobbyFaqItem>;

/** Sections this version knows, each once; unknown ones dropped (a newer server's card can't be drawn here). */
const knownSections = (list: z.infer<typeof zLobbySection>[]): LobbySection[] => {
  const seen = new Set<string>();
  return list.filter((s): s is LobbySection => (LOBBY_SECTION_KEYS as readonly string[]).includes(s.key) && !seen.has(s.key) && !!seen.add(s.key));
};

export const zLobbySettings = z.object({
  enabled: z.boolean(),
  tagline: nullableString,
  buttons: z.array(zLobbyButton).default([]),
  about: nullableString,
  mainChannelIds: z.array(z.string()).default([]),
  faq: z.array(zLobbyFaqItem).default([]),
  showWhoRunsIt: z.boolean().default(true),
  look: zLobbyLook,
  sections: z.array(zLobbySection).transform(knownSections),
  leaderboards: z
    .array(z.string())
    .default([])
    .transform((list) => list.filter((b): b is LobbyBoard => (LOBBY_BOARDS as readonly string[]).includes(b))),
});
export type LobbySettings = z.infer<typeof zLobbySettings>;

export const zLobbyFeedInfo = z.object({ createdAt: z.number(), lastPostAt: nullableNumber });
export type LobbyFeedInfo = z.infer<typeof zLobbyFeedInfo>;

export const zLobbySettingsView = z.object({
  settings: zLobbySettings,
  rev: z.number().int().nonnegative(),
  updatedAt: nullableNumber,
  canEdit: z.boolean(),
  feed: zLobbyFeedInfo.nullish().transform((v) => v ?? null),
});
export type LobbySettingsView = z.infer<typeof zLobbySettingsView>;

export const zLobbyFeedCreated = z.object({ token: z.string().min(10), feed: zLobbyFeedInfo });
export const zLobbyFeedDeleted = z.object({ feed: z.null() });
export const zLobbySeen = z.object({ seen: z.literal(true), seenAt: z.number() });

export const zLobbyPerson = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.number().default(0),
  photoRev: nullableNumber,
});
export type LobbyPerson = z.infer<typeof zLobbyPerson>;

export const zLobbyCommunity = z.object({
  id: z.string(),
  name: z.string(),
  photoRev: nullableNumber,
  bannerRev: nullableNumber,
  accent: nullableString,
  memberCount: z.number().int().nonnegative(),
  onlineCount: z.number().int().nonnegative().default(0),
});
export type LobbyCommunity = z.infer<typeof zLobbyCommunity>;

export const zLobbyChannel = z.object({
  id: z.string(),
  name: nullableString,
  kind: nullableString,
  voice: z.boolean().default(false),
  format: z.enum(["text", "forum"]).catch("text"),
  lastActiveAt: nullableNumber,
});
export type LobbyChannel = z.infer<typeof zLobbyChannel>;

export const zLobbyStaff = z.object({ user: zLobbyPerson, badge: z.enum(["owner", "admin", "mod"]).catch("mod") });
export type LobbyStaff = z.infer<typeof zLobbyStaff>;

export const zLobbyLiveRoom = z.object({
  channelId: z.string(),
  name: nullableString,
  callId: z.string(),
  startedAt: z.number(),
  participantCount: z.number().int().nonnegative(),
  participants: z.array(zLobbyPerson).default([]),
});
export type LobbyLiveRoom = z.infer<typeof zLobbyLiveRoom>;

const zPickRole = z.object({ id: z.string(), name: z.string(), color: nullableString });
const zPickOption = z.object({ id: z.string(), title: z.string(), emoji: nullableString, roles: z.array(zPickRole).default([]) });
const zPickPrompt = z.object({ id: z.string(), title: z.string(), single: z.boolean().default(false), options: z.array(zPickOption) });
export type LobbyPickPrompt = z.infer<typeof zPickPrompt>;
export const zLobbyPickRoles = z.object({ prompts: z.array(zPickPrompt).default([]), answered: z.array(z.string()).default([]) });
export type LobbyPickRoles = z.infer<typeof zLobbyPickRoles>;

export const zLobbyLeaderboard = z.object({
  board: z.string(),
  entries: z.array(z.object({ rank: z.number().int().positive(), user: zLobbyPerson, count: z.number().int().nonnegative() })),
});
export type LobbyLeaderboard = z.infer<typeof zLobbyLeaderboard>;

export const zLobbyGiveaway = z.object({ id: z.string(), title: z.string(), endsAt: z.number(), entrants: z.number().int().nonnegative() });
export type LobbyGiveaway = z.infer<typeof zLobbyGiveaway>;

export const zLobbyFeedPost = z.object({ id: z.string(), title: nullableString, text: nullableString, url: nullableString, image: nullableString, postedAt: z.number() });
export type LobbyFeedPost = z.infer<typeof zLobbyFeedPost>;

export const zLobbyView = z.object({
  community: zLobbyCommunity,
  settings: zLobbySettings,
  rev: z.number().int().nonnegative(),
  canEdit: z.boolean(),
  seen: z.boolean(),
  seenAt: nullableNumber,
  mainChannels: z.array(zLobbyChannel).default([]),
  mainChannelsPicked: z.boolean().default(false),
  whoRunsIt: z.array(zLobbyStaff).default([]),
  liveNow: z.array(zLobbyLiveRoom).default([]),
  rules: z
    .object({ channelId: z.string() })
    .nullish()
    .transform((v) => v ?? null),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  pickRoles: zLobbyPickRoles.default({ prompts: [], answered: [] }),
  leaderboards: z.array(zLobbyLeaderboard).default([]),
  giveaways: z.array(zLobbyGiveaway).default([]),
  feed: z.array(zLobbyFeedPost).default([]),
});
export type LobbyView = z.infer<typeof zLobbyView>;
