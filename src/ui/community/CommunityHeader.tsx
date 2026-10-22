import { ArrowUpDown, Bell, CalendarDays, Check, CheckCheck, ChevronDown, Compass, Copy, EyeOff, FolderPlus, LogIn, LogOut, PenSquare, Plus, Settings2, Ticket, UsersRound } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../../api/client";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { setPrefs, usePrefs } from "../../app/prefs";
import { navigate } from "../../app/router";
import { leaveWorkspace } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { members } from "../format";
import { markAllReadTargets } from "../selectors";
import type { ShellDialog } from "../shell/Shell";
import { CategoryNameDialog } from "./CategoryDialogs";
import { CreateChannelDialog } from "./ChannelDialogs";
import { ArrangeRailDialog, CommunityNotificationsDialog } from "./NotifyDialogs";
import { categoriesOf, orderedOrgs } from "./panelData";
import type { CommunityPermissions } from "./useCommunityPermissions";

type HeaderDialog = "notifications" | "channel" | "category" | "arrange" | "leave" | null;

/** The per-browser "Hide muted channels" switch for a community (android CommunityViewPrefs: this device only). */
export const hideMutedKey = (orgId: string) => `::hide-muted:${orgId}`;

/**
 * The community's header and its menu (android CommunityMenuSheet): switch community, invite, notification settings,
 * community settings, mark as read, create a channel or category, events, members, your view switches, arrange the rail,
 * discover, create or join a community, and leave. Each item shows only for people allowed to use it.
 */
export function CommunityHeader({ orgId, perms, onDialog }: { orgId: string | null; perms: CommunityPermissions; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const orgs = useOrbit((s) => orderedOrgs(s), shallowEqual);
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const readTargets = useOrbit((s) => markAllReadTargets(s, orgId), shallowEqual);
  const prefs = usePrefs();
  const menu = useMenu();
  const [dialog, setDialog] = useState<HeaderDialog>(null);
  const hideMuted = orgId ? prefs.collapsed.includes(hideMutedKey(orgId)) : false;

  const entries: MenuEntry[] = [
    { heading: "Your communities" },
    ...orgs.map((o) => ({
      label: o.name,
      icon: <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={22} />,
      checked: o.id === orgId,
      onSelect: () => setPrefs({ orgId: o.id }),
    })),
    ...(orgs.length === 0 ? [{ custom: <div className="side-quiet">You're not in a community yet.</div> }] : []),
    "separator",
  ];
  if (org && orgId) {
    if (perms.canInvite) entries.push({ label: "Invite people", icon: <Ticket size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "invitations" }) });
    if (features.includes("community-preferences")) entries.push({ label: "Notification settings…", icon: <Bell size={16} />, onSelect: () => setDialog("notifications") });
    entries.push({ label: "Community settings", icon: <Settings2 size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "overview" }) });
    if (readTargets.length > 0) entries.push({ label: "Mark all as read", icon: <CheckCheck size={16} />, onSelect: () => void Promise.all(readTargets.map((cid) => engine.markRead(cid))) });
    if (perms.canCreateChannels) entries.push({ label: "Create channel…", icon: <PenSquare size={16} />, onSelect: () => setDialog("channel") });
    if (perms.canCreateTop) entries.push({ label: "Create category…", icon: <FolderPlus size={16} />, onSelect: () => setDialog("category") });
    if (features.includes("meetings")) entries.push({ label: "Events", icon: <CalendarDays size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "meetings" }) });
    entries.push({ label: "Members", icon: <UsersRound size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "people" }) });
    entries.push("separator");
    entries.push({
      label: "Hide muted channels",
      icon: hideMuted ? <Check size={16} /> : <EyeOff size={16} />,
      checked: hideMuted,
      onSelect: () => setPrefs({ collapsed: hideMuted ? prefs.collapsed.filter((k) => k !== hideMutedKey(orgId)) : [...prefs.collapsed, hideMutedKey(orgId)] }),
    });
    entries.push({
      label: "Copy name",
      icon: <Copy size={16} />,
      onSelect: () => {
        void navigator.clipboard?.writeText(org.name).catch(() => undefined);
        engine.notice("info", "Community name copied.");
      },
    });
  }
  if (orgs.length > 1 && features.includes("community-preferences")) entries.push({ label: "Arrange communities…", icon: <ArrowUpDown size={16} />, onSelect: () => setDialog("arrange") });
  entries.push("separator");
  if (features.includes("community-discovery")) entries.push({ label: "Discover communities", icon: <Compass size={16} />, onSelect: () => onDialog({ kind: "discover" }) });
  entries.push({ label: "Start a community", icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) });
  entries.push({ label: "Join with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) });
  if (org && org.myRole !== "OWNER") entries.push("separator", { label: "Leave community…", icon: <LogOut size={16} />, danger: true, onSelect: () => setDialog("leave") });

  return (
    <>
      <button className="org-switch" onClick={(e) => menu.open(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!menu.anchor} aria-label={`Community: ${org?.name ?? "none"}. Community menu`}>
        {org ? <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={34} /> : <Avatar name="Meldiq" colorIndex={7} size={34} square decorative />}
        <span className="grow">
          <strong className="ellipsis" style={{ display: "block" }}>
            {org?.name ?? "Meldiq"}
          </strong>
          <small>{org ? `${members(org.memberCount)}${org.visibility === "public" ? " · Public" : ""}` : "No community yet"}</small>
        </span>
        <ChevronDown size={16} className="faint" />
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} label="Community" onClose={menu.close} entries={entries} />}
      {dialog === "notifications" && org && <CommunityNotificationsDialog orgId={org.id} name={org.name} onClose={() => setDialog(null)} />}
      {dialog === "channel" && org && <CreateChannelDialog orgId={org.id} categories={categories} categoryId={null} canCreateTop={perms.canCreateTop} onClose={() => setDialog(null)} />}
      {dialog === "category" && org && <CategoryNameDialog orgId={org.id} category={null} onClose={() => setDialog(null)} />}
      {dialog === "arrange" && <ArrangeRailDialog onClose={() => setDialog(null)} />}
      {dialog === "leave" && org && <LeaveDialog orgId={org.id} name={org.name} onClose={() => setDialog(null)} />}
    </>
  );
}

function LeaveDialog({ orgId, name, onClose }: { orgId: string; name: string; onClose: () => void }) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title={`Leave ${name}?`} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>You'll leave all its channels. You can come back with a new invitation, or from Discover if it's open.</p>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              leaveWorkspace(engine, orgId)
                .then(() => {
                  engine.notice("info", `You left ${name}.`);
                  onClose();
                  navigate({ section: "home" }, true);
                })
                .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't leave the community."))
                .finally(() => setBusy(false));
            }}
          >
            <LogOut size={15} /> Leave community
          </button>
        </div>
      </div>
    </Dialog>
  );
}
