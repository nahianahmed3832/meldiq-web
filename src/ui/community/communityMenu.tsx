import { text as uiText } from "../../i18n";
import { useT as useLocalization } from "../../i18n";
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
import { requestNavigation } from "../../application/navigationGuard";
import { navigate, type WorkspacePage } from "../../application/router";
import { MUTE_CHOICES } from "../../sync/communityRules";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
import { communityMutedUntil, MUTE_FOREVER } from "../../sync/navPrefs";
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
import { ArrangeRailDialog } from "./NotifyDialogs";
import { categoriesOf, orderedOrgs } from "./panelData";
import type { CommunityPermissions } from "./useCommunityPermissions";
type MenuDialog = "channel" | "category" | "arrange" | "leave" | "delete" | "nickname" | "sparks" | "ticket" | "onboarding" | null;
type NavChange = (op: Parameters<Engine["nav"]["change"]>[1]) => void;
/** The per-browser "Hide muted channels" switch for a community (android CommunityViewPrefs: this device only). */
export const hideMutedKey = (orgId: string) => `::hide-muted:${orgId}`;
export const UNREAD_ONLY_KEY = "::unread-only";
/** "until 3:40 PM", "until Tomorrow 9:00 AM", or nothing for a mute that only ends when turned off. */
function untilHint(t: number, now = Date.now()): string | undefined {
  if (t >= MUTE_FOREVER) return undefined;
  return uiText("workspace.interface.until_value0_605a76c", { value0: sameDay(t, now) ? clock(t) : `${dayLabel(t, now)} ${clock(t)}` });
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
export function useCommunityMenu(
  orgId: string | null,
  perms: CommunityPermissions,
  onDialog: (d: ShellDialog) => void,
): {
  entries: MenuEntry[];
  dialogs: ReactNode;
} {
  const l10n = useLocalization();
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
    engine.notice("info", uiText("organization.interface.value0_copied_fa494aa", { value0: what }));
  };
  const preferences = features.includes("community-preferences");
  const muted = communityMutedUntil(nav);
  // Community parity A2: a real lock (no joins, only moderators chat); older servers fall back to Security actions'
  // join pause. Both go to the same people (Edit community or Ban).
  const realLock = features.includes(PARITY_FEATURES.safety);
  const canLock = (realLock || features.includes("security-actions")) && (perms.canManageOrg || perms.canBan);
  const lockedUntil = realLock ? (org.lockedUntil ?? null) : org.invitesPausedUntil;
  const settingsOn = features.includes(PARITY_FEATURES.settings);
  const openSettings = (page: WorkspacePage) =>
    requestNavigation(() => {
      setPrefs({ orgId });
      navigate({ section: "workspace", workspacePage: page });
    });
  const lock = (choice: LockChoice) =>
    void lockCommunity(engine, orgId, choice, realLock).catch(() => engine.notice("error", uiText("organization.interface.couldn_t_lock_the_community_try_again_678dfbe")));
  const unlock = () => void lockCommunity(engine, orgId, null, realLock).catch(() => engine.notice("error", uiText("organization.interface.couldn_t_unlock_the_community_try_again_55a45ac")));
  const entries: MenuEntry[] = [
    { label: l10n("notifications.markRead"), icon: <CheckCheck size={16} />, disabled: readTargets.length === 0, onSelect: () => void Promise.all(readTargets.map((c) => engine.markRead(c))) },
    "separator",
  ];
  // The reference's order (docs/MELDIQ_COMMUNITY_PARITY.md §1, server menu): invite, Sparks, settings, promote, bots,
  // create, lock, nickname, mute, notifications; then Meldiq's own items; leaving or deleting last.
  if (perms.canInvite)
    entries.push({
      get label() {
        return uiText("calls.interface.invite_people_27bf0f2");
      },
      icon: <UserPlus size={16} />,
      onSelect: () => onDialog({ kind: "addMembers", orgId }),
    });
  // Meldiq Spark (server docs/MOJO.md): any member may give one; no permission needed.
  if (features.includes("mojo"))
    entries.push({
      get label() {
        return uiText("organization.interface.sparks_6905661");
      },
      icon: <Sparkles size={16} />,
      hint: sparkLevel ? uiText("billing.interface.level_value0_6095a3d", { value0: sparkLevel }) : undefined,
      onSelect: () => setDialog("sparks"),
    });
  entries.push({
    get label() {
      return uiText("organization.interface.community_settings_7a81b1f");
    },
    icon: <Settings2 size={16} />,
    onSelect: () => openSettings("overview"),
  });
  if (features.includes(PARITY_FEATURES.promote) && perms.canManageOrg)
    entries.push({
      get label() {
        return uiText("organization.interface.promote_5834dab");
      },
      icon: <Megaphone size={16} />,
      onSelect: () => openSettings("promote"),
    });
  if ((features.includes("bots") || features.includes(OFFICIAL_BOTS_FEATURE)) && perms.canManageOrg)
    entries.push({ label: l10n("messaging.people_bots"), icon: <Bot size={16} />, onSelect: () => openSettings("bots") });
  if (perms.canCreateChannels)
    entries.push({
      get label() {
        return uiText("organization.interface.create_channel_f0f8831");
      },
      icon: <PenSquare size={16} />,
      onSelect: () => setDialog("channel"),
    });
  if (perms.canCreateTop)
    entries.push({
      get label() {
        return uiText("organization.interface.create_category_12748aa");
      },
      icon: <FolderPlus size={16} />,
      onSelect: () => setDialog("category"),
    });
  if (canLock) entries.push(lockEntry({ lockedUntil, realLock, onLock: lock, onUnlock: unlock }));
  if (features.includes(PARITY_FEATURES.permissions))
    entries.push({
      get label() {
        return uiText("organization.interface.change_nickname_27297a1");
      },
      icon: <UserPen size={16} />,
      onSelect: () => setDialog("nickname"),
    });
  // Community parity C: while the community has tickets on (its view carries `tickets`).
  if (org.tickets)
    entries.push({
      get label() {
        return uiText("organization.interface.open_a_ticket_8716749");
      },
      icon: <Ticket size={16} />,
      onSelect: () => setDialog("ticket"),
    });
  // Community parity A3: everyone can go through onboarding again from the menu.
  if (settingsOn && org.onboarding && org.myRole !== "GUEST")
    entries.push({
      get label() {
        return uiText("organization.interface.redo_onboarding_24d55b4");
      },
      icon: <RotateCcw size={16} />,
      onSelect: () => setDialog("onboarding"),
    });
  if (preferences) entries.push(muteEntry(muted, change), { label: l10n("notifications.bell_label"), icon: <Bell size={16} />, onSelect: () => openSettings("notifications") });
  entries.push(
    "separator",
    {
      get label() {
        return uiText("organization.interface.hide_muted_channels_4bfcd6c");
      },
      toggle: true,
      checked: flag(hideMutedKey(orgId)),
      onSelect: () => toggleFlag(hideMutedKey(orgId)),
    },
    {
      get label() {
        return uiText("organization.interface.show_only_unread_a37a29f");
      },
      toggle: true,
      checked: flag(UNREAD_ONLY_KEY),
      onSelect: () => toggleFlag(UNREAD_ONLY_KEY),
    },
    {
      get label() {
        return uiText("organization.interface.privacy_settings_54345f9");
      },
      icon: <ShieldCheck size={16} />,
      onSelect: () => navigate({ section: "settings", settingsPage: "security" }),
    },
  );
  if (orgCount > 1 && preferences)
    entries.push({
      get label() {
        return uiText("organization.interface.arrange_communities_16001db");
      },
      icon: <ArrowUpDown size={16} />,
      onSelect: () => setDialog("arrange"),
    });
  if (features.includes("meetings"))
    entries.push({
      get label() {
        return uiText("organization.interface.create_event_946cbe2");
      },
      icon: <CalendarPlus size={16} />,
      onSelect: () => openSettings("meetings"),
    });
  entries.push({
    get label() {
      return uiText("organization.interface.join_another_with_a_code_505e1c6");
    },
    icon: <LogIn size={16} />,
    onSelect: () => onDialog({ kind: "joinWorkspace" }),
  });
  entries.push({
    get label() {
      return uiText("organization.interface.copy_community_name_9a10bd1");
    },
    icon: <Copy size={16} />,
    onSelect: () => copy(org.name, uiText("organization.interface.community_name_0565934")),
  });
  if (prefs.builderMode)
    entries.push({
      get label() {
        return uiText("organization.interface.copy_community_id_289b51c");
      },
      icon: <IdCard size={16} />,
      onSelect: () => copy(org.id, uiText("organization.interface.community_id_bb74b67")),
    });
  entries.push(
    "separator",
    org.myRole === "OWNER"
      ? {
          get label() {
            return uiText("organization.interface.delete_community_755eaba");
          },
          icon: <Trash2 size={16} />,
          danger: true,
          onSelect: () => setDialog("delete"),
        }
      : {
          get label() {
            return uiText("organization.interface.leave_community_81e6498");
          },
          icon: <LogOut size={16} />,
          danger: true,
          onSelect: () => setDialog("leave"),
        },
  );
  const close = () => setDialog(null);
  const dialogs = (
    <>
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
  if (muted !== null)
    return {
      get label() {
        return uiText("organization.interface.unmute_community_5483b7f");
      },
      icon: <Bell size={16} />,
      hint: untilHint(muted),
      onSelect: () => change({ op: "community", mutedUntil: null }),
    };
  return {
    get label() {
      return uiText("organization.interface.mute_community_eee6e5a");
    },
    icon: <BellOff size={16} />,
    submenu: MUTE_CHOICES.map((m) => ({ label: m.label, onSelect: () => change({ op: "community", mutedUntil: m.ms === null ? MUTE_FOREVER : Date.now() + m.ms }) })),
  };
}
