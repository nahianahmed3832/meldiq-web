import { describe, expect, it } from "vitest";
import { actionFor, bindingOf, comboOf, keyCaps, SHORTCUTS, usableCombo } from "../src/application/shortcuts";
import { VIBES, vibeColors } from "../src/application/vibes";
import { maskEmail, zStanding } from "../src/sync/accountSafety";

/** Stage 1 settings (2026-10-28): shortcuts, colour themes, account standing and the masked email. */
const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}, code = "") => ({
  key: k,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("shortcuts", () => {
  it("writes a key press the same way on every platform", () => {
    expect(comboOf(key("k", { metaKey: true }), true)).toBe("Mod+K");
    expect(comboOf(key("k", { ctrlKey: true }), false)).toBe("Mod+K");
    expect(comboOf(key("ArrowUp", { altKey: true, shiftKey: true }), false)).toBe("Alt+Shift+ArrowUp");
    // ⌥K on a Mac types "˚": the physical key counts.
    expect(comboOf(key("˚", { altKey: true }, "KeyK"), true)).toBe("Alt+K");
    expect(comboOf(key("Shift", { shiftKey: true }), true)).toBeNull();
  });

  it("finds the action, follows the person's own combinations, and an empty one turns it off", () => {
    expect(actionFor({}, "Mod+K")).toBe("search");
    expect(actionFor({ search: "Mod+P" }, "Mod+K")).toBeNull();
    expect(actionFor({ search: "Mod+P" }, "Mod+P")).toBe("search");
    expect(actionFor({ showShortcuts: "" }, "Mod+/")).toBeNull();
    expect(bindingOf({}, "toggleMute")).toBe("Mod+Shift+M");
    expect(new Set(SHORTCUTS.map((s) => s.combo)).size).toBe(SHORTCUTS.length);
  });

  it("draws keycaps for the platform and refuses plain keys", () => {
    expect(keyCaps("Mod+Shift+M", true)).toEqual(["⌘", "Shift", "M"]);
    expect(keyCaps("Alt+ArrowUp", false)).toEqual(["Alt", "↑"]);
    expect(usableCombo("K")).toBe(false);
    expect(usableCombo("F13")).toBe(true);
    expect(usableCombo("Shift+Escape")).toBe(true);
  });
});

describe("colour themes", () => {
  it("has unique presets of valid colours, and a custom theme needs two or three", () => {
    expect(new Set(VIBES.map((v) => v.id)).size).toBe(VIBES.length);
    for (const v of VIBES) for (const c of v.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(vibeColors(null, null)).toBeNull();
    expect(vibeColors("lagoon", null)).toEqual(["#06b6d4", "#3b82f6"]);
    expect(vibeColors("custom", ["#ff0000"])).toBeNull();
    expect(vibeColors("custom", ["#ff0000", "#00ff00"])).toEqual(["#ff0000", "#00ff00"]);
    expect(vibeColors("custom", ["#ff0000", "red"])).toBeNull();
    expect(vibeColors("nope", null)).toBeNull();
  });
});

describe("account", () => {
  it("masks an email as the reference does until Reveal", () => {
    expect(maskEmail("nahian@gmail.com")).toBe("n***@gmail.com");
    expect(maskEmail("bad")).toBe("***");
  });

  it("reads standing, treating an unknown level as good", () => {
    expect(zStanding.parse({ level: "limited", warnings: [] }).level).toBe("limited");
    expect(zStanding.parse({ level: "banished", warnings: [] }).level).toBe("good");
  });
});
