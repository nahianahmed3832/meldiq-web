import { byActivity, markAllReadTargets, unreadOf } from "../selectors";
import { actionFor, comboOf } from "../../application/shortcuts";
import { ShortcutsDialog } from "../dialogs/ShortcutsDialog";
import { usePushToTalk } from "../call/usePushToTalk";
import { quietContextMenu } from "../components/Overlay";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { getPrefs, setPrefs, usePrefs } from "../../application/prefs";
import { isFullPage, navigate, useRoute } from "../../application/router";
import { ConversationView } from "../chat/ConversationView";
import { SidePanel } from "../chat/SidePanel";
import { DockedPeoplePanel } from "../chat/PeoplePanels";
import { CallLayer } from "../call/CallLayer";
import { INVITE_EVENT } from "../call/callShared";
import { ChannelBrowser } from "../dialogs/ChannelBrowser";
import { IdentityReview } from "../dialogs/IdentityReview";
import { NewGroupDialog } from "../dialogs/NewGroupDialog";
import { NewMessageDialog } from "../dialogs/NewMessageDialog";
import { CreateWorkspaceDialog, JoinWorkspaceDialog } from "../dialogs/WorkspaceDialogs";
import { SearchDialog } from "../dialogs/SearchDialog";
import { CreateCommunityDialog } from "../community/CreateCommunityDialog";
import { JOIN_INVITE_EVENT, openInApp } from "../chat/inAppLinks";
import { noteGuideVisit } from "../../sync/guide";
import { GUIDE_EVENT } from "../community/GuideOnboarding";
import { OPEN_PROFILE_EVENT, ProfileDialog, type ProfileRequest } from "../people/ProfileDialog";
import { ConnectionRequestWatcher } from "../people/ConnectionRequestViews";
import { ConnectionsDialog, MessageRequestsDialog } from "../people/ConnectionsDialog";
import { ActivityView } from "../views/ActivityView";
import { DiscoverView } from "../views/DiscoverView";
import { FriendsView } from "../views/FriendsView";
import { LaterView } from "../later/LaterView";
import { HomeView } from "../views/HomeView";
import { Notices } from "./Notices";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import { ConnectionBanner } from "./ConnectionBanner";
import { TabIndicators } from "./TabIndicators";
import { AddMembersDialog } from "../workspace/AddMembersDialog";
import { takePendingInvite, takePendingMessage } from "../../application/pendingInvite";
import { type DiscordReturn, takeDiscordReturn } from "../../application/discordReturn";
import { accountSelection, rememberSelection } from "../../sync/workspaceSelection";

const SettingsView = lazy(() => import("../settings/SettingsView").then((m) => ({ default: m.SettingsView })));
const WorkspaceView = lazy(() => import("../workspace/WorkspaceView").then((m) => ({ default: m.WorkspaceView })));

export type ShellDialog =
  | { kind: "search" }
  | { kind: "new" }
  | { kind: "newGroup" }
  | { kind: "channels" }
  | { kind: "identity"; userId: string }
  | { kind: "createWorkspace"; discord?: DiscordReturn | null }
  | { kind: "joinWorkspace"; code?: string }
  | { kind: "connections" }
  | { kind: "requests" }
  | { kind: "addMembers"; orgId?: string }
  | { kind: "shortcuts" }
  | null;

/**
 * The signed-in frame: workspace rail, top bar, sidebar, the main column and an optional side panel; on phones a single
 * column with a bottom tab bar. Keyboard: ⌘/Ctrl+K search, Alt+↑/↓ previous or next conversation, Esc closes overlays.
 */
export function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const engine = useEngine();
  const route = useRoute();
  const prefs = usePrefs();
  const orgIds = useOrbit((s) => s.orgs.map((o) => o.id), shallowEqual);
  const communities = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const known = useOrbit((s) => (route.conversationId ? !!s.conversations[route.conversationId] : true));
  const synced = useOrbit((s) => s.synced);
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState<ShellDialog>(null);
  usePushToTalk();

  const orgId = prefs.orgId && orgIds.includes(prefs.orgId) ? prefs.orgId : (orgIds[0] ?? null);
  const orgName = useOrbit((s) => s.orgs.find((o) => o.id === orgId)?.name ?? "");
  const orgs = useOrbit((s) => s.orgs, shallowEqual);
  useEffect(() => {
    if (orgId !== prefs.orgId && synced) setPrefs({ orgId });
  }, [orgId, prefs.orgId, synced]);

  // The account's selected workspace, shared with the phone (PUT /v2/account/preferences): adopted once when the app
  // opens, then every switch made here is saved for the other devices. Best effort: if either call fails, this browser
  // keeps its own choice and nothing else is affected.
  const adopted = useRef(false);
  const saved = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!synced || adopted.current) return;
    adopted.current = true;
    accountSelection(engine)
      .then((id) => {
        if (id && orgIds.includes(id) && id !== getPrefs().orgId) setPrefs({ orgId: id });
      })
      .catch(() => undefined);
  }, [synced, engine, orgIds]);
  useEffect(() => {
    if (!synced || !adopted.current) return;
    if (saved.current === undefined || saved.current === orgId) {
      saved.current ??= orgId;
      return;
    }
    saved.current = orgId;
    rememberSelection(engine, orgId).catch(() => undefined);
  }, [orgId, synced, engine]);

  // The conversation on screen (marks it read; new messages there don't count as unread while the window has focus).
  useEffect(() => {
    void engine.openConversation(isFullPage(route.section) ? null : route.conversationId);
    setDrawer(false);
    // Batch B8b: opening a channel ticks the community guide's tasks that point to it (kept on this browser).
    const c = route.conversationId ? engine.state.get().conversations[route.conversationId] : null;
    const guide = c?.orgId ? (engine.state.get().orgs.find((o) => o.id === c.orgId)?.guide ?? null) : null;
    if (c?.orgId && guide) void noteGuideVisit(engine.store, c.orgId, guide, c.id).then((changed) => changed && window.dispatchEvent(new Event(GUIDE_EVENT)));
  }, [engine, route.conversationId, route.section]);

  // A conversation this account can no longer see (removed, or another workspace's link) closes.
  useEffect(() => {
    if (synced && route.conversationId && !known) {
      engine.notice("info", "That conversation isn't available to you.");
      navigate({ section: isFullPage(route.section) ? "home" : route.section }, true);
    }
  }, [synced, known, route.conversationId, route.section, engine]);

  // Someone's profile, opened from a name or a member list anywhere.
  const [profile, setProfile] = useState<ProfileRequest | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<ProfileRequest>).detail;
      if (d?.userId) setProfile({ ...d, name: d.name ?? "Profile" });
    };
    window.addEventListener(OPEN_PROFILE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, onOpen);
  }, []);

  // An invitation link opened in this tab (/join/<code>, kept through signing in): Join with its preview, once.
  useEffect(() => {
    if (!synced) return;
    const code = takePendingInvite();
    if (code) return setDialog({ kind: "joinWorkspace", code });
    // A message link opened in this tab (/m/<conversation>/<message>): that conversation, at that message.
    const message = takePendingMessage();
    if (message) openInApp(engine, `${location.origin}${message}`);
    // Back from Discord after adding Meldiq's bot (or cancelling): the import picks up where it left off.
    const discord = takeDiscordReturn();
    if (discord) setDialog({ kind: "createWorkspace", discord });
  }, [synced, engine]);

  // Invite people from a call (ConnectedCallPanel, CallStage): the community's Invite dialog.
  useEffect(() => {
    const onInvite = (e: Event) => setDialog({ kind: "addMembers", orgId: String((e as CustomEvent).detail ?? "") || undefined });
    window.addEventListener(INVITE_EVENT, onInvite);
    return () => window.removeEventListener(INVITE_EVENT, onInvite);
  }, []);

  // An invite link clicked inside a chat opens Join with its code (batch B4b).
  useEffect(() => {
    const onInvite = (e: Event) => setDialog({ kind: "joinWorkspace", code: String((e as CustomEvent).detail ?? "") });
    window.addEventListener(JOIN_INVITE_EVENT, onInvite);
    return () => window.removeEventListener(JOIN_INVITE_EVENT, onInvite);
  }, []);

  useEffect(() => {
    const focus = () => engine.setFocused(document.visibilityState === "visible" && document.hasFocus());
    focus();
    window.addEventListener("focus", focus);
    window.addEventListener("blur", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [engine]);

  const order = useOrbit((s) => {
    const ids = Object.values(s.conversations)
      .filter((c) => c.orgId === null || c.orgId === orgId)
      .sort(byActivity(s))
      .map((c) => c.id);
    return ids;
  }, shallowEqual);

  const unread = useOrbit((s) => order.filter((id) => unreadOf(s, id) > 0), shallowEqual);
  const readTargets = useOrbit((s) => markAllReadTargets(s, orgId), shallowEqual);
  const inCall = useOrbit((s) => s.call.phase !== "idle");
  const connection = useOrbit((s) => s.connection);

  // Settings › Shortcuts (application/shortcuts.ts): the person's combinations, else the defaults.
  useEffect(() => {
    const go = (list: string[], delta: number) => {
      if (!list.length) return;
      const i = route.conversationId ? list.indexOf(route.conversationId) : -1;
      const next = i < 0 ? list[delta > 0 ? 0 : list.length - 1] : list[Math.max(0, Math.min(list.length - 1, i + delta))];
      if (next) navigate({ section: isFullPage(route.section) ? "home" : route.section, conversationId: next });
    };
    const onKey = (e: KeyboardEvent) => {
      const combo = comboOf(e);
      const action = combo ? actionFor(getPrefs().keybinds, combo) : null;
      if (!action) {
        if (e.key === "Escape" && drawer) setDrawer(false);
        return;
      }
      if ((action === "toggleMute" || action === "toggleDeafen") && !inCall) return;
      e.preventDefault();
      if (action === "search") setDialog({ kind: "search" });
      else if (action === "showShortcuts") setDialog({ kind: "shortcuts" });
      else if (action === "prevConversation" || action === "nextConversation") go(order, action === "nextConversation" ? 1 : -1);
      else if (action === "prevUnread" || action === "nextUnread")
        go(
          unread.filter((id) => id !== route.conversationId),
          action === "nextUnread" ? 1 : -1,
        );
      else if (action === "markCommunityRead") void Promise.all(readTargets.map((c) => engine.markRead(c)));
      else if (action === "toggleMute") void engine.calls.toggleMicrophone();
      else if (action === "toggleDeafen") void engine.calls.toggleDeafen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, unread, readTargets, inCall, route, drawer, engine]);

  const section = route.section;
  const settings = isFullPage(section);
  const phoneList = !route.conversationId && (section === "home" || section === "dms");
  // Phones (brief v4 §18, after the Android app): Home is the community rail beside the channels; the lists and a
  // conversation have their own headers, so the top bar steps aside there.
  const phoneFrame = `${phoneList && section === "home" ? " phone-home" : ""}${phoneList || section === "settings" || (route.conversationId && !settings) ? " phone-bare" : ""}`;
  const ctx = useMemo(() => ({ open: (d: ShellDialog) => setDialog(d) }), []);

  let main;
  if (section === "settings") main = <SettingsView page={route.settingsPage} onSignedOut={onSignedOut} />;
  else if (section === "workspace") main = <WorkspaceView orgId={orgId} page={route.workspacePage} onDialog={ctx.open} />;
  // Settings and administration load on first use, keeping the first page load small.
  if (settings) main = <Suspense fallback={<section className="main" aria-busy="true" />}>{main}</Suspense>;
  else if (route.conversationId && known) main = <ConversationView key={route.conversationId} id={route.conversationId} route={route} onDialog={ctx.open} />;
  else if (section === "activity") main = <ActivityView orgId={orgId} />;
  else if (section === "later") main = <LaterView />;
  else if (section === "discover") main = <DiscoverView />;
  // The Messages home is Friends (2026-10-28, after the owner's reference), as is /friends.
  else if (section === "friends" || section === "dms") main = <FriendsView />;
  else main = <HomeView orgId={orgId} section={section} onDialog={ctx.open} />;

  return (
    <div className={`app${phoneFrame}`} data-connection={connection} onContextMenu={quietContextMenu}>
      <Rail orgId={orgId} section={section} onDialog={ctx.open} />
      {/* The floating frame: the top bar for where you are and search, then the panels floating below it. */}
      <div className={`workspace${settings ? "" : " with-sidebar"}`}>
        <TopBar onMenu={() => setDrawer((d) => !d)} onSearch={() => setDialog({ kind: "search" })} section={section} orgId={orgId} />
        <ConnectionBanner />
        <div className={`body${route.conversationId ? " has-conversation" : ""}${phoneList ? " phone-list" : " phone-main"}${settings ? " settings-mode" : ""}`}>
          {!settings && <Sidebar orgId={orgId} section={section === "discover" || section === "friends" ? "dms" : section} open={drawer} onDialog={ctx.open} />}
          {drawer && !settings && <div className="sidebar-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}
          {main}
          {!settings && route.conversationId && known && route.panel && <SidePanel route={route} />}
          {!settings && route.conversationId && known && !route.panel && <DockedPeoplePanel conversationId={route.conversationId} route={route} />}
        </div>
      </div>
      <TabBar section={section} hidden={!!route.conversationId && !settings} />
      <Notices />
      <TabIndicators />
      <ConnectionRequestWatcher />
      <CallLayer />
      {dialog?.kind === "search" && <SearchDialog orgId={orgId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "new" && <NewMessageDialog onClose={() => setDialog(null)} onNewGroup={() => setDialog({ kind: "newGroup" })} />}
      {dialog?.kind === "channels" && orgId && <ChannelBrowser orgId={orgId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "identity" && <IdentityReview userId={dialog.userId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "newGroup" && <NewGroupDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "createWorkspace" &&
        (communities ? <CreateCommunityDialog discord={dialog.discord ?? null} onClose={() => setDialog(null)} /> : <CreateWorkspaceDialog onClose={() => setDialog(null)} />)}
      {dialog?.kind === "connections" && <ConnectionsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "requests" && <MessageRequestsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "addMembers" && (dialog.orgId ?? orgId) && (
        <AddMembersDialog orgId={(dialog.orgId ?? orgId)!} orgName={orgs.find((o) => o.id === (dialog.orgId ?? orgId))?.name ?? orgName} onClose={() => setDialog(null)} onAdded={() => undefined} />
      )}
      {profile && (
        <ProfileDialog
          key={profile.userId}
          userId={profile.userId}
          fallbackName={profile.name ?? "Profile"}
          orgId={profile.orgId ?? null}
          near={profile.near ?? null}
          onClose={() => setProfile(null)}
        />
      )}
      {dialog?.kind === "joinWorkspace" && <JoinWorkspaceDialog initialCode={dialog.code} onClose={() => setDialog(null)} />}
    </div>
  );
}
