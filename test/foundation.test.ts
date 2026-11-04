import { afterEach, describe, expect, it, vi } from "vitest";
import { zProfileStyle, zProfileLayout } from "../src/api/profileSchemas";
import { moveProfileSection, visibleProfileSections } from "../src/ui/people/profileSections";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("account-scoped welcome progress", () => {
  it("resumes after a module/browser reload and never enrolls an unrelated or returning account", async () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) });
    let flow = await import("../src/application/welcome");
    expect(flow.welcomeStage("returning")).toBeNull();
    flow.startWelcome("first");
    flow.saveWelcomeStage("first", 1);
    vi.resetModules();
    flow = await import("../src/application/welcome");
    expect(flow.welcomeStage("first")).toBe(1);
    expect(flow.welcomeStage("other")).toBeNull();
    flow.startWelcome("first");
    expect(flow.welcomeStage("first")).toBe(1);
    flow.saveWelcomeStage("first", -1);
    flow.startWelcome("first");
    expect(flow.welcomeStage("first")).toBe(-1);
  });
  it("rejects malformed stored progress and survives unavailable storage without storing identity or secrets", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "99", setItem: () => undefined });
    const flow = await import("../src/application/welcome");
    expect(flow.welcomeStage("corrupt")).toBeNull();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    flow.startWelcome("private-window");
    flow.saveWelcomeStage("private-window", 2);
    expect(flow.welcomeStage("private-window")).toBe(2);
    expect(flow.welcomeStage("another-account")).toBeNull();
  });
});

describe("profile layout compatibility", () => {
  it("keeps old-server defaults and drops malformed layout without discarding a valid style", () => {
    const original = { decoration: null, effect: null, accent: "#123456" };
    const style = zProfileStyle.parse({ ...original, layout: { order: ["about", "about", "links"], hidden: [] } });
    expect(style?.accent).toBe("#123456");
    expect(style?.layout).toBeUndefined();
    expect(visibleProfileSections(style)).toEqual(["about", "links", "connections"]);
    expect(zProfileLayout.safeParse({ order: ["links", "about", "admin"], hidden: [] }).success).toBe(false);
  });
  it("reorders immutably without dropping hidden sections, including boundaries", () => {
    const layout = { order: ["about", "links", "connections"] as ("about" | "links" | "connections")[], hidden: ["links"] as ("about" | "links" | "connections")[] };
    const moved = moveProfileSection(layout, "connections", -1);
    expect(moved.order).toEqual(["about", "connections", "links"]);
    expect(moved.hidden).toEqual(["links"]);
    expect(layout.order).toEqual(["about", "links", "connections"]);
    expect(moveProfileSection(layout, "about", -1)).toBe(layout);
    expect(moveProfileSection(layout, "connections", 1)).toBe(layout);
  });
});
