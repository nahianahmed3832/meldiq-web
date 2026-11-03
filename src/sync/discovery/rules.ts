import { text as uiText } from "../../i18n";
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
export type TagsInput =
  | {
      tags: string[];
    }
  | {
      problem: string;
    };
/** Tags typed comma-separated: cleaned (single spaces, lower case, repeats dropped), or what's wrong with them. */
export function parseTags(text: string): TagsInput {
  const raw = text
    .split(",")
    .map((t) => t.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean);
  const tags = [...new Set(raw)];
  if (tags.length > DISCOVERY_LIMITS.tags) return { problem: uiText("workspace.interface.up_to_value0_tags_e9c78eb", { value0: DISCOVERY_LIMITS.tags }) };
  const long = tags.find((t) => [...t].length > DISCOVERY_LIMITS.tag);
  if (long) return { problem: uiText("workspace.interface.value0_is_too_long_keep_each_tag_to_value1_characters_20e7644", { value0: long.slice(0, 30), value1: DISCOVERY_LIMITS.tag }) };
  const bad = tags.find((t) => !TAG.test(t));
  if (bad) return { problem: uiText("workspace.interface.value0_tags_use_letters_digits_spaces_and_hyphens_997f5b5", { value0: bad.slice(0, 30) }) };
  return { tags };
}
/** The text a card's label shows, or null (no label). An unknown label shows nothing rather than guessing. */
export function cardLabelText(label: CardLabel): string | null {
  switch (label) {
    case "promoted":
      return "PROMOTED";
    case "mega":
      return uiText("workspace.discover_label_mega");
    case "super":
      return uiText("workspace.discover_label_super");
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
      return uiText("workspace.interface.it_s_private_make_it_public_who_can_find_it_below_to_be_listed_356d0c1");
    case "turned_off":
      return uiText("workspace.interface.turned_off_it_won_t_show_in_discover_ed288d1");
    case "too_few_members": {
      const left = Math.max(minMembers - memberCount, 1);
      return uiText("workspace.interface.listed_once_it_has_value0_members_value1_more_to_go_d013f77", { value0: minMembers, value1: left });
    }
    case "locked":
      return uiText("workspace.interface.locked_right_now_it_shows_again_when_the_lock_ends_340b0ce");
    case "removed":
      return uiText("workspace.interface.meldiq_took_it_out_of_discover_contact_support_if_you_think_that_7616757");
    case "name_blocked":
      return uiText("workspace.interface.its_name_looks_like_meldiq_s_own_official_staff_meldiq_so_it_isn_853e524");
    default:
      return uiText("workspace.interface.not_listed_right_now_f41c169");
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
  get moderation() {
    return uiText("organization.interface.moderation_126d441");
  },
  get fun() {
    return uiText("workspace.interface.fun_c960563");
  },
  get games() {
    return uiText("workspace.interface.games_d9dae78");
  },
  get utility() {
    return uiText("workspace.interface.utility_9450d83");
  },
  get music() {
    return uiText("workspace.interface.music_6eb00b4");
  },
  get economy() {
    return uiText("workspace.interface.economy_c1d078d");
  },
  get social() {
    return uiText("workspace.interface.social_f1b7505");
  },
  ai: "AI",
  get other() {
    return uiText("workspace.interface.other_f97e9da");
  },
};
/** The directory's chips in the reference's order: Most used (no category, most used first), All, then each category. */
export type BotChip = "most_used" | "all" | BotCategory;
export const BOT_CHIPS: readonly {
  chip: BotChip;
  label: string;
}[] = [
  {
    chip: "most_used",
    get label() {
      return uiText("workspace.interface.most_used_d3365a6");
    },
  },
  {
    chip: "all",
    get label() {
      return uiText("settings.ap_all");
    },
  },
  ...(Object.entries(BOT_CATEGORY_TEXT) as [BotCategory, string][]).map(([chip, label]) => ({ chip, label })),
];
export const BOT_SORTS: readonly {
  sort: "most_used" | "newest" | "a_z";
  label: string;
}[] = [
  {
    sort: "most_used",
    get label() {
      return uiText("workspace.interface.most_used_d3365a6");
    },
  },
  {
    sort: "newest",
    get label() {
      return uiText("messaging.interface.newest_d15efa1");
    },
  },
  {
    sort: "a_z",
    get label() {
      return uiText("workspace.interface.a_to_z_790e831");
    },
  },
];
/** A chip's category filter (Most used and All list every category). */
export const chipCategory = (chip: BotChip): BotCategory | null => (chip === "most_used" || chip === "all" ? null : chip);
