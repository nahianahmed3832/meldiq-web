import { text as uiText } from "../../i18n";
import {
  Ban,
  BookOpen,
  BookText,
  Bot,
  CalendarDays,
  Flag,
  Gauge,
  Gem,
  Hash,
  HelpCircle,
  House,
  LayoutGrid,
  Megaphone,
  Palette,
  Pin,
  ScrollText,
  ShieldCheck,
  Smile,
  Ticket,
  UserCheck,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { OrgPermissions } from "../../api/workspaceSchemas";
import type { WorkspacePage } from "../../application/router";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { LOBBY_FEATURE } from "../../sync/lobby";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
/**
 * Community settings' left rail (docs/MELDIQ_COMMUNITY_PARITY.md §1, "Server Settings window"): the reference's groups and
 * order, in Meldiq's words. The first group is titled with the community's name. Meldiq's extra pages sit where they
 * fit (Rules with the community, Applications, Invitations and Pins with people) and Events and Usage close the list.
 */
export type CommunityRailGroup = "community" | "expression" | "apps" | "people" | "moderation" | "more";
export interface CommunityRailPage {
  key: WorkspacePage;
  label: string;
  icon: ReactNode;
  group: CommunityRailGroup;
  /** Who may open it (the server checks every change again); unset: everyone in the community. */
  shown?: (p: OrgPermissions) => boolean;
  /** The server feature it needs. */
  feature?: string;
  /** Hidden when the server has this feature (a page another one replaces). */
  without?: string;
}
/** Group titles; the first group's title is the community's name. */
export const COMMUNITY_RAIL_GROUPS: readonly {
  key: CommunityRailGroup;
  label: string | null;
}[] = [
  { key: "community", label: null },
  {
    key: "expression",
    get label() {
      return uiText("organization.interface.expression_c67415b");
    },
  },
  {
    key: "apps",
    get label() {
      return uiText("workspace.interface.apps_89dd748");
    },
  },
  {
    key: "people",
    get label() {
      return uiText("calls.interface.people_7db2089");
    },
  },
  {
    key: "moderation",
    get label() {
      return uiText("organization.interface.moderation_126d441");
    },
  },
  {
    key: "more",
    get label() {
      return uiText("messaging.interface.more_d47d7cb");
    },
  },
];
const can = (p: OrgPermissions, perm: string) => p.isOwner || p.effective.includes(perm);
export const COMMUNITY_RAIL: readonly CommunityRailPage[] = [
  {
    key: "overview",
    get label() {
      return uiText("settings.profile");
    },
    icon: <LayoutGrid size={17} />,
    group: "community",
  },
  // Community parity B: the reference's lobby. Without it, Meldiq's community guide stands in as Home; with it the guide
  // keeps its own page, and shows as a card in the lobby.
  {
    key: "lobby",
    get label() {
      return uiText("workspace.interface.lobby_4c97a9e");
    },
    icon: <House size={17} />,
    group: "community",
    feature: LOBBY_FEATURE,
    shown: (p) => p.canManageOrg,
  },
  {
    key: "guide",
    get label() {
      return uiText("workspace.home");
    },
    icon: <House size={17} />,
    group: "community",
    feature: "community-guide",
    without: LOBBY_FEATURE,
    shown: (p) => p.canManageOrg,
  },
  {
    key: "guide",
    get label() {
      return uiText("organization.interface.community_guide_0fdcaac");
    },
    icon: <BookOpen size={17} />,
    group: "community",
    feature: "community-guide",
    shown: (p) => p.canManageOrg,
  },
  {
    key: "theme",
    get label() {
      return uiText("settings.ap_theme");
    },
    icon: <Palette size={17} />,
    group: "community",
    feature: "community-branding",
  },
  {
    key: "channels",
    get label() {
      return uiText("organization.channels");
    },
    icon: <Hash size={17} />,
    group: "community",
  },
  // API 0.65.0: the rules channel and the community's rules (Edit community).
  {
    key: "rules",
    get label() {
      return uiText("organization.rules_title");
    },
    icon: <BookText size={17} />,
    group: "community",
    feature: "rules-channel",
    shown: (p) => p.canManageOrg,
  },
  {
    key: "sparks",
    get label() {
      return uiText("organization.interface.sparks_6905661");
    },
    icon: <Gem size={17} />,
    group: "community",
    feature: "mojo",
  },
  {
    key: "promote",
    get label() {
      return uiText("organization.interface.promote_5834dab");
    },
    icon: <Megaphone size={17} />,
    group: "community",
    feature: PARITY_FEATURES.promote,
    shown: (p) => p.canManageOrg,
  },
  {
    key: "expressions",
    get label() {
      return uiText("organization.interface.emoji_stickers_e1e12f3");
    },
    icon: <Smile size={17} />,
    group: "expression",
    feature: "community-expressions",
    shown: (p) => can(p, "expressions.manage"),
  },
  // API 0.65.0 batch B: adding bots needs Edit community.
  {
    key: "bots",
    get label() {
      return uiText("messaging.people_bots");
    },
    icon: <Bot size={17} />,
    group: "apps",
    feature: "bots",
    shown: (p) => p.canManageOrg,
  },
  // Community parity D: Meldiq's official bots (servers with community-bots but without people's bots).
  {
    key: "bots",
    get label() {
      return uiText("messaging.people_bots");
    },
    icon: <Bot size={17} />,
    group: "apps",
    feature: OFFICIAL_BOTS_FEATURE,
    shown: (p) => p.canManageOrg,
  },
  {
    key: "people",
    get label() {
      return uiText("workspace.members");
    },
    icon: <UsersRound size={17} />,
    group: "people",
    shown: (p) => p.canViewDirectory,
  },
  {
    key: "roles",
    get label() {
      return uiText("organization.roles");
    },
    icon: <ShieldCheck size={17} />,
    group: "people",
    shown: (p) => p.canViewRoles,
  },
  {
    key: "onboarding",
    get label() {
      return uiText("organization.interface.onboarding_a2198f4");
    },
    icon: <HelpCircle size={17} />,
    group: "people",
    feature: "onboarding",
  },
  {
    key: "bans",
    get label() {
      return uiText("workspace.interface.bans_4d5469c");
    },
    icon: <Ban size={17} />,
    group: "people",
    feature: "community-moderation",
    shown: (p) => p.canBan,
  },
  {
    key: "applications",
    get label() {
      return uiText("workspace.interface.applications_98e33b0");
    },
    icon: <UserCheck size={17} />,
    group: "people",
    feature: "join-applications",
    shown: (p) => can(p, "members.approve"),
  },
  {
    key: "invitations",
    get label() {
      return uiText("organization.invitations");
    },
    icon: <Ticket size={17} />,
    group: "people",
    shown: (p) => p.canInvite,
  },
  {
    key: "pins",
    get label() {
      return uiText("files.interface.pins_64baafa");
    },
    icon: <Pin size={17} />,
    group: "people",
    feature: "profile-pins",
  },
  {
    key: "reports",
    get label() {
      return uiText("workspace.interface.reports_dacca3c");
    },
    icon: <Flag size={17} />,
    group: "moderation",
    feature: "reports",
    shown: (p) => can(p, "reports.view"),
  },
  {
    key: "audit",
    get label() {
      return uiText("workspace.interface.audit_log_e4d36f9");
    },
    icon: <ScrollText size={17} />,
    group: "moderation",
    shown: (p) => p.canViewAudit,
  },
  {
    key: "meetings",
    get label() {
      return uiText("workspace.interface.events_8d14f6e");
    },
    icon: <CalendarDays size={17} />,
    group: "more",
    feature: "meetings",
  },
  {
    key: "usage",
    get label() {
      return uiText("workspace.interface.usage_8d59829");
    },
    icon: <Gauge size={17} />,
    group: "more",
    shown: (p) => p.canViewUsage,
  },
];
/** The rail's pages this person sees on this server (permissions unknown yet: only the open pages). */
export function visibleCommunityRail(features: readonly string[], permissions: OrgPermissions | null): CommunityRailPage[] {
  return railForFeatures(features).filter((p) => !p.shown || (permissions !== null && p.shown(permissions)));
}
/** The rail's pages this server has, one per key (the first that fits). */
function railForFeatures(features: readonly string[]): CommunityRailPage[] {
  const fits = COMMUNITY_RAIL.filter((p) => (!p.feature || features.includes(p.feature)) && (!p.without || !features.includes(p.without)));
  return fits.filter((p, i) => fits.findIndex((q) => q.key === p.key) === i);
}
/**
 * The rail item a page belongs to. Security actions became a section of Profile; their old links open it there.
 */
export function communityRailKey(page: WorkspacePage): WorkspacePage {
  return page === "security" ? "overview" : page;
}
/** The title at the top of a community settings page. */
export function communityPageTitle(page: WorkspacePage, features: readonly string[] = []): string {
  const key = communityRailKey(page);
  return (railForFeatures(features).find((p) => p.key === key) ?? COMMUNITY_RAIL.find((p) => p.key === key))?.label ?? uiText("settings.profile");
}
