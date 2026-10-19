import { useEffect, useMemo, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../app/orbit";
import { setPrefs, usePrefs } from "../../app/prefs";
import { navigate, useRoute } from "../../app/router";
import { ConversationView } from "../chat/ConversationView";
import { SidePanel } from "../chat/SidePanel";
import { CallLayer } from "../call/CallLayer";
import { ChannelBrowser } from "../dialogs/ChannelBrowser";
import { IdentityReview } from "../dialogs/IdentityReview";
import { NewMessageDialog } from "../dialogs/NewMessageDialog";
import { SearchDialog } from "../dialogs/SearchDialog";
import { SettingsView } from "../settings/SettingsView";
import { ActivityView } from "../views/ActivityView";
import { HomeView } from "../views/HomeView";
import { Notices } from "./Notices";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

export type ShellDialog = { kind: "search" } | { kind: "new" } | { kind: "channels" } | { kind: "identity"; userId: string } | null;

/**
 * The signed-in frame: workspace rail, top bar, sidebar, the main column and an optional side panel; on phones a single
 * column with a bottom tab bar. Keyboard: ⌘/Ctrl+K search, Alt+↑/↓ previous or next conversation, Esc closes overlays.
 */
export function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const engine = useEngine();
  const route = useRoute();
  const prefs = usePrefs();
  const orgIds = useOrbit((s) => s.orgs.map((o) => o.id), shallowEqual);
  const known = useOrbit((s) => (route.conversationId ? !!s.conversations[route.conversationId] : true));
  const synced = useOrbit((s) => s.synced);
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState<ShellDialog>(null);

  const orgId = prefs.orgId && orgIds.includes(prefs.orgId) ? prefs.orgId : (orgIds[0] ?? null);
  useEffect(() => {
    if (orgId !== prefs.orgId && synced) setPrefs({ orgId });
  }, [orgId, prefs.orgId, synced]);

  // The conversation on screen (marks it read; new messages there don't count as unread while the window has focus).
  useEffect(() => {
    void engine.openConversation(route.section === "settings" ? null : route.conversationId);
    setDrawer(false);
  }, [engine, route.conversationId, route.section]);

  // A conversation this account can no longer see (removed, or another workspace's link) closes.
  useEffect(() => {
    if (synced && route.conversationId && !known) {
      engine.notice("info", "That conversation isn't available to you.");
      navigate({ section: route.section === "settings" ? "home" : route.section }, true);
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
        if (next) navigate({ section: route.section === "settings" ? "home" : route.section, conversationId: next });
      } else if (e.key === "Escape" && drawer) setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, route, drawer]);

  const section = route.section;
  const settings = section === "settings";
  const phoneList = !route.conversationId && (section === "home" || section === "dms");
  const ctx = useMemo(() => ({ open: (d: ShellDialog) => setDialog(d) }), []);

  let main;
  if (settings) main = <SettingsView page={route.settingsPage} onSignedOut={onSignedOut} />;
  else if (route.conversationId && known) main = <ConversationView key={route.conversationId} id={route.conversationId} route={route} onDialog={ctx.open} />;
  else if (section === "activity") main = <ActivityView orgId={orgId} />;
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
      {dialog?.kind === "new" && <NewMessageDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === "channels" && orgId && <ChannelBrowser orgId={orgId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "identity" && <IdentityReview userId={dialog.userId} onClose={() => setDialog(null)} />}
    </div>
  );
}
