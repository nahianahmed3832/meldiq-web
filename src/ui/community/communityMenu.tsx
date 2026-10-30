import {
  ArrowUpDown,
  Bell,
  BellOff,
  Bot,
  CalendarPlus,
  CheckCheck,
  Copy,
  FolderPlus,
  IdCard,
  LogIn,
  LogOut,
  Megaphone,
  PenSquare,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  UserPen,
  UserPlus,
} from "lucide-react";
import { SparkDialog } from "../mojo/SparkDialog";
import { type ReactNode, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type WorkspacePage } from "../../application/router";
import { MUTE_CHOICES } from "../../sync/communityRules";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
import { communityMutedUntil, countsEveryone, MUTE_FOREVER, type NotifyLevel } from "../../sync/navPrefs";
import type { MenuEntry } from "../components/Overlay";
import { clock, dayLabel, sameDay } from "../format";
import { markAllReadTargets } from "../selectors";
import type { ShellDialog } from "../shell/Shell";
import { CategoryNameDialog } from "./CategoryDialogs";
import { CreateChannelDialog } from "./ChannelDialogs";
import { LeaveDialog } from "./LeaveDialog";
import { DeleteCommunityDialog } from "./DeleteCommunityDialog";
import { NicknameDialog } from "./NicknameDialog";
import { OpenTicketDialog } from "./tickets/TicketDialogs";
import { lockEntry } from "./lockMenu";
import { type LockChoice, lockCommunity, PARITY_FEATURES } from "../../sync/communityParity";
import { OnboardingFlow } from "./OnboardingFinish";
import type { Engine } from "../../sync/engine";
import { ArrangeRailDialog, CommunityNotificationsDialog, LEVEL_NAME } from "./NotifyDialogs";
import { categoriesOf, orderedOrgs } from "./panelData";
import type { CommunityPermissions } from "./useCommunityPermissions";

type MenuDialog = "notifications" | "channel" | "category" | "arrange" | "leave" | "delete" | "nickname" | "sparks" | "ticket" | "onboarding" | null;
type NavChange = (op: Parameters<Engine["nav"]["change"]>[1]) => void;

/** The per-browser "Hide muted channels" switch for a community (android CommunityViewPrefs: this device only). */
export const hideMutedKey = (orgId: string) => `::hide-muted:${orgId}`;
export const UNREAD_ONLY_KEY = "::unread-only";

/** "until 3:40 PM", "until Tomorrow 9:00 AM", or nothing for a mute that only ends when turned off. */
function untilHint(t: number, now = Date.now()): string | undefined {
  if (t >= MUTE_FOREVER) return undefined;
  return `Until ${sameDay(t, now) ? clock(t) : `${dayLabel(t, now)} ${clock(t)}`}`;
}

/**
 * One community's menu (the reference's server menu, 2026-10-28), the same wherever it opens: right-clicking its icon in
 * the rail, its name above the channels, or empty space in its channel list. Top to bottom: mark as read; then the
 * reference's order (2026-10-30): invite, Sparks, community settings, promote, bots, create channel and category, lock,
 * change nickname, mute, notification settings; then Meldiq's own (hide muted, only unread, privacy, arrange, create
 * event, join another, copy name and id); delete (owners) or leave last. Each item shows only to people allowed to use
 * it, on servers that have it; the server checks every change again. The dialogs it opens live in the component that
 * calls this hook, so they outlast the menu.
 */
export function useCommunityMenu(orgId: string | null, perms: CommunityPermissions, onDialog: (d: ShellDialog) => void): { entries: MenuEntry[]; dialogs: ReactNode } {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const orgCount = useOrbit((s) => orderedOrgs(s).length);
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const readTargets = useOrbit((s) => markAllReadTargets(s, orgId), shallowEqual);
  const nav = useOrbit((s) => (orgId ? s.nav[orgId] : undefined));
  const sparkLevel = useOrbit((s) => (orgId ? (s.mojo.orgs[orgId]?.level ?? 0) : 0));
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
  // Community parity A2: a real lock (no joins, only moderators chat); older servers fall back to Security actions'
  // join pause. Both go to the same people (Edit community or Ban).
  const realLock = features.includes(PARITY_FEATURES.safety);
  const canLock = (realLock || features.includes("security-actions")) && (perms.canManageOrg || perms.canBan);
  const lockedUntil = realLock ? (org.lockedUntil ?? null) : org.invitesPausedUntil;
  const settingsOn = features.includes(PARITY_FEATURES.settings);
  const openSettings = (page: WorkspacePage) => {
    setPrefs({ orgId });
    navigate({ section: "workspace", workspacePage: page });
  };

  const lock = (choice: LockChoice) => void lockCommunity(engine, orgId, choice, realLock).catch(() => engine.notice("error", "Couldn't lock the community. Try again."));
  const unlock = () => void lockCommunity(engine, orgId, null, realLock).catch(() => engine.notice("error", "Couldn't unlock the community. Try again."));

  const entries: MenuEntry[] = [
    { label: "Mark as read", icon: <CheckCheck size={16} />, disabled: readTargets.length === 0, onSelect: () => void Promise.all(readTargets.map((c) => engine.markRead(c))) },
    "separator",
  ];
  // The reference's order (docs/MELDIQ_COMMUNITY_PARITY.md §1, server menu): invite, Sparks, settings, promote, bots,
  // create, lock, nickname, mute, notifications; then Meldiq's own items; leaving or deleting last.
  if (perms.canInvite) entries.push({ label: "Invite people", icon: <UserPlus size={16} />, onSelect: () => onDialog({ kind: "addMembers", orgId }) });
  // Meldiq Spark (server docs/MOJO.md): any member may give one; no permission needed.
  if (features.includes("mojo")) entries.push({ label: "Sparks", icon: <Sparkles size={16} />, hint: sparkLevel ? `Level ${sparkLevel}` : undefined, onSelect: () => setDialog("sparks") });
  entries.push({ label: "Community settings", icon: <Settings2 size={16} />, onSelect: () => openSettings("overview") });
  if (features.includes(PARITY_FEATURES.promote) && perms.canManageOrg) entries.push({ label: "Promote", icon: <Megaphone size={16} />, onSelect: () => openSettings("promote") });
  if ((features.includes("bots") || features.includes(OFFICIAL_BOTS_FEATURE)) && perms.canManageOrg) entries.push({ label: "Bots", icon: <Bot size={16} />, onSelect: () => openSettings("bots") });
  if (perms.canCreateChannels) entries.push({ label: "Create channel", icon: <PenSquare size={16} />, onSelect: () => setDialog("channel") });
  if (perms.canCreateTop) entries.push({ label: "Create category", icon: <FolderPlus size={16} />, onSelect: () => setDialog("category") });
  if (canLock) entries.push(lockEntry({ lockedUntil, realLock, onLock: lock, onUnlock: unlock }));
  if (features.includes(PARITY_FEATURES.permissions)) entries.push({ label: "Change nickname", icon: <UserPen size={16} />, onSelect: () => setDialog("nickname") });
  // Community parity C: while the community has tickets on (its view carries `tickets`).
  if (org.tickets) entries.push({ label: "Open a Ticket", icon: <Ticket size={16} />, onSelect: () => setDialog("ticket") });
  // Community parity A3: everyone can go through onboarding again from the menu.
  if (settingsOn && org.onboarding && org.myRole !== "GUEST") entries.push({ label: "Redo onboarding", icon: <RotateCcw size={16} />, onSelect: () => setDialog("onboarding") });
  if (preferences)
    entries.push(
      muteEntry(muted, change),
      notificationsEntry(level, nav, change, () => setDialog("notifications")),
    );
  entries.push(
    "separator",
    { label: "Hide muted channels", toggle: true, checked: flag(hideMutedKey(orgId)), onSelect: () => toggleFlag(hideMutedKey(orgId)) },
    { label: "Show only unread", toggle: true, checked: flag(UNREAD_ONLY_KEY), onSelect: () => toggleFlag(UNREAD_ONLY_KEY) },
    { label: "Privacy settings", icon: <ShieldCheck size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "security" }) },
  );
  if (orgCount > 1 && preferences) entries.push({ label: "Arrange communities…", icon: <ArrowUpDown size={16} />, onSelect: () => setDialog("arrange") });
  if (features.includes("meetings")) entries.push({ label: "Create event", icon: <CalendarPlus size={16} />, onSelect: () => openSettings("meetings") });
  entries.push({ label: "Join another with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) });
  entries.push({ label: "Copy community name", icon: <Copy size={16} />, onSelect: () => copy(org.name, "Community name") });
  if (prefs.builderMode) entries.push({ label: "Copy community ID", icon: <IdCard size={16} />, onSelect: () => copy(org.id, "Community ID") });
  entries.push(
    "separator",
    org.myRole === "OWNER"
      ? { label: "Delete community", icon: <Trash2 size={16} />, danger: true, onSelect: () => setDialog("delete") }
      : { label: "Leave community", icon: <LogOut size={16} />, danger: true, onSelect: () => setDialog("leave") },
  );

  const close = () => setDialog(null);
  const dialogs = (
    <>
      {dialog === "notifications" && <CommunityNotificationsDialog orgId={org.id} name={org.name} onClose={close} />}
      {dialog === "channel" && <CreateChannelDialog orgId={org.id} categories={categories} categoryId={null} canCreateTop={perms.canCreateTop} onClose={close} />}
      {dialog === "category" && <CategoryNameDialog orgId={org.id} category={null} onClose={close} />}
      {dialog === "arrange" && <ArrangeRailDialog onClose={close} />}
      {dialog === "leave" && <LeaveDialog orgId={org.id} name={org.name} onClose={close} />}
      {dialog === "sparks" && <SparkDialog orgId={org.id} name={org.name} onClose={close} />}
      {dialog === "delete" && <DeleteCommunityDialog orgId={org.id} name={org.name} onClose={close} />}
      {dialog === "ticket" && <OpenTicketDialog orgId={org.id} panelId={null} onClose={close} />}
      {dialog === "nickname" && <NicknameDialog orgId={org.id} userId={engine.device.userId} onClose={close} />}
      {dialog === "onboarding" && <OnboardingFlow orgId={org.id} onClose={close} />}
    </>
  );
  return { entries, dialogs };
}

/** Mute community: for a while or until turned back on; Unmute while muted. */
function muteEntry(muted: number | null, change: NavChange): MenuEntry {
  if (muted !== null) return { label: "Unmute community", icon: <Bell size={16} />, hint: untilHint(muted), onSelect: () => change({ op: "community", mutedUntil: null }) };
  return {
    label: "Mute community",
    icon: <BellOff size={16} />,
    submenu: MUTE_CHOICES.map((m) => ({ label: m.label, onSelect: () => change({ op: "community", mutedUntil: m.ms === null ? MUTE_FOREVER : Date.now() + m.ms }) })),
  };
}

/** Notification settings: the community's default level, @everyone, and the full dialog. */
function notificationsEntry(level: NotifyLevel, nav: Parameters<typeof countsEveryone>[0], change: NavChange, more: () => void): MenuEntry {
  return {
    label: "Notification settings",
    icon: <Bell size={16} />,
    hint: LEVEL_NAME[level],
    submenu: [
      ...(["all", "mentions", "none"] as const).map((l) => ({ label: LEVEL_NAME[l], checked: level === l, onSelect: () => change({ op: "community", level: l }) })),
      "separator" as const,
      { label: "Ignore @everyone", toggle: true, checked: !countsEveryone(nav), onSelect: () => change({ op: "community", suppressEveryone: countsEveryone(nav) }) },
      { label: "More settings…", onSelect: more },
    ],
  };
}
