import Router from "next/router";
import { hasUnsavedChanges, requestNavigation } from "./navigationGuard";
import { useSyncExternalStore } from "react";
import { numericConversationPath, parseNumericConversationPath, type ConversationPanel, type ConversationSection } from "./conversationPaths";
import { encodeLinkId, LEGACY_LINK_ID } from "./linkIds";

/**
 * The app's routes, as paths (Next.js serves the one client-side page for every path; docs/MELDIQ_WEB_NEXTJS.md):
 *   /home  /dms  /activity  /later  /discover    the sections (Later: saved messages and reminders; Discover: public communities)
 *   /lobby                                     the selected community's lobby (community parity B)
 *   /channels/<community>/<channel>, /dms/<id>  a conversation, optionally followed by a panel or thread
 *   /settings/<page>
 *   /workspace/<page>                          the current workspace's settings and administration
 *   /oauth/authorize?client_id=…               "Log in with Meldiq": an app asks to know who you are (API 0.65.0 batch B)
 * Links from before (hash routes, "/#/dms/c/<id>": old notifications, bookmarks, links in messages) still work: the
 * page moves them to their path on load. Moving around is the History API, so Back and Forward work and nothing reloads.
 */
/** "friends" (2026-10-28): the Friends page, the Messages home on its own route (phones open it from the list). */
/** "lobby" (community parity B): the selected community's lobby, its front page. */
export type Section = ConversationSection | "settings" | "workspace" | "oauth";
/** "you": the phone's You tab, a list of the pages under your account card (desktop shows the profile page there). */
export type SettingsPage =
  | "you"
  | "profile"
  | "account"
  | "devices"
  | "notifications"
  | "calls"
  | "appearance"
  | "accessibility"
  | "language"
  | "storage"
  | "security"
  | "about"
  | "advanced"
  | "shortcuts"
  | "health"
  | "usage"
  | "checkout"
  | "gifts"
  | "billing"
  | "mojo"
  | "spark"
  | "leaderboards"
  | "points"
  | "creators"
  | "developer";
export type WorkspacePage =
  | "overview"
  | "people"
  | "invitations"
  | "channels"
  | "roles"
  | "audit"
  | "usage"
  | "meetings"
  // API 0.64.0: the community's own profile pins.
  | "pins"
  // Communities (batches B4–B9).
  | "applications"
  | "reports"
  | "security"
  | "bans"
  | "guide"
  | "onboarding"
  | "expressions"
  | "stickers"
  | "partner"
  | "ping-roles"
  // API 0.65.0 batch B: bots added to the community.
  | "bots"
  // API 0.65.0: the rules channel and the community's rules.
  | "rules"
  // Community parity batch A (docs/MELDIQ_COMMUNITY_PARITY.md): the settings window's Theme, Sparks and Promote.
  | "theme"
  | "sparks"
  | "promote"
  // Community parity batch B: the lobby's settings (community-lobby).
  | "lobby"
  | "discovery"
  | "integrations"
  | "notifications";

export interface Route {
  section: Section;
  communityId: string | null;
  conversationId: string | null;
  panel: ConversationPanel | null;
  threadRoot: string | null;
  settingsPage: SettingsPage;
  workspacePage: WorkspacePage;
}

/** Sections that take the whole page (no conversation list). */
export const isFullPage = (s: Section): boolean => s === "settings" || s === "workspace";

const SECTIONS: Section[] = ["home", "dms", "friends", "activity", "later", "discover", "settings", "workspace", "oauth", "lobby"];
const PAGES: SettingsPage[] = [
  "you",
  "profile",
  "account",
  "devices",
  "notifications",
  "calls",
  "appearance",
  "accessibility",
  "language",
  "storage",
  "security",
  "about",
  "advanced",
  "shortcuts",
  "health",
  "usage",
  "checkout",
  "gifts",
  "billing",
  "mojo",
  "spark",
  // API 0.65.0: points, quests and levels.
  "points",
  "leaderboards",
  // API 0.65.0 batch B: the creator programme; bots and "Log in with Meldiq" apps.
  "creators",
  "developer",
];
const WORKSPACE_PAGES: WorkspacePage[] = [
  "pins",
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
  "stickers",
  "partner",
  "ping-roles",
  "bots",
  "rules",
  "theme",
  "sparks",
  "promote",
  "lobby",
  "discovery",
  "integrations",
  "notifications",
];
const ID = new RegExp(`^${LEGACY_LINK_ID}$`);

/** Route IDs always use the values understood by the API and local store. */
export function parseRoute(where: string): Route {
  const path = where.replace(/^#/, "").split(/[?#]/)[0];
  const parts = path
    .split("/")
    .filter(Boolean)
    .map(safeDecode);
  const section = SECTIONS.includes(parts[0] as Section) ? (parts[0] as Section) : "home";
  const route: Route = { section, communityId: null, conversationId: null, panel: null, threadRoot: null, settingsPage: "profile", workspacePage: "overview" };
  const numeric = parseNumericConversationPath(path);
  if (numeric) return { ...route, ...numeric };
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
  if (r.section === "oauth") return "/oauth/authorize";
  let h = `/${r.section}`;
  if (r.conversationId) {
    h = numericConversationPath(r.section, r.conversationId, r.communityId);
    if (r.panel === "thread") {
      if (r.threadRoot) h += `/thread/${encodeLinkId(r.threadRoot)}`;
    } else if (r.panel) h += `/${r.panel}`;
  }
  return h;
}

export const ROUTE_EVENT = "meldiq:route";
/** History entries this app made (Next.js's own router leaves entries without its marker alone). */
const STATE = { meldiq: 1 };
let historyIndex = 0;

export function navigate(r: Partial<Route> & { section: Section }, replace = false): void {
  // Opening or closing a panel in the same channel keeps its community in the URL.
  const current = snapshot();
  const communityId = r.communityId ?? (r.conversationId === current.conversationId ? current.communityId : null);
  go(routeHref({ ...r, communityId }), replace);
}

/** Goes to a path of this app (a link, a notification): history, then the screens follow. */
export function go(href: string, replace = false): void {
  if (`${location.pathname}${location.search}` === href && !location.hash) return;
  requestNavigation(() => {
    if (!replace) historyIndex += 1;
    const state = { ...STATE, meldiqIndex: historyIndex };
    if (replace) history.replaceState(state, "", href);
    else history.pushState(state, "", href);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  });
}

/** Rewrites an equivalent route without adding history or interrupting an open draft. */
export function replaceRoutePath(href: string): void {
  if (location.pathname === href) return;
  history.replaceState(history.state, "", `${href}${location.search}${location.hash}`);
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
  const numeric = parseNumericConversationPath(where);
  if (numeric) return where.replace(/\/$/, "");
  if (!/^\/[A-Za-z0-9/_%-]{0,300}$/.test(where)) return null;
  const section = where.split("/")[1];
  // The consent page carries its request in the query, which an in-page move would drop: the browser loads it.
  if (section === "oauth") return null;
  if (where === "/settings/gifts" && /^#gift=[A-Za-z0-9_-]{43}$/.test(u.hash)) return where + u.hash;
  if (!SECTIONS.includes(section as Section)) return null;
  if (/^\/(dms|activity|later|friends|discover|lobby)\/\d/.test(where)) return null;
  return routeHref(parseRoute(where));
}

/**
 * Once, at start: an old hash route becomes its path (at load, and if one is opened later), and clicks on links to this
 * app's paths move within the page instead of loading it again (modifier keys, other targets and downloads keep the browser's own behaviour).
 */
export function startRouting(): () => void {
  historyIndex = typeof history.state?.meldiqIndex === "number" ? history.state.meldiqIndex : 0;
  history.replaceState({ ...STATE, meldiqIndex: historyIndex }, "");
  let restoring = false;
  let replaying = false;
  // Restore the current history entry while a draft confirmation is open. Discard replays the original Back/Forward
  // movement, preserving the history stack instead of manufacturing replacement entries.
  const onPop = (event: PopStateEvent) => {
    const index: unknown = event.state?.meldiqIndex;
    if (typeof index !== "number") return;
    if (restoring) {
      restoring = false;
      event.stopImmediatePropagation();
      return;
    }
    if (replaying) {
      replaying = false;
      historyIndex = index;
      return;
    }
    const delta = historyIndex - index;
    if (!delta || !hasUnsavedChanges()) {
      historyIndex = index;
      return;
    }
    event.stopImmediatePropagation();
    restoring = true;
    history.go(delta);
    requestNavigation(() => {
      replaying = true;
      history.go(-delta);
    });
  };
  window.addEventListener("popstate", onPop, true);
  // The message viewport owns its position after data renders, including Back/Forward and reload.
  const scrollRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  const legacy = () => {
    if (location.hash.startsWith("#/")) go(appHref(location.hash) ?? "/home", true);
    else if (/^\/[a-z]+\/c\//.test(location.pathname)) {
      const route = parseRoute(location.pathname);
      if (route.conversationId) replaceRoutePath(routeHref(route));
    }
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
    window.removeEventListener("popstate", onPop, true);
    history.scrollRestoration = scrollRestoration;
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
