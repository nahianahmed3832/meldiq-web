import { afterEach, describe, expect, it, vi } from "vitest";

/** Per-browser preferences: what comes back from storage is checked before it reaches the page (theme and palette). */
function storage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

async function loadWith(stored: unknown) {
  vi.resetModules();
  vi.stubGlobal("localStorage", storage(stored === undefined ? {} : { "orbit.prefs.v1": JSON.stringify(stored) }));
  return import("../src/application/prefs");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preferences", () => {
  it("defaults to dark and the Graphite palette, as the Android app", async () => {
    const { getPrefs } = await loadWith(undefined);
    expect(getPrefs()).toMatchObject({ theme: "dark", palette: "graphite" });
  });

  it("keeps a stored theme and palette that are allowed", async () => {
    const { getPrefs } = await loadWith({ designVersion: 2, theme: "system", palette: "sunset", textSize: "large", enterToSend: false });
    expect(getPrefs()).toMatchObject({ theme: "system", palette: "sunset", textSize: "large", enterToSend: false });
  });

  it("falls back to the defaults for an unknown or tampered theme or palette", async () => {
    const { getPrefs } = await loadWith({ designVersion: 2, theme: 'x" onload="', palette: "neon", textSize: "huge" });
    expect(getPrefs()).toMatchObject({ theme: "dark", palette: "graphite", textSize: "default" });
  });

  it("moves a browser from before Android's look once: Graphite, and dark instead of following the system", async () => {
    expect((await loadWith({ theme: "system", palette: "plum", notifications: true })).getPrefs()).toMatchObject({ theme: "dark", palette: "graphite", notifications: true, designVersion: 2 });
    expect((await loadWith({ palette: "amber" })).getPrefs()).toMatchObject({ theme: "dark", palette: "graphite" });
    // A light or dark mode someone chose stays.
    expect((await loadWith({ theme: "light", palette: "indigo" })).getPrefs()).toMatchObject({ theme: "light", palette: "graphite" });
  });
});
