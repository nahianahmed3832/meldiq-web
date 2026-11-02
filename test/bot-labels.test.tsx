import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LookName } from "../src/ui/people/NameStyle";

vi.mock("../src/application/orbit", () => ({
  useOrbit: (select: (state: unknown) => unknown) => select({ users: { helper: { bot: true, profileStyle: { shownBadge: "none" } } } }),
}));

describe("bot classification in name presentations", () => {
  it.each([{}, { withMarks: true }, { withSubscription: true }])("keeps BOT in compact names, headers and marked names: %o", (options) => {
    const html = renderToStaticMarkup(<LookName userId="helper" name="Community Helper" {...options} />);
    expect(html).toContain('class="bot-tag"');
    expect(html).toContain("BOT</span>");
    expect(html).not.toContain("mojo-badge");
  });
});
