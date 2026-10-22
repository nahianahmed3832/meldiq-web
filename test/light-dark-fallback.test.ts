import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { lightDarkFallback, resolveLightDark } from "../build/lightDarkFallback";

describe("colours without CSS light-dark() (Safari before 17.5, every iPhone 8)", () => {
  it("picks one side of each light-dark(), commas inside colours and several calls included", () => {
    expect(resolveLightDark("light-dark(#fff, #000)", 0)).toBe("#fff");
    expect(resolveLightDark("light-dark(rgba(1, 2, 3, 0.5), rgba(4, 5, 6, 0.5))", 1)).toBe("rgba(4, 5, 6, 0.5)");
    expect(resolveLightDark("0 1px 2px light-dark(rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.3)), 0 4px light-dark(red, blue)", 1)).toBe("0 1px 2px rgba(0, 0, 0, 0.3), 0 4px blue");
    expect(resolveLightDark("#123", 0)).toBeNull();
  });

  it("adds light, system-dark and chosen-dark rules for every token, palettes included", async () => {
    const css = `@supports (color: light-dark(#000, #fff)) {
  :root { color-scheme: light dark; }
  :root, :root[data-palette="indigo"] { --accent: light-dark(#4b4fc9, #8b93ff); }
  :root[data-palette="plum"] { --accent: light-dark(#7a3fa0, #d7a6f5); --static: 4px; }
}`;
    const out = (await postcss([lightDarkFallback(postcss)]).process(css, { from: undefined })).css;
    const fallback = out.slice(out.indexOf("@supports not"));
    expect(fallback).toContain(":root { color-scheme: light dark; }");
    expect(fallback).toMatch(/:root,\s*:root\[data-palette="indigo"\]\s*\{\s*--accent: #4b4fc9/);
    expect(fallback).toMatch(
      /@media \(prefers-color-scheme: dark\)[\s\S]*:root:not\(\[data-theme="light"\]\),\s*:root\[data-palette="indigo"\]:not\(\[data-theme="light"\]\)\s*\{\s*--accent: #8b93ff/,
    );
    expect(fallback).toMatch(/:root\[data-palette="plum"\]\[data-theme="dark"\]\s*\{\s*--accent: #d7a6f5/);
    // Only the light-dark() tokens are repeated; the original block is untouched.
    expect(fallback).not.toContain("--static");
    expect(out.indexOf("light-dark(#4b4fc9, #8b93ff)")).toBeLessThan(out.indexOf("@supports not"));
  });
});
