import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Icon, ICON_NAMES } from "../src/ui/icons/Icon";

describe("universal icons", () => {
  it("renders every semantic icon without network-backed elements", () => {
    for (const name of ICON_NAMES) {
      const svg = renderToStaticMarkup(createElement(Icon, { name }));
      expect(svg).toContain(`data-icon="${name}"`);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke-width="2"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).not.toMatch(/<image|<use|<script|href=|https?:/);
    }
  });
  it("labels informative icons and dims disabled icons", () => {
    const svg = renderToStaticMarkup(createElement(Icon, { name: "files.download", label: "Download", state: "disabled", size: 16 }));
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Download"');
    expect(svg).not.toContain("aria-hidden");
    expect(svg).toContain('width="16"');
    expect(svg).toContain("opacity:0.38");
  });
});
