import { describe, expect, it } from "vitest";
import { ACCENT_PRESETS, accentColors, accentStyle, contrast, isAccent, onAccent } from "../src/ui/community/accent";

describe("a community's accent colour", () => {
  it("accepts only #rrggbb", () => {
    for (const ok of ["#22d3ee", "#FF0066", "#000000"]) expect(isAccent(ok)).toBe(true);
    for (const bad of ["red", "#fff", "#12345g", "url(x)", "#1234567", "", null, undefined, 7]) expect(isAccent(bad)).toBe(false);
  });

  it("adds nothing without one, so the community keeps Meldiq's theme", () => {
    expect(accentStyle(null)).toEqual({});
    expect(accentStyle("not a colour; background: red")).toEqual({});
  });

  it("keeps text readable whatever colour was picked: AA on light and dark surfaces, black or white on the fill", () => {
    for (const hex of [...ACCENT_PRESETS.map((p) => p.hex), "#000000", "#ffffff", "#ffff00", "#0000ff", "#777777"]) {
      const c = accentColors(hex);
      expect(contrast(c.textLight, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.textDark, "#10172b")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.on, c.fill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puts dark text on bright accents and white on deep ones", () => {
    expect(onAccent("#facc15")).toBe("#0b1020");
    expect(onAccent("#4338ca")).toBe("#ffffff");
  });

  it("scopes plain colours to an element (no light-dark() or color-mix(), for older Safari)", () => {
    const style = accentStyle("#EC4899") as Record<string, string>;
    expect(style["--c-accent"]).toBe("#ec4899");
    expect(style["--c-accent-soft"]).toBe("rgba(236, 72, 153, 0.18)");
    expect(Object.values(style).join(" ")).not.toMatch(/light-dark|color-mix/);
  });
});
