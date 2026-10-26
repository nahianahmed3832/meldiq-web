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
  it("defaults to the system theme, the Meldiq palette and the side panels open", async () => {
    const { getPrefs } = await loadWith(undefined);
    expect(getPrefs()).toMatchObject({ theme: "system", palette: "meldiq", memberList: true, dmProfile: true });
  });

  it("moves a former default (indigo, charcoal) to Meldiq, and keeps either one the person picked", async () => {
    expect((await loadWith({ palette: "indigo" })).getPrefs().palette).toBe("meldiq");
    expect((await loadWith({ palette: "charcoal" })).getPrefs().palette).toBe("meldiq");
    expect((await loadWith({ palette: "indigo", paletteChosen: true })).getPrefs().palette).toBe("indigo");
    expect((await loadWith({ palette: "charcoal", paletteChosen: true })).getPrefs().palette).toBe("charcoal");
    expect((await loadWith({ palette: "plum" })).getPrefs().palette).toBe("plum");
  });

  it("keeps hidden side panels hidden", async () => {
    const { getPrefs } = await loadWith({ memberList: false, dmProfile: false });
    expect(getPrefs()).toMatchObject({ memberList: false, dmProfile: false });
  });

  it("keeps a stored theme and palette that are allowed", async () => {
    const { getPrefs } = await loadWith({ theme: "dark", palette: "amber", textSize: "large", enterToSend: false });
    expect(getPrefs()).toMatchObject({ theme: "dark", palette: "amber", textSize: "large", enterToSend: false });
  });

  it("falls back to the defaults for an unknown or tampered theme or palette", async () => {
    const { getPrefs } = await loadWith({ theme: 'x" onload="', palette: "neon", textSize: "huge" });
    expect(getPrefs()).toMatchObject({ theme: "system", palette: "meldiq", textSize: "default" });
  });

  it("gives browsers that stored preferences before palettes existed the default palette", async () => {
    const { getPrefs } = await loadWith({ theme: "light", notifications: true });
    expect(getPrefs()).toMatchObject({ theme: "light", palette: "meldiq", notifications: true });
  });
});
