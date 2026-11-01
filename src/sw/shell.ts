/**
 * The app shell from the service worker (2026-10-29, the owner: "ours refreshes like a website"). A reload or a return
 * gets the page and its build files from this browser at once, as an installed app opens, and the page is fetched again
 * behind it for next time (stale-while-revalidate). New releases still arrive: each load stores the newest page, and
 * src/application/updates.ts puts a release it finds into the same cache before offering Reload. Only the app's own
 * page, its content-hashed build files and public/boot.js are kept: never the API, config.json, media or anything
 * personal. Release builds only: in development the worker leaves every request to the network.
 */
export const SHELL_CACHE = "meldiq-shell-v1";
export const ASSET_CACHE = "meldiq-assets-v1";
/** The one page every app path is served (deploy/nginx: try_files … /index.html). */
export const SHELL_KEY = "/";
/** Build files kept at most (the oldest go first): a few releases' worth, the current one's lazy screens included. */
export const MAX_ASSETS = 400;

/** The app's own routes, opened at their address (src/application/router.ts); a query (the consent page, an import) goes to the network. */
const SHELL_PATH = /^\/((home|lobby|dms|friends|activity|later|discover|settings|workspace)(\/[A-Za-z0-9_%-]{1,128}){0,4})?$/;
/** Small files that aren't content-hashed: served from the cache while the newest is fetched. */
const FRESHENED = new Set(["/boot.js"]);

export type Strategy = "shell" | "asset" | "fresh" | null;

/** How the worker answers a request: the shell, a build file, a freshened file, or the network as before (null). */
export function strategyFor(req: { method: string; mode: string; url: string }, origin: string): Strategy {
  if (req.method !== "GET") return null;
  let u: URL;
  try {
    u = new URL(req.url);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  if (req.mode === "navigate") return SHELL_PATH.test(u.pathname) && !u.search ? "shell" : null;
  if (u.pathname.startsWith("/_next/static/") && !u.search) return "asset";
  if (FRESHENED.has(u.pathname) && !u.search) return "fresh";
  return null;
}

/** The build files a page loads at start (its scripts and styles), to keep with it. */
export function assetsOf(html: string): string[] {
  return [...new Set([...html.matchAll(/["'](\/_next\/static\/[A-Za-z0-9_./~@%-]{1,300}\.(?:js|css))["']/g)].map((m) => m[1]))];
}

/** Whether [res] is the app's page, safe to keep and answer navigations with. */
export function isShellResponse(res: Response): boolean {
  return res.ok && res.type === "basic" && !res.redirected && (res.headers.get("content-type") ?? "").includes("text/html");
}

/** The part of a fetch event the shell needs. */
export interface FetchEventLike {
  request: Request;
  respondWith(r: Promise<Response>): void;
  waitUntil(p: Promise<unknown>): void;
}

interface ShellDeps {
  caches: CacheStorage;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  origin: string;
}

/** The worker's fetch listener (src/sw/sw.ts): answers what strategyFor picks, leaves the rest to the browser. */
export function shellHandler({ caches, fetch, origin }: ShellDeps): (e: FetchEventLike) => void {
  /** The page: the kept copy at once, fetched again for next time; the first time, from the network (and kept). */
  async function shell(e: FetchEventLike): Promise<Response> {
    const cache = await caches.open(SHELL_CACHE);
    const kept = await cache.match(SHELL_KEY);
    if (kept) {
      e.waitUntil(
        fetch(SHELL_KEY, { cache: "no-cache", credentials: "same-origin" }).then(
          (res) => keepShell(cache, res),
          () => undefined,
        ),
      );
      return kept;
    }
    const res = await fetch(e.request);
    e.waitUntil(keepShell(cache, res.clone()).catch(() => undefined));
    return res;
  }

  async function keepShell(cache: Cache, res: Response): Promise<void> {
    if (!isShellResponse(res)) return;
    const html = await res.clone().text();
    await cache.put(SHELL_KEY, res);
    await keepAssets(assetsOf(html));
  }

  /** The build files a kept page starts with, so it opens even when the server has moved on to another release. */
  async function keepAssets(urls: string[]): Promise<void> {
    const cache = await caches.open(ASSET_CACHE);
    for (const url of urls) if (!(await cache.match(url))) await cache.add(url).catch(() => undefined);
    await prune(cache);
  }

  /** Content-hashed build files never change: from the cache, else the network (then kept). */
  async function asset(e: FetchEventLike): Promise<Response> {
    const cache = await caches.open(ASSET_CACHE);
    const kept = await cache.match(e.request);
    if (kept) return kept;
    const res = await fetch(e.request);
    if (res.ok && res.type === "basic")
      e.waitUntil(
        cache.put(e.request, res.clone()).then(
          () => prune(cache),
          () => undefined,
        ),
      );
    return res;
  }

  /** A small file that can change (public/boot.js): the kept copy at once, the newest for next time. */
  async function freshened(e: FetchEventLike): Promise<Response> {
    const cache = await caches.open(SHELL_CACHE);
    const kept = await cache.match(e.request);
    const update = fetch(e.request, { cache: "no-cache" }).then(async (res) => {
      if (res.ok && res.type === "basic") await cache.put(e.request, res.clone());
      return res;
    });
    if (kept) {
      e.waitUntil(update.catch(() => undefined));
      return kept;
    }
    return update;
  }

  return (e) => {
    const how = strategyFor(e.request, origin);
    if (how === "shell") e.respondWith(shell(e));
    else if (how === "asset") e.respondWith(asset(e));
    else if (how === "fresh") e.respondWith(freshened(e));
  };
}

/** Keeps the build files to MAX_ASSETS, dropping the oldest (keys come back in the order they were added). */
async function prune(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(k);
}
