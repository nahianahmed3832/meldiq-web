import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, type Credentials } from "../src/api/client";
import { ASSET_CACHE, assetsOf, type FetchEventLike, isShellResponse, SHELL_CACHE, shellHandler, strategyFor } from "../src/sw/shell";

/**
 * The owner (2026-10-29): Discord and Yapin' reopen like apps on a reload or a return, Meldiq "refreshes like a website".
 * The pieces that make it open like an app: the service worker's app shell, the configuration kept from last time, the
 * place the person left, and a session restored once rather than swapped over and over.
 */
function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ORIGIN = "https://web.meldiq.app";
const nav = (path: string, method = "GET") => ({ method, mode: "navigate", url: ORIGIN + path });
const sub = (path: string, origin = ORIGIN) => ({ method: "GET", mode: "cors", url: origin + path });

describe("the app shell from the service worker", () => {
  it("answers opening the app's own routes with the kept page", () => {
    for (const p of ["/", "/home", "/lobby", "/home/c/c_abc", "/dms/c/c_1/thread/m_2", "/friends", "/settings/appearance", "/workspace/roles", "/discover"])
      expect(strategyFor(nav(p), ORIGIN)).toBe("shell");
  });

  it("leaves links with a query, other pages, the API and other methods to the network", () => {
    expect(strategyFor(nav("/oauth/authorize?client_id=x"), ORIGIN)).toBeNull();
    expect(strategyFor(nav("/?discord=1"), ORIGIN)).toBeNull();
    expect(strategyFor(nav("/invite/ABCDE"), ORIGIN)).toBeNull();
    expect(strategyFor(nav("/join/ABCDE"), ORIGIN)).toBeNull();
    expect(strategyFor(nav("/v1/users/me"), ORIGIN)).toBeNull();
    expect(strategyFor(nav("/meldiq-og.png"), ORIGIN)).toBeNull();
    expect(strategyFor(nav("/home", "POST"), ORIGIN)).toBeNull();
    expect(strategyFor(sub("/v1/conversations"), ORIGIN)).toBeNull();
    expect(strategyFor(sub("/config.json"), ORIGIN)).toBeNull();
    expect(strategyFor(sub("/_next/static/chunks/a.js", "https://elsewhere.example"), ORIGIN)).toBeNull();
  });

  it("keeps content-hashed build files, and freshens the boot script", () => {
    expect(strategyFor(sub("/_next/static/chunks/0d5ya8a476593.js"), ORIGIN)).toBe("asset");
    expect(strategyFor(sub("/_next/static/chunks/2om___zihiy9d.css"), ORIGIN)).toBe("asset");
    expect(strategyFor(sub("/boot.js"), ORIGIN)).toBe("fresh");
    expect(strategyFor(sub("/boot.js?x=1"), ORIGIN)).toBeNull();
  });

  it("reads the build files a page starts with", () => {
    const html = `<link rel="stylesheet" href="/_next/static/chunks/a.css"><script src="/_next/static/chunks/b-1.js" async=""></script><script src="/_next/static/abc/_buildManifest.js"></script><script src="/boot.js"></script><script src="/_next/static/chunks/b-1.js"></script>`;
    expect(assetsOf(html)).toEqual(["/_next/static/chunks/a.css", "/_next/static/chunks/b-1.js", "/_next/static/abc/_buildManifest.js"]);
  });

  it("keeps only the app's own page, never an error, a redirect or something else", () => {
    const page = (init: ResponseInit, type = "text/html; charset=utf-8") => new Response("<html>", { ...init, headers: { "content-type": type } });
    expect(isShellResponse(page({ status: 200 }))).toBe(false); // a constructed Response is "default", not a same-origin fetch
    const basic = (r: Response, redirected = false) => Object.defineProperties(r, { type: { value: "basic" }, redirected: { value: redirected } });
    expect(isShellResponse(basic(page({ status: 200 })))).toBe(true);
    expect(isShellResponse(basic(page({ status: 503 })))).toBe(false);
    expect(isShellResponse(basic(page({ status: 200 }), true))).toBe(false);
    expect(isShellResponse(basic(page({ status: 200 }, "application/json")))).toBe(false);
  });
});

/** CacheStorage in memory, as much as the shell uses. */
function memoryCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: RequestInfo | URL) => new URL(typeof r === "string" ? r : r instanceof URL ? r.href : r.url, ORIGIN).pathname;
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, m);
    return {
      match: async (r: RequestInfo | URL) => m.get(keyOf(r))?.clone(),
      put: async (r: RequestInfo | URL, res: Response) => void m.set(keyOf(r), res),
      add: async (r: RequestInfo | URL) => void m.set(keyOf(r), basic(new Response("asset"))),
      keys: async () => [...m.keys()].map((k) => new Request(ORIGIN + k)),
      delete: async (r: RequestInfo | URL) => m.delete(keyOf(r)),
    } as unknown as Cache;
  };
  return { caches: { open } as unknown as CacheStorage, stores };
}
/** A same-origin answer as fetch gives it ("basic"), clones included (a constructed Response is "default"). */
const basic = (r: Response): Response => {
  const clone = r.clone.bind(r);
  return Object.defineProperties(r, { type: { value: "basic" }, clone: { value: () => basic(clone()) } });
};
const page = (build: string) => basic(new Response(`<script src="/_next/static/chunks/${build}.js"></script>`, { headers: { "content-type": "text/html" } }));

/** Dispatches one fetch event to the handler; resolves with its answer (null: left to the browser) once its work is done. */
async function dispatch(onFetch: (e: FetchEventLike) => void, url: string, mode = "navigate"): Promise<string | null> {
  let answer: Promise<Response> | null = null;
  const work: Promise<unknown>[] = [];
  const request = Object.defineProperty(new Request(ORIGIN + url), "mode", { value: mode });
  onFetch({ request, respondWith: (r) => (answer = r), waitUntil: (p) => void work.push(p) });
  const text = answer ? await (await (answer as Promise<Response>)).text() : null;
  await Promise.all(work);
  return text;
}

describe("the service worker's fetch handling", () => {
  it("opens on the kept page at once and keeps the newest one for next time", async () => {
    const { caches, stores } = memoryCaches();
    let build = "one";
    const fetch = vi.fn(async (input: RequestInfo | URL) => (String(input instanceof Request ? input.url : input).includes("/_next/") ? basic(new Response("asset")) : page(build)));
    const onFetch = shellHandler({ caches, fetch, origin: ORIGIN });
    expect(await dispatch(onFetch, "/home/c/c_1")).toContain("one.js"); // the first time: the network, then kept
    expect([...stores.get(ASSET_CACHE)!.keys()]).toEqual(["/_next/static/chunks/one.js"]);
    build = "two";
    expect(await dispatch(onFetch, "/dms")).toContain("one.js"); // a release later: the kept page at once...
    expect(await dispatch(onFetch, "/dms")).toContain("two.js"); // ...and the new one the time after
    expect([...stores.get(ASSET_CACHE)!.keys()]).toEqual(["/_next/static/chunks/one.js", "/_next/static/chunks/two.js"]);
  });

  it("never keeps an error page, and leaves the API alone", async () => {
    const { caches, stores } = memoryCaches();
    const fetch = vi.fn(async () => basic(new Response("down", { status: 502, headers: { "content-type": "text/html" } })));
    const onFetch = shellHandler({ caches, fetch, origin: ORIGIN });
    expect(await dispatch(onFetch, "/home")).toBe("down");
    expect(stores.get(SHELL_CACHE)?.size ?? 0).toBe(0);
    expect(await dispatch(onFetch, "/v1/conversations", "cors")).toBeNull();
  });

  it("serves build files from the cache once fetched", async () => {
    const { caches } = memoryCaches();
    const fetch = vi.fn(async () => basic(new Response("chunk")));
    const onFetch = shellHandler({ caches, fetch, origin: ORIGIN });
    expect(await dispatch(onFetch, "/_next/static/chunks/a.js", "no-cors")).toBe("chunk");
    expect(await dispatch(onFetch, "/_next/static/chunks/a.js", "no-cors")).toBe("chunk");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("the configuration kept from last time", () => {
  const serve = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

  it("waits for config.json the first time, then starts at once on the kept copy while reading it again", async () => {
    vi.stubGlobal("localStorage", storage());
    const { apiBase, startConfig } = await import("../src/application/config");
    const first = serve({ apiBase: "https://api.example.test" });
    await startConfig(first);
    expect(apiBase()).toBe("https://api.example.test");

    let answer: (r: Response) => void = () => undefined;
    const slow = vi.fn(() => new Promise<Response>((r) => (answer = r))) as unknown as typeof fetch;
    await startConfig(slow); // resolves before the file answers
    expect(apiBase()).toBe("https://api.example.test");
    expect(slow).toHaveBeenCalledTimes(1);
    // A change is kept for the next start, not switched to under the running app.
    answer(new Response(JSON.stringify({ apiBase: "https://api2.example.test" }), { headers: { "content-type": "application/json" } }));
    await new Promise((r) => setTimeout(r, 0));
    expect(apiBase()).toBe("https://api.example.test");
    await startConfig(serve({}));
    expect(apiBase()).toBe("https://api2.example.test");
  });

  it("forgets the kept copy when the file turns out malformed, so the next start says what's wrong", async () => {
    const kept = storage();
    vi.stubGlobal("localStorage", kept);
    const { startConfig } = await import("../src/application/config");
    await startConfig(serve({}));
    await startConfig(serve({ apiBase: "http://insecure.example.test" }));
    await new Promise((r) => setTimeout(r, 0));
    await expect(startConfig(serve({ apiBase: "http://insecure.example.test" }))).rejects.toThrow(/https/);
  });

  it("never trusts a tampered kept copy", async () => {
    vi.stubGlobal("localStorage", storage({ "meldiq.config.v1": JSON.stringify({ apiBase: "http://evil.example.test" }) }));
    const { apiBase, startConfig } = await import("../src/application/config");
    await startConfig(serve({}));
    expect(apiBase()).toBe("");
  });
});

describe("where the person left off", () => {
  const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

  it("reopens the last conversation for the same account, only at the bare address", async () => {
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("location", new URL(`${ORIGIN}/`));
    const { forgetPlace, placeToRestore, rememberPlace } = await import("../src/application/lastPlace");
    rememberPlace("u_a", "/home/c/c_123");
    expect(placeToRestore("u_a", at("/"))).toBe("/home/c/c_123");
    expect(placeToRestore("u_b", at("/"))).toBeNull(); // another account signed in since
    expect(placeToRestore("u_a", at("/dms"))).toBeNull(); // a link or a reload keeps its own address
    expect(placeToRestore("u_a", at("/", "?discord=1"))).toBeNull();
    expect(placeToRestore("u_a", at("/", "", "#/dms/c/x"))).toBeNull();
    forgetPlace();
    expect(placeToRestore("u_a", at("/"))).toBeNull();
  });

  it("keeps only the app's own routes, whatever was stored", async () => {
    vi.stubGlobal("location", new URL(`${ORIGIN}/`));
    vi.stubGlobal("localStorage", storage({ "meldiq.lastPlace": JSON.stringify({ u: "u_a", p: "https://evil.example/x" }) }));
    const { placeToRestore, rememberPlace } = await import("../src/application/lastPlace");
    expect(placeToRestore("u_a", at("/"))).toBeNull();
    rememberPlace("u_a", "/oauth/authorize");
    expect(placeToRestore("u_a", at("/"))).toBeNull();
    vi.stubGlobal("localStorage", storage({ "meldiq.lastPlace": "{not json" }));
    expect(placeToRestore("u_a", at("/"))).toBeNull();
  });
});

describe("the session after a page load", () => {
  /** A session whose token is restored a moment after the page starts asking (as AccountSession reads its vault). */
  function session() {
    let token: string | null = null;
    let swaps = 0;
    const creds: Credentials & { swaps: () => number; set: (t: string) => void } = {
      token: () => token,
      reauthenticate: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 5));
        swaps++;
        token = `t${swaps}`;
        return true;
      }),
      swaps: () => swaps,
      set: (t) => (token = t),
    };
    return creds;
  }

  it("waits for the session instead of sending a request bound to be refused", async () => {
    const creds = session();
    const sent: (string | null)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>).authorization ?? null;
        sent.push(auth);
        return auth ? new Response("{}", { status: 200 }) : new Response("{}", { status: 401 });
      }),
    );
    await new ApiClient("", creds).call("GET", "/v1/users/me");
    expect(sent).toEqual(["Bearer t1"]);
  });

  it("sends a refused request again with a token another request already renewed, without swapping it again", async () => {
    const creds = session();
    creds.set("old");
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        calls++;
        const auth = (init.headers as Record<string, string>).authorization;
        // The first answer arrives after another request renewed the session.
        if (auth === "Bearer old") {
          creds.set("new");
          return new Response("{}", { status: 401 });
        }
        return new Response("{}", { status: 200 });
      }),
    );
    await new ApiClient("", creds).call("GET", "/v1/orgs");
    expect(calls).toBe(2);
    expect(creds.reauthenticate).not.toHaveBeenCalled();
  });

  it("still renews a refused token once when nothing renewed it", async () => {
    const creds = session();
    creds.set("stale");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => new Response("{}", { status: (init.headers as Record<string, string>).authorization === "Bearer stale" ? 401 : 200 })),
    );
    await new ApiClient("", creds).call("GET", "/v1/orgs");
    expect(creds.swaps()).toBe(1);
  });
});
