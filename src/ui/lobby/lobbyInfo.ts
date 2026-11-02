import type { LobbyBoard, LobbyLook, LobbySectionKey, LobbyTemplateKey } from "../../api/lobbySchemas";
import type { WorkspacePage } from "../../application/router";

/** The lobby's words and choices, in Meldiq's own voice (docs/MELDIQ_COMMUNITY_PARITY.md › Lobby live editor). */

/** What an empty card offers an editor: fill it in here ("card"), set it up elsewhere ("page"), or the feed URL. */
export type CardAction = { kind: "card" } | { kind: "page"; page: WorkspacePage } | { kind: "feed" };

export interface SectionInfo {
  label: string;
  /** Shown to editors while the card is empty or quiet. */
  empty: string;
  cta: string | null;
  action: CardAction | null;
}

export const SECTION_INFO: Record<LobbySectionKey, SectionInfo> = {
  about: { label: "About", empty: "Tell newcomers what this place is about.", cta: "Write it", action: { kind: "card" } },
  main_channels: { label: "Main channels", empty: "Pick the channels people should open first. Until then, the busiest ones show.", cta: "Pick channels", action: { kind: "card" } },
  live_now: { label: "Live now", empty: "Voice rooms with people in them show here.", cta: null, action: null },
  giveaways: { label: "Giveaways", empty: "Running giveaways show here once a giveaway bot is running.", cta: "Open Bots", action: { kind: "page", page: "bots" } },
  feed: { label: "Feed", empty: "Posts that your apps send to the lobby's feed URL show here.", cta: "Get a feed URL", action: { kind: "feed" } },
  faq: { label: "FAQ", empty: "Answer what newcomers ask most.", cta: "Add questions", action: { kind: "card" } },
  leaderboard: { label: "Leaderboard", empty: "The most active people show here once there's activity.", cta: null, action: null },
  pick_roles: { label: "Pick your roles", empty: "Let people pick roles from your onboarding questions.", cta: "Set up onboarding", action: { kind: "page", page: "onboarding" } },
  rules: { label: "Rules", empty: "Point people to your rules channel.", cta: "Pick a rules channel", action: { kind: "page", page: "rules" } },
  who_runs_it: { label: "Who runs it", empty: "The owner and moderators show here.", cta: null, action: null },
  links: { label: "Links", empty: "Your community's links show here.", cta: "Add links", action: { kind: "page", page: "overview" } },
};

export const BOARD_LABELS: Record<LobbyBoard, string> = { levels: "Levels", messages_week: "Messages this week", invites: "Invites" };

export interface TemplateInfo {
  key: LobbyTemplateKey;
  name: string;
  blurb: string;
  /** The thumbnail's colour bars, top to bottom. */
  bars: string[];
}

export const TEMPLATES: readonly TemplateInfo[] = [
  { key: "gaming", name: "Gaming", blurb: "Live rooms up top, leaderboards on the side.", bars: ["#8b5cf6", "#22d3ee", "#6d28d9", "#a78bfa"] },
  { key: "study", name: "Study", blurb: "Calm and easy to read, one column.", bars: ["#4f7cac", "#cbd5e1", "#94a3b8", "#e2e8f0"] },
  { key: "creators", name: "Creators", blurb: "A big banner, your feed and links first.", bars: ["#ec4899", "#f9a8d4", "#be185d", "#fbcfe8"] },
  { key: "hangout", name: "Hangout", blurb: "Warm colours, friendly and relaxed.", bars: ["#f59e0b", "#fdba74", "#ea580c", "#fde68a"] },
  { key: "minimal", name: "Minimal", blurb: "Just the essentials, nothing extra.", bars: ["#64748b", "#cbd5e1", "#94a3b8", "#e5e7eb"] },
];

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export const LAYOUTS: readonly (Choice<LobbyLook["layout"]> & { hint: string })[] = [
  { value: "classic", label: "Classic", hint: "Two columns" },
  { value: "spotlight", label: "Spotlight", hint: "One centred column" },
  { value: "magazine", label: "Magazine", hint: "Big hero, big tiles" },
  { value: "compact", label: "Compact", hint: "Dense list" },
];
export const BACKGROUNDS: readonly Choice<LobbyLook["background"]>[] = [
  { value: "glow", label: "Glow" },
  { value: "mesh", label: "Mesh" },
  { value: "banner_blur", label: "Banner blur" },
  { value: "plain", label: "Plain" },
];
export const CARD_STYLES: readonly Choice<LobbyLook["cards"]>[] = [
  { value: "filled", label: "Filled" },
  { value: "glass", label: "Glass" },
  { value: "outline", label: "Outline" },
];
export const FONTS: readonly Choice<LobbyLook["font"]>[] = [
  { value: "default", label: "Default" },
  { value: "rounded", label: "Rounded" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "display", label: "Display" },
];
export const BANNER_HEIGHTS: readonly Choice<LobbyLook["bannerHeight"]>[] = [
  { value: "tall", label: "Tall" },
  { value: "normal", label: "Normal" },
  { value: "short", label: "Short" },
];
export const TITLES: readonly Choice<LobbyLook["title"]>[] = [
  { value: "left", label: "Left" },
  { value: "centered", label: "Centred" },
];
