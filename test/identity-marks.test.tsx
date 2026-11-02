import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StyledName } from "../src/ui/people/NameStyle";
import { MojoBadgeMark } from "../src/ui/mojo/MojoBadge";

describe("identity mark placement and meaning", () => {
  it("keeps the styled name, tag and membership mark in one aligned identity container", () => {
    const html = renderToStaticMarkup(<StyledName name="Explorer" style={null} tag={{ orgId: "club", text: "MDQ", color: null }} mojo={{ badge: "plus", check: true }} />);
    expect(html).toContain('class="identity-name"');
    expect(html.indexOf("Explorer")).toBeLessThan(html.indexOf("Community tag MDQ"));
    expect(html.indexOf("Community tag MDQ")).toBeLessThan(html.indexOf('title="Meldiq Plus"'));
    expect(html).toContain("PLUS</span>");
    expect(html).toContain("Meldiq Plus membership");
    expect(renderToStaticMarkup(<MojoBadgeMark badge="plus" check />)).not.toContain("<svg");
  });
  it("shows no subscription indicator for a free account and respects the chosen message badge", () => {
    expect(renderToStaticMarkup(<StyledName name="Free" style={null} mojo={null} />)).not.toContain("mojo-badge");
    const html = renderToStaticMarkup(<StyledName name="Hidden" style={{ shownBadge: "none" } as never} mojo={{ badge: "plus", check: true }} />);
    expect(html).not.toContain("mojo-badge");
  });

  it("keeps the BOT label even when all optional badges are hidden", () => {
    const html = renderToStaticMarkup(<StyledName name="Community Helper" style={{ shownBadge: "none" } as never} bot mojo={{ badge: "plus", check: true }} />);
    expect(html).toContain('class="bot-tag"');
    expect(html).toContain("BOT</span>");
    expect(html).not.toContain("mojo-badge");
  });
});
