import { describe, expect, it } from "vitest";
import { capCount, isHighlighted, unreadLabel, unreadMarker } from "../src/ui/unread";

const words = { unread: (n: number) => `${n} unread`, mentions: (n: number) => `${n} mentions`, muted: "muted" };

describe("unread markers", () => {
  it("shows nothing when there's nothing new", () => {
    expect(unreadMarker(0, 0, false)).toEqual({ kind: "none" });
  });

  it("highlights a single unread event without a number", () => {
    const m = unreadMarker(1, 0, false);
    expect(m).toEqual({ kind: "dot" });
    expect(isHighlighted(m)).toBe(true);
  });

  it("shows the count from two unread events", () => {
    expect(unreadMarker(2, 0, false)).toEqual({ kind: "count", text: "2" });
    expect(unreadMarker(57, 0, false)).toEqual({ kind: "count", text: "57" });
  });

  it("caps the shown count at 99+ while the label keeps the real number", () => {
    expect(unreadMarker(250, 0, false)).toEqual({ kind: "count", text: "99+" });
    expect(unreadLabel(250, 0, false, words)).toBe(", 250 unread");
    expect(capCount(99)).toBe("99");
    expect(capCount(100)).toBe("99+");
  });

  it("keeps a muted conversation quiet", () => {
    expect(unreadMarker(12, 0, true)).toEqual({ kind: "none" });
    expect(isHighlighted(unreadMarker(12, 0, true))).toBe(false);
  });

  it("still shows a mention of you in a muted conversation, apart from plain unread", () => {
    expect(unreadMarker(3, 1, true)).toEqual({ kind: "mention", text: "@1" });
    expect(unreadMarker(3, 2, false)).toEqual({ kind: "mention", text: "@2" });
  });

  it("numbers even one unread message in a DM or group", () => {
    expect(unreadMarker(1, 0, false, true)).toEqual({ kind: "count", text: "1", direct: true });
    expect(unreadMarker(1, 0, true, true)).toEqual({ kind: "none" });
  });

  it("labels every state for screen readers", () => {
    expect(unreadLabel(0, 0, false, words)).toBe("");
    expect(unreadLabel(4, 1, true, words)).toBe(", 4 unread, 1 mentions, muted");
  });
});
