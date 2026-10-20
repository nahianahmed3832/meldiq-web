import { useSyncExternalStore } from "react";

/**
 * Hash routes, so links survive reloads and Back works without a server route:
 *   #/home  #/dms  #/activity  #/later            the sections (Later: saved messages and reminders)
 *   #/<section>/c/<id>[/details|/search|/pinned|/thread/<root>]   a conversation (and its side panel)
 *   #/settings/<page>
 *   #/workspace/<page>                            the current workspace's settings and administration
 */
export type Section = "home" | "dms" | "activity" | "later" | "settings" | "workspace";
export type SettingsPage = "profile" | "account" | "devices" | "notifications" | "appearance" | "storage" | "security" | "about";
export type WorkspacePage = "overview" | "people" | "invitations" | "channels" | "structure" | "roles" | "apps" | "audit" | "usage";

export interface Route {
  section: Section;
  conversationId: string | null;
  panel: "details" | "thread" | "search" | "pinned" | null;
  threadRoot: string | null;
  settingsPage: SettingsPage;
  workspacePage: WorkspacePage;
}

/** Sections that take the whole page (no conversation list). */
export const isFullPage = (s: Section): boolean => s === "settings" || s === "workspace";

const SECTIONS: Section[] = ["home", "dms", "activity", "later", "settings", "workspace"];
const PAGES: SettingsPage[] = ["profile", "account", "devices", "notifications", "appearance", "storage", "security", "about"];
const WORKSPACE_PAGES: WorkspacePage[] = ["overview", "people", "invitations", "channels", "structure", "roles", "apps", "audit", "usage"];
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const section = SECTIONS.includes(parts[0] as Section) ? (parts[0] as Section) : "home";
  const route: Route = { section, conversationId: null, panel: null, threadRoot: null, settingsPage: "profile", workspacePage: "overview" };
  if (section === "settings") return { ...route, settingsPage: PAGES.includes(parts[1] as SettingsPage) ? (parts[1] as SettingsPage) : "profile" };
  if (section === "workspace") return { ...route, workspacePage: WORKSPACE_PAGES.includes(parts[1] as WorkspacePage) ? (parts[1] as WorkspacePage) : "overview" };
  if (parts[1] === "c" && parts[2] && ID.test(parts[2])) {
    route.conversationId = parts[2];
    if (parts[3] === "details") route.panel = "details";
    if (parts[3] === "search") route.panel = "search";
    if (parts[3] === "pinned") route.panel = "pinned";
    if (parts[3] === "thread" && parts[4] && ID.test(parts[4])) {
      route.panel = "thread";
      route.threadRoot = parts[4];
    }
  }
  return route;
}

export function routeHash(r: Partial<Route> & { section: Section }): string {
  if (r.section === "settings") return `#/settings/${r.settingsPage ?? "profile"}`;
  if (r.section === "workspace") return `#/workspace/${r.workspacePage ?? "overview"}`;
  let h = `#/${r.section}`;
  if (r.conversationId) {
    h += `/c/${encodeURIComponent(r.conversationId)}`;
    if (r.panel === "details") h += "/details";
    if (r.panel === "search") h += "/search";
    if (r.panel === "pinned") h += "/pinned";
    if (r.panel === "thread" && r.threadRoot) h += `/thread/${encodeURIComponent(r.threadRoot)}`;
  }
  return h;
}

export function navigate(r: Partial<Route> & { section: Section }, replace = false): void {
  const h = routeHash(r);
  if (location.hash === h) return;
  if (replace) history.replaceState(null, "", h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

let cached: { hash: string; route: Route } = { hash: "", route: parseRoute("") };

function snapshot(): Route {
  if (cached.hash !== location.hash) cached = { hash: location.hash, route: parseRoute(location.hash) };
  return cached.route;
}

export function useRoute(): Route {
  return useSyncExternalStore((l) => {
    window.addEventListener("hashchange", l);
    return () => window.removeEventListener("hashchange", l);
  }, snapshot);
}
