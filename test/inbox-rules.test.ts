import { describe, expect, it } from "vitest";
import { composerState, customerLabel, fits, hoursLeft, type InboxDetail, minutesLabel, parseTags } from "../src/sync/inbox";

/** The phone's InboxRulesTest cases (android round 8, docs/UNIFIED_INBOX.md). */
const conv = (provider = "messenger", name: string | null = null, handle: string | null = null) =>
  ({ id: "c1", orgId: "o1", provider, account: { id: "a1", name: "Acme", status: "active" }, customer: { id: "k1", name, handle }, status: "waiting_agent" }) as InboxDetail["conversation"];
const detail = (rule: InboxDetail["reply"]["rule"], canReply = true, templates = false): InboxDetail => ({
  conversation: conv(),
  messages: [],
  reply: { rule, canReply, templates, textLimit: 2000, windowEndsAt: null },
});

describe("inbox rules", () => {
  it("the composer follows the server's reply rule", () => {
    expect(composerState(detail({ allowed: true, mode: "free" }))).toEqual({ kind: "text" });
    expect(composerState(detail({ allowed: false, reason: "template_required" }, true, true))).toEqual({ kind: "template_only" });
    expect(composerState(detail({ allowed: false, reason: "window_closed" }))).toEqual({ kind: "closed", reason: "window_closed" });
    expect(composerState(detail({ allowed: true, mode: "free" }, false))).toEqual({ kind: "no_permission" });
  });

  it("customers are shown only as the provider named them", () => {
    expect(customerLabel(conv("messenger", "Rina"))).toBe("Rina");
    expect(customerLabel(conv("whatsapp", null, "+8801700000000"))).toBe("+8801700000000");
    expect(customerLabel(conv())).toBe("Customer");
  });

  it("window hours round up and vanish when closed", () => {
    expect(hoursLeft(1_000 + 24 * 3_600_000, 1_000)).toBe(24);
    expect(hoursLeft(1_000 + 60_000, 1_000)).toBe(1);
    expect(hoursLeft(1_000, 2_000)).toBeNull();
    expect(hoursLeft(null, 2_000)).toBeNull();
  });

  it("text limits count Instagram in bytes", () => {
    expect(fits("instagram", "é".repeat(500), 1000)).toBe(true);
    expect(fits("instagram", "é".repeat(501), 1000)).toBe(false);
    expect(fits("messenger", "é".repeat(2000), 2000)).toBe(true);
  });

  it("tags are cleaned", () => {
    expect(parseTags(" VIP, shipping, ,vip ")).toEqual(["vip", "shipping"]);
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i + 1}`).join(","))).toHaveLength(10);
  });

  it("durations read naturally", () => {
    expect(minutesLabel(5 * 60_000)).toBe("5m");
    expect(minutesLabel(125 * 60_000)).toBe("2h 5m");
    expect(minutesLabel(null)).toBeNull();
  });
});
