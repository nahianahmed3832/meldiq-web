import { describe, expect, it } from "vitest";
import { badgeText, tabSignal, tabTitle } from "../src/application/tabBadge";
import type { AppState } from "../src/state/store";

type Conv = { id: string; type: "DM" | "GROUP" | "CHANNEL"; orgId: string | null; request?: { incoming: boolean } };

/** Just the parts of the state the tab signal reads. */
function state(convs: Conv[], locals: Record<string, { unread: number; mentions: number; archivedAt?: number }>, muted: string[] = []): AppState {
  return {
    conversations: Object.fromEntries(convs.map((c) => [c.id, { createdAt: 0, categoryId: null, ...c }])),
    local: Object.fromEntries(Object.entries(locals).map(([id, l]) => [id, { id, ...l }])),
    nav: {
      personal: { starred: [], sections: [], collapsed: [], notify: Object.fromEntries(muted.map((id) => [id, "none"])) },
      o1: { starred: [], sections: [], collapsed: [], notify: Object.fromEntries(muted.map((id) => [id, "none"])) },
    },
  } as unknown as AppState;
}

describe("the tab's unread signal", () => {
  it("counts unread direct messages and mentions of you, and shows other channel activity as a dot", () => {
    const s = state(
      [
        { id: "dm", type: "DM", orgId: null },
        { id: "grp", type: "GROUP", orgId: null },
        { id: "gen", type: "CHANNEL", orgId: "o1" },
        { id: "news", type: "CHANNEL", orgId: "o1" },
      ],
      { dm: { unread: 2, mentions: 0 }, grp: { unread: 1, mentions: 0 }, gen: { unread: 5, mentions: 1 }, news: { unread: 3, mentions: 0 } },
    );
    expect(tabSignal(s)).toEqual({ count: 4, activity: true });
    expect(tabTitle(tabSignal(s))).toBe("(4) Meldiq");
    expect(badgeText(tabSignal(s))).toBe("4");
  });

  it("leaves out muted, archived and request conversations", () => {
    const s = state(
      [
        { id: "dm", type: "DM", orgId: null },
        { id: "old", type: "DM", orgId: null },
        { id: "req", type: "DM", orgId: null, request: { incoming: true } },
        { id: "quiet", type: "CHANNEL", orgId: "o1" },
      ],
      { dm: { unread: 3, mentions: 0 }, old: { unread: 4, mentions: 0, archivedAt: 1 }, req: { unread: 1, mentions: 0 }, quiet: { unread: 9, mentions: 0 } },
      ["dm", "quiet"],
    );
    expect(tabSignal(s)).toEqual({ count: 0, activity: false });
    expect(tabTitle(tabSignal(s))).toBe("Meldiq");
    expect(badgeText(tabSignal(s))).toBeNull();
  });

  it("shows channel activity alone as a dot, without a number", () => {
    const s = state([{ id: "gen", type: "CHANNEL", orgId: "o1" }], { gen: { unread: 1, mentions: 0 } });
    expect(tabTitle(tabSignal(s))).toBe("• Meldiq");
    expect(badgeText(tabSignal(s))).toBe("");
  });

  it("caps the title at 99+ and the icon at 9+", () => {
    expect(tabTitle({ count: 140, activity: false })).toBe("(99+) Meldiq");
    expect(badgeText({ count: 12, activity: false })).toBe("9+");
    expect(badgeText({ count: 9, activity: false })).toBe("9");
  });
});
