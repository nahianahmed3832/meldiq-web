import Router from "next/router";
import { useSyncExternalStore } from "react";

/**
 * The app's routes, as paths (Next.js serves the one client-side page for every path; docs/MELDIQ_WEB_NEXTJS.md):
 *   /home  /dms  /activity  /later              the sections (Later: saved messages and reminders)
 *   /<section>/c/<id>[/details|/search|/pinned|/members|/thread/<root>]   a conversation (and its side panel)
 *   /settings/<page>
 *   /workspace/<page>                          the current workspace's settings and administration
 * Links from before (hash routes, "/#/dms/c/<id>": old notifications, bookmarks, links in messages) still work: the
 * page moves them to their path on load. Moving around is the History API, so Back and Forward work and nothing reloads.
 */
export type Section = "home" | "dms" | "activity" | "later" | "settings" | "workspace";
export type SettingsPage = "profile" | "account" | "devices" | "notifications" | "calls" | "appearance" | "storage" | "security" | "about" | "health" | "usage";
export type WorkspacePage =
  | "overview"
  | "people"
  | "invitations"
  | "channels"
  | "roles"
  | "audit"
  | "usage"
  | "meetings"
  // Communities (batches B4–B9).
  | "applications"
  | "reports"
  | "security"
  | "bans"
  | "guide"
  | "onboarding"
  | "expressions"
  // AI Workforce (server docs/AI_WORKFORCE.md).
  | "agents";

export interface Route {
  section: Section;
  conversationId: string | null;
  panel: "details" | "thread" | "search" | "pinned" | "threads" | "members" | null;
  threadRoot: string | null;
  settingsPage: SettingsPage;
  workspacePage: WorkspacePage;
}

/** Sections that take the whole page (no conversation list). */
export const isFullPage = (s: Section): boolean => s === "settings" || s === "workspace";

const SECTIONS: Section[] = ["home", "dms", "activity", "later", "settings", "workspace"];
const PAGES: SettingsPage[] = ["profile", "account", "devices", "notifications", "calls", "appearance", "storage", "security", "about", "health", "usage"];
const WORKSPACE_PAGES: WorkspacePage[] = [
  "overview",
  "people",
  "invitations",
  "channels",
  "roles",
  "audit",
  "usage",
  "meetings",
  "applications",
  "reports",
  "security",
  "bans",
  "guide",
  "onboarding",
  "expressions",
  "agents",
];
const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** The route in a path ("/dms/c/<id>") or an old hash route ("#/dms/c/<id>"); anything else is Home. */
export function parseRoute(where: string): Route {
  const parts = where
    .replace(/^#?\/?/, "")
    .split(/[?#]/)[0]
    .split("/")
    .filter(Boolean)
    .map(safeDecode);
  const section = SECTIONS.includes(parts[0] as Section) ? (parts[0] as Section) : "home";
  const route: Route = { section, conversationId: null, panel: null, threadRoot: null, settingsPage: "profile", workspacePage: "overview" };
  if (section === "settings") return { ...route, settingsPage: PAGES.includes(parts[1] as SettingsPage) ? (parts[1] as SettingsPage) : "profile" };
  if (section === "workspace") return { ...route, workspacePage: WORKSPACE_PAGES.includes(parts[1] as WorkspacePage) ? (parts[1] as WorkspacePage) : "overview" };
  if (parts[1] === "c" && parts[2] && ID.test(parts[2])) {
    route.conversationId = parts[2];
    if (parts[3] === "details") route.panel = "details";
    if (parts[3] === "search") route.panel = "search";
    if (parts[3] === "pinned") route.panel = "pinned";
    if (parts[3] === "threads") route.panel = "threads";
    if (parts[3] === "members") route.panel = "members";
    if (parts[3] === "thread" && parts[4] && ID.test(parts[4])) {
      route.panel = "thread";
      route.threadRoot = parts[4];
    }
  }
  return route;
}

/** The path of a route, for links and history. */
export function routeHref(r: Partial<Route> & { section: Section }): string {
  if (r.section === "settings") return `/settings/${r.settingsPage ?? "profile"}`;
  if (r.section === "workspace") return `/workspace/${r.workspacePage ?? "overview"}`;
  let h = `/${r.section}`;
  if (r.conversationId) {
    h += `/c/${encodeURIComponent(r.conversationId)}`;
    if (r.panel === "details") h += "/details";
    if (r.panel === "search") h += "/search";
    if (r.panel === "pinned") h += "/pinned";
    if (r.panel === "threads") h += "/threads";
    if (r.panel === "members") h += "/members";
    if (r.panel === "thread" && r.threadRoot) h += `/thread/${encodeURIComponent(r.threadRoot)}`;
  }
  return h;
}

const ROUTE_EVENT = "meldiq:route";
/** History entries this app made (Next.js's own router leaves entries without its marker alone). */
const STATE = { meldiq: 1 };

export function navigate(r: Partial<Route> & { section: Section }, replace = false): void {
  go(routeHref(r), replace);
}

/** Goes to a path of this app (a link, a notification): history, then the screens follow. */
export function go(href: string, replace = false): void {
  if (`${location.pathname}${location.search}` === href && !location.hash) return;
  if (replace) history.replaceState(STATE, "", href);
  else history.pushState(STATE, "", href);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/** A path of this app from a link or notification, or null for anything else (another site, a file, a malformed one). */
export function appHref(raw: string, origin = location.origin): string | null {
  let u: URL;
  try {
    u = new URL(raw, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  const legacy = /^#\/[A-Za-z0-9/_%-]{0,300}$/.test(u.hash) && (u.pathname === "/" || u.pathname === "/index.html");
  const where = legacy ? u.hash.slice(1) : u.pathname;
  if (!/^\/[A-Za-z0-9/_%-]{0,300}$/.test(where)) return null;
  const section = where.split("/")[1];
  return SECTIONS.includes(section as Section) ? routeHref(parseRoute(where)) : null;
}

/**
 * Once, at start: an old hash route becomes its path (at load, and if one is opened later), and clicks on links to this
 * app's paths move within the page instead of loading it again (modifier keys, other targets and downloads keep the browser's own behaviour).
 */
export function startRouting(): () => void {
  const legacy = () => {
    if (location.hash.startsWith("#/")) go(appHref(location.hash) ?? "/home", true);
  };
  legacy();
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const href = appHref(a.getAttribute("href") ?? "");
    if (!href) return;
    e.preventDefault();
    go(href);
  };
  // Next.js itself may rewrite the address once while the page starts (in development, where it has rewrites): read
  // it again afterwards, so an old hash link it put back still becomes its path and the screens follow.
  const afterNext = () => {
    legacy();
    window.dispatchEvent(new Event(ROUTE_EVENT));
  };
  document.addEventListener("click", onClick);
  window.addEventListener("hashchange", legacy);
  Router.events.on("routeChangeComplete", afterNext);
  Router.events.on("hashChangeComplete", afterNext); // what it reports when only the "#…" part differs
  return () => {
    document.removeEventListener("click", onClick);
    window.removeEventListener("hashchange", legacy);
    Router.events.off("routeChangeComplete", afterNext);
    Router.events.off("hashChangeComplete", afterNext);
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

let cached: { at: string; route: Route } = { at: "", route: parseRoute("") };

function snapshot(): Route {
  const at = location.pathname;
  if (cached.at !== at) cached = { at, route: parseRoute(at) };
  return cached.route;
}

export function useRoute(): Route {
  return useSyncExternalStore((l) => {
    window.addEventListener("popstate", l);
    window.addEventListener(ROUTE_EVENT, l);
    return () => {
      window.removeEventListener("popstate", l);
      window.removeEventListener(ROUTE_EVENT, l);
    };
  }, snapshot);
}
