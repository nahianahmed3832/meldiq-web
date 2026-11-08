import { text as uiText } from "../../i18n";
import {
  Bell,
  Ban,
  BookOpen,
  Compass,
  Plug,
  BookText,
  CalendarDays,
  Flag,
  Gauge,
  Hash,
  HelpCircle,
  House,
  LayoutGrid,
  Megaphone,
  Pin,
  ScrollText,
  ShieldCheck,
  Smile,
  Ticket,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Icon } from "../icons/Icon";
import type { ReactNode } from "react";
import type { OrgAdminDetail, OrgPermissions } from "../../api/workspaceSchemas";
import type { WorkspacePage } from "../../application/router";
import { isTicketStaff } from "../../sync/posting/tickets";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { PING_ROLES_FEATURE } from "../../sync/pingRoles";
import { LOBBY_FEATURE } from "../../sync/lobby";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
/**
 * Community settings' left rail (docs/MELDIQ_COMMUNITY_PARITY.md §1, "Server Settings window"): the reference's groups and
 * order, in Meldiq's words. The first group is titled with the community's name. Meldiq's extra pages sit where they
 * fit (Rules with the community, Applications, Invitations and Pins with people) and Events and Usage close the list.
 */
export type CommunityRailGroup = "overview" | "community" | "apps" | "people" | "moderation" | "plus" | "more";
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
  featuresAny?: readonly string[];
}
/** Group titles; the first group's title is the community's name. */
export const COMMUNITY_RAIL_GROUPS: readonly {
  key: CommunityRailGroup;
  label: string | null;
}[] = [
  {
    key: "overview",
    get label() {
      return uiText("workspace.interface.overview_d4b1ea5");
    },
  },
  {
    key: "community",
    get label() {
      return uiText("organization.community");
    },
  },
  {
    key: "moderation",
    get label() {
      return uiText("workspace.reference.safety");
    },
  },
  {
    key: "people",
    get label() {
      return uiText("workspace.members");
    },
  },
  {
    key: "apps",
    get label() {
      return uiText("workspace.interface.apps_89dd748");
    },
  },
  {
    key: "plus",
    get label() {
      return uiText("workspace.reference.plus");
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
      return uiText("workspace.interface.overview_d4b1ea5");
    },
    icon: <Icon name="settings.general" size={18} />,
    group: "overview",
  },
  {
    key: "theme",
    get label() {
      return uiText("settings.ap_theme");
    },
    icon: <Icon name="settings.appearance" size={18} />,
    group: "overview",
    feature: "community-branding",
  },
  {
    key: "channels",
    get label() {
      return uiText("organization.channels");
    },
    icon: <Hash size={17} />,
    group: "overview",
  },
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
    key: "expressions",
    get label() {
      return uiText("messaging.interface.emoji_61ad897");
    },
    icon: <Smile size={17} />,
    group: "community",
    feature: "community-expressions",
    shown: (p) => can(p, "expressions.manage"),
  },
  {
    key: "stickers",
    get label() {
      return uiText("messaging.interface.stickers_dbf9cbb");
    },
    icon: <Smile size={17} />,
    group: "community",
    feature: "community-expressions",
    shown: (p) => can(p, "expressions.manage"),
  },
  {
    key: "onboarding",
    get label() {
      return uiText("organization.interface.onboarding_a2198f4");
    },
    icon: <HelpCircle size={17} />,
    group: "community",
    feature: "onboarding",
  },
  {
    key: "ping-roles",
    get label() {
      return uiText("workspace.reference.pingRoles");
    },
    icon: <Icon name="settings.notifications" size={18} />,
    group: "community",
    feature: PING_ROLES_FEATURE,
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
    key: "discovery",
    get label() {
      return uiText("settings.navigation.discovery");
    },
    icon: <Compass size={17} />,
    group: "community",
    shown: (p) => p.canManageOrg,
  },
  {
    key: "notifications",
    get label() {
      return uiText("settings.notifications");
    },
    icon: <Bell size={17} />,
    group: "community",
    feature: "community-preferences",
  },
  {
    key: "security",
    get label() {
      return uiText("workspace.reference.safety");
    },
    icon: <ShieldCheck size={17} />,
    group: "moderation",
    featuresAny: ["security-actions", PARITY_FEATURES.safety],
    shown: (p) => p.canManageOrg || p.canBan,
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
    key: "bots",
    get label() {
      return uiText("messaging.people_bots");
    },
    icon: <Icon name="settings.developer" size={18} />,
    group: "apps",
    featuresAny: ["bots", OFFICIAL_BOTS_FEATURE],
    shown: (p) => p.canManageOrg,
  },
  {
    key: "integrations",
    get label() {
      return uiText("settings.navigation.integrations");
    },
    icon: <Plug size={17} />,
    group: "apps",
    featuresAny: ["bots", OFFICIAL_BOTS_FEATURE, "community-tickets"],
    shown: (p) => isTicketStaff(p),
  },
  {
    key: "sparks",
    get label() {
      return uiText("workspace.reference.supercharge");
    },
    icon: <Icon name="settings.spark" size={18} />,
    group: "plus",
    feature: "mojo",
  },
  {
    key: "promote",
    get label() {
      return uiText("organization.interface.promote_5834dab");
    },
    icon: <Megaphone size={17} />,
    group: "plus",
    feature: PARITY_FEATURES.promote,
    shown: (p) => p.canManageOrg,
  },
  {
    key: "partner",
    get label() {
      return uiText("workspace.partners.label");
    },
    icon: <Icon name="settings.membership" size={18} />,
    group: "plus",
    feature: "partner-applications",
    shown: (p) => p.isOwner,
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
  const fits = COMMUNITY_RAIL.filter(
    (p) => (!p.feature || features.includes(p.feature)) && (!p.featuresAny || p.featuresAny.some((f) => features.includes(f))) && (!p.without || !features.includes(p.without)),
  );
  return fits.filter((p, i) => fits.findIndex((q) => q.key === p.key) === i);
}
/** The title at the top of a community settings page. */
export function communityPageTitle(page: WorkspacePage, features: readonly string[] = []): string {
  return (railForFeatures(features).find((p) => p.key === page) ?? COMMUNITY_RAIL.find((p) => p.key === page))?.label ?? uiText("workspace.interface.overview_d4b1ea5");
}

/** Pages, with the permission flag that shows them (the server decides; older servers don't send the newer flags). */
/** Meldiq 2.0: the pages in three groups (people and channels; tools; administration) instead of one long list. */
type LegacyGroup = "workspace" | "tools" | "admin";
export const LEGACY_GROUPS: {
  key: LegacyGroup;
  label: string;
}[] = [
  {
    key: "workspace",
    get label() {
      return uiText("workspace.interface.workspace_87bb59b");
    },
  },
  {
    key: "tools",
    get label() {
      return uiText("workspace.interface.tools_ea93d6a");
    },
  },
  {
    key: "admin",
    get label() {
      return uiText("admin.title");
    },
  },
];
const LEGACY_PAGES: {
  key: WorkspacePage;
  label: string;
  icon: ReactNode;
  group: LegacyGroup;
  shown?: (p: OrgPermissions, d: OrgAdminDetail) => boolean;
  feature?: string;
}[] = [
  {
    key: "overview",
    get label() {
      return uiText("workspace.interface.overview_d4b1ea5");
    },
    icon: <LayoutGrid size={17} />,
    group: "workspace",
  },
  {
    key: "people",
    get label() {
      return uiText("calls.interface.people_7db2089");
    },
    icon: <UsersRound size={17} />,
    group: "workspace",
  },
  {
    key: "invitations",
    get label() {
      return uiText("organization.invitations");
    },
    icon: <Ticket size={17} />,
    group: "workspace",
  },
  {
    key: "channels",
    get label() {
      return uiText("organization.channels");
    },
    icon: <Hash size={17} />,
    group: "workspace",
  },
  {
    key: "meetings",
    get label() {
      return uiText("workspace.interface.meetings_bca705b");
    },
    icon: <CalendarDays size={17} />,
    group: "tools",
    feature: "meetings",
  },
  {
    key: "roles",
    get label() {
      return uiText("organization.roles");
    },
    icon: <ShieldCheck size={17} />,
    group: "admin",
    shown: (p) => p.canViewRoles,
  },
  {
    key: "audit",
    get label() {
      return uiText("workspace.interface.audit_log_e4d36f9");
    },
    icon: <ScrollText size={17} />,
    group: "admin",
    shown: (p) => p.canViewAudit,
  },
  {
    key: "usage",
    get label() {
      return uiText("workspace.interface.usage_8d59829");
    },
    icon: <Gauge size={17} />,
    group: "admin",
    shown: (p) => p.canViewUsage,
  },
];

export function visibleWorkspaceRail(features: readonly string[], detail: OrgAdminDetail | null): { key: WorkspacePage; label: string; icon: ReactNode; group: string }[] {
  if (features.includes("community-channels")) return visibleCommunityRail(features, detail?.permissions ?? null);
  const basic = LEGACY_PAGES.filter((p) => (!p.shown || (detail && p.shown(detail.permissions, detail))) && (!p.feature || features.includes(p.feature)));
  // Older scoped workspaces can still advertise individual tools. Preserve those routes with the same feature and
  // permission checks as communities, without repeating branding already edited on their Overview page.
  const groups: Record<CommunityRailGroup, LegacyGroup> = { overview: "workspace", community: "workspace", apps: "tools", people: "workspace", moderation: "admin", plus: "tools", more: "tools" };
  const tools = visibleCommunityRail(features, detail?.permissions ?? null)
    .filter((p) => p.key !== "theme" && (p.feature || p.featuresAny) && !basic.some((b) => b.key === p.key))
    .map((p) => ({ ...p, group: groups[p.group] }));
  return [...basic, ...tools];
}
