import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedMedia, forgetAllMedia, forgetMediaEntry, keepMedia, toEvict } from "../src/store/mediaCache";

/** A Cache Storage in memory, enough for the media cache. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const m = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, m);
    return {
      match: async (url: string | Request) => m.get(typeof url === "string" ? url : url.url)?.clone(),
      put: async (url: string, res: Response) => void m.set(url, res),
      delete: async (url: string) => m.delete(url),
      keys: async () => [...m.keys()].map((url) => ({ url })),
    };
  };
  return { stores, api: { open, delete: async (name: string) => stores.delete(name) } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("media cache", () => {
  it("lets the oldest entries go until what stays fits", () => {
    const entries = [
      { key: "new", size: 40, at: 3 },
      { key: "old", size: 50, at: 1 },
      { key: "mid", size: 30, at: 2 },
    ];
    expect(toEvict(entries, 100)).toEqual(["old"]);
    expect(toEvict(entries, 40)).toEqual(["old", "mid"]);
    expect(toEvict(entries, 1000)).toEqual([]);
  });

  it("keeps bytes between visits, forgets one entry, and erases everything", async () => {
    const fake = fakeCaches();
    vi.stubGlobal("caches", fake.api);
    vi.stubGlobal("location", { origin: "https://web.meldiq.app" });
    expect(await cachedMedia("attachment:a1")).toBeNull();
    await keepMedia("attachment:a1", new Uint8Array([1, 2, 3]));
    await keepMedia("photo:user:u1:5", new Uint8Array([9]));
    expect([...((await cachedMedia("attachment:a1")) ?? [])]).toEqual([1, 2, 3]);
    await forgetMediaEntry("attachment:a1");
    expect(await cachedMedia("attachment:a1")).toBeNull();
    expect(await cachedMedia("photo:user:u1:5")).not.toBeNull();
    await forgetAllMedia();
    expect(fake.stores.size).toBe(0);
  });

  it("does nothing where the browser has no Cache API", async () => {
    vi.stubGlobal("caches", undefined);
    await keepMedia("attachment:a1", new Uint8Array([1]));
    expect(await cachedMedia("attachment:a1")).toBeNull();
    await expect(forgetAllMedia()).resolves.toBeUndefined();
  });
});
