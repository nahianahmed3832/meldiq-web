import type { BotCategory, CardLabel, DiscoverCard, UnlistedReason } from "../../api/discoverySchemas";
import { meldiqPath, webOrigin } from "../webOrigin";

/**
 * Discovery's rules on the web (community parity batch E; docs/MELDIQ_COMMUNITY_PARITY.md §1 Server Profile, Promote,
 * Bots; server docs/COMMUNITY_PARITY_API.md › Discovery): the server's feature names and limits, what a card's label
 * and a community's listing state say, topic tags as typed, prices, template links and the bot directory's choices.
 */

/** The server's feature names for batch E (GET /v1/server-info features). */
export const DISCOVERY_FEATURES = {
  /** GET /v1/discover (Promoted row, tags, labels), clicks, and each community's Discovery settings. */
  listing: "discovery-listing",
  /** The Promote page: boosts and the Promoted row. */
  promote: "discovery-promote",
  /** Templates made from a community, their links, and creating a community from one. */
  templates: "template-links",
  /** The community bot directory and a bot owner's listing. */
  botDirectory: "bot-directory",
} as const;

/** minMembers: a public community is listed from this many members (unless boosted or promoted). */
export const DISCOVERY_LIMITS = { minMembers: 5, description: 300, tags: 5, tag: 24, query: 60, botDescription: 200 } as const;

/** A topic tag: letters and digits, with spaces or single hyphens between them (as the server checks). */
const TAG = /^[\p{L}\p{N}]+(?:(?: +|-)[\p{L}\p{N}]+)*$/u;

export type TagsInput = { tags: string[] } | { problem: string };

/** Tags typed comma-separated: cleaned (single spaces, lower case, repeats dropped), or what's wrong with them. */
export function parseTags(text: string): TagsInput {
  const raw = text
    .split(",")
    .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean);
  const tags = [...new Set(raw)];
  if (tags.length > DISCOVERY_LIMITS.tags) return { problem: `Up to ${DISCOVERY_LIMITS.tags} tags.` };
  const long = tags.find((t) => [...t].length > DISCOVERY_LIMITS.tag);
  if (long) return { problem: `"${long.slice(0, 30)}" is too long: keep each tag to ${DISCOVERY_LIMITS.tag} characters.` };
  const bad = tags.find((t) => !TAG.test(t));
  if (bad) return { problem: `"${bad.slice(0, 30)}": tags use letters, digits, spaces and hyphens.` };
  return { tags };
}

/** The text a card's label shows, or null (no label). An unknown label shows nothing rather than guessing. */
export function cardLabelText(label: CardLabel): string | null {
  switch (label) {
    case "promoted":
      return "PROMOTED";
    case "mega":
      return "MEGA BOOSTED";
    case "super":
      return "SUPER BOOSTED";
    case "boost":
      return "BOOSTED";
    default:
      return null;
  }
}

/** Mega's label is gold; the Promoted tag has its own colour; the others are plain. */
export function cardLabelTone(label: CardLabel): "gold" | "promoted" | "plain" | null {
  if (label === "mega") return "gold";
  if (label === "promoted") return "promoted";
  return label === "boost" || label === "super" ? "plain" : null;
}

/** A further page appended to what's shown, without repeating a community (the list can shift between pages). */
export function appendPage(shown: readonly DiscoverCard[], page: readonly DiscoverCard[]): DiscoverCard[] {
  const ids = new Set(shown.map((c) => c.id));
  return [...shown, ...page.filter((c) => !ids.has(c.id))];
}

/** Why a community isn't in Discovery, in a sentence; null when it is. */
export function unlistedText(reason: UnlistedReason, memberCount: number, minMembers: number): string | null {
  switch (reason) {
    case null:
      return null;
    case "private":
      return "It's private: make it public (Who can find it, below) to be listed.";
    case "turned_off":
      return "Turned off: it won't show in Discover.";
    case "too_few_members": {
      const left = Math.max(minMembers - memberCount, 1);
      return `Listed once it has ${minMembers} members (${left} more to go).`;
    }
    case "locked":
      return "Locked right now: it shows again when the lock ends.";
    case "removed":
      return "Meldiq took it out of Discover. Contact support if you think that's a mistake.";
    case "name_blocked":
      return "Its name looks like Meldiq's own (official, staff, Meldiq…), so it isn't listed.";
    default:
      return "Not listed right now.";
  }
}

// ───────────── template links ─────────────

/** A template's code as links carry it: 12 letters and digits (any case; the server reads any case). */
const TEMPLATE_CODE = /^[A-Za-z0-9]{6,32}$/;

/** The share link for a template, on the address this app is served from. */
export const templateLink = (code: string): string => `${webOrigin()}/template/${code}`;

/** The path of a template link: /template/<code>. */
export const TEMPLATE_PATH = /^\/template\/([A-Za-z0-9]{6,32})\/?$/;

/** The code in a pasted template link or a bare code, or null for anything else. */
export function templateFromText(text: string): string | null {
  const trimmed = text.trim();
  if (TEMPLATE_CODE.test(trimmed)) return trimmed.toUpperCase();
  const path = meldiqPath(trimmed);
  const m = path ? TEMPLATE_PATH.exec(path) : null;
  return m ? m[1].toUpperCase() : null;
}

// ───────────── bot directory ─────────────

export const BOT_CATEGORY_TEXT: Record<BotCategory, string> = {
  moderation: "Moderation",
  fun: "Fun",
  games: "Games",
  utility: "Utility",
  music: "Music",
  economy: "Economy",
  social: "Social",
  ai: "AI",
  other: "Other",
};

/** The directory's chips in the reference's order: Most used (no category, most used first), All, then each category. */
export type BotChip = "most_used" | "all" | BotCategory;
export const BOT_CHIPS: readonly { chip: BotChip; label: string }[] = [
  { chip: "most_used", label: "Most used" },
  { chip: "all", label: "All" },
  ...(Object.entries(BOT_CATEGORY_TEXT) as [BotCategory, string][]).map(([chip, label]) => ({ chip, label })),
];

export const BOT_SORTS: readonly { sort: "most_used" | "newest" | "a_z"; label: string }[] = [
  { sort: "most_used", label: "Most used" },
  { sort: "newest", label: "Newest" },
  { sort: "a_z", label: "A to Z" },
];

/** A chip's category filter (Most used and All list every category). */
export const chipCategory = (chip: BotChip): BotCategory | null => (chip === "most_used" || chip === "all" ? null : chip);
