import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { getPrefs, setPrefs, usePrefs } from "../../app/prefs";
import { isFullPage, navigate, useRoute } from "../../app/router";
import { ConversationView } from "../chat/ConversationView";
import { SidePanel } from "../chat/SidePanel";
import { CallLayer } from "../call/CallLayer";
import { ChannelBrowser } from "../dialogs/ChannelBrowser";
import { IdentityReview } from "../dialogs/IdentityReview";
import { NewGroupDialog } from "../dialogs/NewGroupDialog";
import { NewMessageDialog } from "../dialogs/NewMessageDialog";
import { CreateWorkspaceDialog, JoinWorkspaceDialog } from "../dialogs/WorkspaceDialogs";
import { SearchDialog } from "../dialogs/SearchDialog";
import { CreateCommunityDialog } from "../community/CreateCommunityDialog";
import { DiscoverDialog } from "../community/DiscoverDialog";
import { ActivityView } from "../views/ActivityView";
import { LaterView } from "../later/LaterView";
import { HomeView } from "../views/HomeView";
import { Notices } from "./Notices";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import { accountSelection, rememberSelection } from "../../sync/workspaceSelection";

const SettingsView = lazy(() => import("../settings/SettingsView").then((m) => ({ default: m.SettingsView })));
const WorkspaceView = lazy(() => import("../workspace/WorkspaceView").then((m) => ({ default: m.WorkspaceView })));

export type ShellDialog =
  | { kind: "search" }
  | { kind: "new" }
  | { kind: "newGroup" }
  | { kind: "channels" }
  | { kind: "identity"; userId: string }
  | { kind: "createWorkspace" }
  | { kind: "joinWorkspace" }
  | { kind: "discover" }
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

  const orgId = prefs.orgId && orgIds.includes(prefs.orgId) ? prefs.orgId : (orgIds[0] ?? null);
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
  }, [engine, route.conversationId, route.section]);

  // A conversation this account can no longer see (removed, or another workspace's link) closes.
  useEffect(() => {
    if (synced && route.conversationId && !known) {
      engine.notice("info", "That conversation isn't available to you.");
      navigate({ section: isFullPage(route.section) ? "home" : route.section }, true);
    }
  }, [synced, known, route.conversationId, route.section, engine]);

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
      .sort((a, b) => (s.local[b.id]?.lastActivityAt ?? b.createdAt) - (s.local[a.id]?.lastActivityAt ?? a.createdAt))
      .map((c) => c.id);
    return ids;
  }, shallowEqual);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDialog({ kind: "search" });
      } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && order.length) {
        e.preventDefault();
        const i = route.conversationId ? order.indexOf(route.conversationId) : -1;
        const next = order[Math.max(0, Math.min(order.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
        if (next) navigate({ section: isFullPage(route.section) ? "home" : route.section, conversationId: next });
      } else if (e.key === "Escape" && drawer) setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, route, drawer]);

  const section = route.section;
  const settings = isFullPage(section);
  const phoneList = !route.conversationId && (section === "home" || section === "dms");
  const ctx = useMemo(() => ({ open: (d: ShellDialog) => setDialog(d) }), []);

  let main;
  if (section === "settings") main = <SettingsView page={route.settingsPage} onSignedOut={onSignedOut} />;
  else if (section === "workspace") main = <WorkspaceView orgId={orgId} page={route.workspacePage} itemId={route.itemId} onDialog={ctx.open} />;
  // Settings and administration load on first use, keeping the first page load small.
  if (settings) main = <Suspense fallback={<section className="main" aria-busy="true" />}>{main}</Suspense>;
  else if (route.conversationId && known) main = <ConversationView key={route.conversationId} id={route.conversationId} route={route} onDialog={ctx.open} />;
  else if (section === "activity") main = <ActivityView orgId={orgId} />;
  else if (section === "later") main = <LaterView />;
  else main = <HomeView orgId={orgId} section={section} onDialog={ctx.open} />;

  return (
    <div className="app">
      <Rail orgId={orgId} section={section} />
      <div className="workspace">
        <TopBar onMenu={() => setDrawer((d) => !d)} onSearch={() => setDialog({ kind: "search" })} />
        <div className={`body${route.conversationId ? " has-conversation" : ""}${phoneList ? " phone-list" : " phone-main"}${settings ? " settings-mode" : ""}`}>
          {!settings && <Sidebar orgId={orgId} section={section} open={drawer} onDialog={ctx.open} />}
          {drawer && !settings && <div className="sidebar-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />}
          {main}
          {!settings && route.conversationId && known && route.panel && <SidePanel route={route} />}
        </div>
      </div>
      <TabBar section={section} hidden={!!route.conversationId && !settings} />
      <Notices />
      <CallLayer />
      {dialog?.kind === "search" && <SearchDialog orgId={orgId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "new" && <NewMessageDialog onClose={() => setDialog(null)} onNewGroup={() => setDialog({ kind: "newGroup" })} />}
      {dialog?.kind === "channels" && orgId && <ChannelBrowser orgId={orgId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "identity" && <IdentityReview userId={dialog.userId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "newGroup" && <NewGroupDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "createWorkspace" && (communities ? <CreateCommunityDialog onClose={() => setDialog(null)} /> : <CreateWorkspaceDialog onClose={() => setDialog(null)} />)}
      {dialog?.kind === "discover" && <DiscoverDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "joinWorkspace" && <JoinWorkspaceDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
