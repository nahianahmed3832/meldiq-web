import { ArrowUpDown, Bell, BellOff, CalendarPlus, CheckCheck, Copy, FolderPlus, IdCard, LogIn, LogOut, PenSquare, Settings2, ShieldCheck, UserPlus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type WorkspacePage } from "../../application/router";
import { MUTE_CHOICES } from "../../sync/communityRules";
import { communityMutedUntil, countsEveryone, MUTE_FOREVER, type NotifyLevel } from "../../sync/navPrefs";
import type { MenuEntry } from "../components/Overlay";
import { clock, dayLabel, sameDay } from "../format";
import { markAllReadTargets } from "../selectors";
import type { ShellDialog } from "../shell/Shell";
import { CategoryNameDialog } from "./CategoryDialogs";
import { CreateChannelDialog } from "./ChannelDialogs";
import { LeaveDialog } from "./LeaveDialog";
import { ArrangeRailDialog, CommunityNotificationsDialog, LEVEL_NAME } from "./NotifyDialogs";
import { categoriesOf, orderedOrgs } from "./panelData";
import type { CommunityPermissions } from "./useCommunityPermissions";

type MenuDialog = "notifications" | "channel" | "category" | "arrange" | "leave" | null;

/** The per-browser "Hide muted channels" switch for a community (android CommunityViewPrefs: this device only). */
export const hideMutedKey = (orgId: string) => `::hide-muted:${orgId}`;
export const UNREAD_ONLY_KEY = "::unread-only";

const SETTINGS_PAGES: { page: WorkspacePage; label: string; manage?: boolean }[] = [
  { page: "overview", label: "Overview" },
  { page: "roles", label: "Roles", manage: true },
  { page: "people", label: "Members" },
  { page: "invitations", label: "Invitations" },
  { page: "channels", label: "Channels", manage: true },
  { page: "expressions", label: "Emoji and stickers", manage: true },
  { page: "security", label: "Safety", manage: true },
  { page: "audit", label: "Audit log", manage: true },
];

/** "until 3:40 PM", "until Tomorrow 9:00 AM", or nothing for a mute that only ends when turned off. */
function untilHint(t: number, now = Date.now()): string | undefined {
  if (t >= MUTE_FOREVER) return undefined;
  return `Until ${sameDay(t, now) ? clock(t) : `${dayLabel(t, now)} ${clock(t)}`}`;
}

/**
 * One community's menu (the reference's server menu, 2026-10-28), the same wherever it opens: right-clicking its icon in
 * the rail, its name above the channels, or empty space in its channel list. Top to bottom: mark as read; invite; mute
 * (for a while, or until turned back on), notification level, hide muted channels and show only unread; community
 * settings, arrange communities; create a channel, category or event; join another; leave; copy name and (Builder mode)
 * its id. Each item shows only to people allowed to use it; the server checks every change again. The dialogs it opens
 * live in the component that calls this hook, so they outlast the menu.
 */
export function useCommunityMenu(orgId: string | null, perms: CommunityPermissions, onDialog: (d: ShellDialog) => void): { entries: MenuEntry[]; dialogs: ReactNode } {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const orgCount = useOrbit((s) => orderedOrgs(s).length);
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const readTargets = useOrbit((s) => markAllReadTargets(s, orgId), shallowEqual);
  const nav = useOrbit((s) => (orgId ? s.nav[orgId] : undefined));
  const prefs = usePrefs();
  const [dialog, setDialog] = useState<MenuDialog>(null);
  if (!org || !orgId) return { entries: [], dialogs: null };

  const flag = (key: string) => prefs.collapsed.includes(key);
  const toggleFlag = (key: string) => setPrefs({ collapsed: flag(key) ? prefs.collapsed.filter((k) => k !== key) : [...prefs.collapsed, key] });
  const change = (op: Parameters<typeof engine.nav.change>[1]) => void engine.nav.change(orgId, op);
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    engine.notice("info", `${what} copied.`);
  };
  const preferences = features.includes("community-preferences");
  const muted = communityMutedUntil(nav);
  const level: NotifyLevel = nav?.community?.level ?? "all";
  const openSettings = (page: WorkspacePage) => {
    setPrefs({ orgId });
    navigate({ section: "workspace", workspacePage: page });
  };

  const entries: MenuEntry[] = [
    { label: "Mark as read", icon: <CheckCheck size={16} />, disabled: readTargets.length === 0, onSelect: () => void Promise.all(readTargets.map((c) => engine.markRead(c))) },
  ];
  if (perms.canInvite) entries.push("separator", { label: "Invite people", icon: <UserPlus size={16} />, onSelect: () => onDialog({ kind: "addMembers", orgId }) });
  entries.push("separator");
  if (preferences) {
    entries.push(
      muted !== null
        ? { label: "Unmute community", icon: <Bell size={16} />, hint: untilHint(muted), onSelect: () => change({ op: "community", mutedUntil: null }) }
        : {
            label: "Mute community",
            icon: <BellOff size={16} />,
            submenu: MUTE_CHOICES.map((m) => ({ label: m.label, onSelect: () => change({ op: "community", mutedUntil: m.ms === null ? MUTE_FOREVER : Date.now() + m.ms }) })),
          },
      {
        label: "Notification settings",
        icon: <Bell size={16} />,
        hint: LEVEL_NAME[level],
        submenu: [
          ...(["all", "mentions", "none"] as const).map((l) => ({ label: LEVEL_NAME[l], checked: level === l, onSelect: () => change({ op: "community", level: l }) })),
          "separator" as const,
          { label: "Ignore @everyone", toggle: true, checked: !countsEveryone(nav), onSelect: () => change({ op: "community", suppressEveryone: countsEveryone(nav) }) },
          { label: "More settings…", onSelect: () => setDialog("notifications") },
        ],
      },
    );
  }
  entries.push(
    { label: "Hide muted channels", toggle: true, checked: flag(hideMutedKey(orgId)), onSelect: () => toggleFlag(hideMutedKey(orgId)) },
    { label: "Show only unread", toggle: true, checked: flag(UNREAD_ONLY_KEY), onSelect: () => toggleFlag(UNREAD_ONLY_KEY) },
    "separator",
    {
      label: "Community settings",
      icon: <Settings2 size={16} />,
      submenu: SETTINGS_PAGES.filter((p) => !p.manage || perms.canManageOrg || perms.isOwner).map((p) => ({ label: p.label, onSelect: () => openSettings(p.page) })),
    },
    { label: "Privacy settings", icon: <ShieldCheck size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "security" }) },
  );
  if (orgCount > 1 && preferences) entries.push({ label: "Arrange communities…", icon: <ArrowUpDown size={16} />, onSelect: () => setDialog("arrange") });
  const create: MenuEntry[] = [];
  if (perms.canCreateChannels) create.push({ label: "Create channel", icon: <PenSquare size={16} />, onSelect: () => setDialog("channel") });
  if (perms.canCreateTop) create.push({ label: "Create category", icon: <FolderPlus size={16} />, onSelect: () => setDialog("category") });
  if (features.includes("meetings")) create.push({ label: "Create event", icon: <CalendarPlus size={16} />, onSelect: () => openSettings("meetings") });
  if (create.length) entries.push("separator", ...create);
  entries.push("separator", { label: "Join another with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) });
  if (org.myRole !== "OWNER") entries.push({ label: "Leave community", icon: <LogOut size={16} />, danger: true, onSelect: () => setDialog("leave") });
  entries.push("separator", { label: "Copy community name", icon: <Copy size={16} />, onSelect: () => copy(org.name, "Community name") });
  if (prefs.builderMode) entries.push({ label: "Copy community ID", icon: <IdCard size={16} />, onSelect: () => copy(org.id, "Community ID") });

  const close = () => setDialog(null);
  const dialogs = (
    <>
      {dialog === "notifications" && <CommunityNotificationsDialog orgId={org.id} name={org.name} onClose={close} />}
      {dialog === "channel" && <CreateChannelDialog orgId={org.id} categories={categories} categoryId={null} canCreateTop={perms.canCreateTop} onClose={close} />}
      {dialog === "category" && <CategoryNameDialog orgId={org.id} category={null} onClose={close} />}
      {dialog === "arrange" && <ArrangeRailDialog onClose={close} />}
      {dialog === "leave" && <LeaveDialog orgId={org.id} name={org.name} onClose={close} />}
    </>
  );
  return { entries, dialogs };
}
