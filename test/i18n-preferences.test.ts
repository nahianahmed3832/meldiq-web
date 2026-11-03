import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguageChoice } from "../src/i18n/languages";
import type { LocaleAccount } from "../src/i18n/preferences";

function storage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}
let attributes: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  attributes = new Map();
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("navigator", { languages: ["en-US"] });
  vi.stubGlobal("document", {
    documentElement: {
      setAttribute: (key: string, value: string) => attributes.set(key, value),
      removeAttribute: (key: string) => attributes.delete(key),
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
    },
    querySelector: () => null,
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function account(id: string, locale: LanguageChoice | null, supported = true) {
  let remote = { supported, locale, pending: false, revision: 0 };
  const listeners = new Set<() => void>();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const write = vi.fn(async (choice: LanguageChoice) => {
    remote = { ...remote, pending: false, locale: choice, revision: remote.revision + 1 };
    publish();
  });
  const adapter: LocaleAccount = {
    id,
    read: () => remote,
    write,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    adapter,
    write,
    change: (choice: LanguageChoice) => {
      remote = { ...remote, locale: choice, revision: remote.revision + 1 };
      publish();
    },
    tick: publish,
  };
}

describe("persistent interface choice", () => {
  it("keeps a guest choice across sessions and applies real HTML direction", async () => {
    const { chooseLanguage } = await import("../src/i18n/preferences");
    const prefs = await import("../src/application/prefs");
    expect(await chooseLanguage("ur")).toBe(true);
    expect(prefs.getPrefs().language).toBe("ur");
    expect(attributes.get("dir")).toBe("rtl");
    expect(attributes.get("lang")).toBe("ur");
    vi.resetModules();
    expect((await import("../src/application/prefs")).getPrefs().language).toBe("ur");
  });
  it("loads the explicit account choice and follows a change from another device", async () => {
    const { bindLocaleAccount } = await import("../src/i18n/preferences");
    const { getPrefs } = await import("../src/application/prefs");
    const a = account("a", "de");
    const stop = bindLocaleAccount(a.adapter);
    await vi.waitFor(() => expect(getPrefs().language).toBe("de"));
    a.change("ar");
    await vi.waitFor(() => expect(getPrefs().language).toBe("ar"));
    expect(attributes.get("dir")).toBe("rtl");
    expect(a.write).not.toHaveBeenCalled();
    stop();
  });
  it("migrates an explicit guest choice once without writing on presence/message updates", async () => {
    vi.stubGlobal("localStorage", storage({ "meldiq.locale.guest": "bn" }));
    const { bindLocaleAccount } = await import("../src/i18n/preferences");
    const a = account("a", null);
    const stop = bindLocaleAccount(a.adapter);
    await vi.waitFor(() => expect(a.write).toHaveBeenCalledExactlyOnceWith("bn"));
    for (let n = 0; n < 20; n++) a.tick();
    expect(a.write).toHaveBeenCalledTimes(1);
    stop();
  });
  it("does not send unsupported fields to older servers and still keeps the browser choice", async () => {
    const { bindLocaleAccount, chooseLanguage } = await import("../src/i18n/preferences");
    const { getPrefs } = await import("../src/application/prefs");
    const a = account("older", null, false);
    const stop = bindLocaleAccount(a.adapter);
    await chooseLanguage("ja");
    expect(getPrefs().language).toBe("ja");
    expect(a.write).not.toHaveBeenCalled();
    stop();
  });
  it("isolates choices when switching accounts", async () => {
    const { bindLocaleAccount, chooseLanguage } = await import("../src/i18n/preferences");
    const { getPrefs } = await import("../src/application/prefs");
    const first = account("first", null, false);
    const stop = bindLocaleAccount(first.adapter);
    await chooseLanguage("bn");
    stop();
    const second = account("second", "ja");
    const stopSecond = bindLocaleAccount(second.adapter);
    await vi.waitFor(() => expect(getPrefs().language).toBe("ja"));
    expect(first.write).not.toHaveBeenCalled();
    stopSecond();
    const stopFirst = bindLocaleAccount(first.adapter);
    await vi.waitFor(() => expect(getPrefs().language).toBe("bn"));
    stopFirst();
  });
  it("never stores automatic detection as an explicit account choice", async () => {
    vi.stubGlobal("navigator", { languages: ["pt"] });
    const { bindLocaleAccount } = await import("../src/i18n/preferences");
    const a = account("new", null);
    const stop = bindLocaleAccount(a.adapter);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(a.write).not.toHaveBeenCalled();
    stop();
  });
});
