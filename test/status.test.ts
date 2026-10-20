import { describe, expect, it } from "vitest";
import { initialState, type AppState } from "../src/state/store";
import { activityShows, markAllReadTargets } from "../src/ui/selectors";
import { active, expiresAt, paused, pauseUntil, PRESETS, statusLine } from "../src/sync/status";

/** Round 3: the same cases as android StatusRulesTest (local time, whatever the machine's zone). */
const now = new Date(2026, 9, 21, 15, 20).getTime(); // Wednesday 21 October 2026, 15:20 local

describe("statuses", () => {
  it("end when the chosen time comes", () => {
    expect(expiresAt("never", now)).toBeNull();
    expect(expiresAt("30m", now)).toBe(now + 30 * 60_000);
    expect(expiresAt("4h", now)).toBe(now + 4 * 3_600_000);
    expect(expiresAt("today", now)).toBe(new Date(2026, 9, 22).getTime());
    expect(expiresAt("week", now)).toBe(new Date(2026, 9, 26).getTime()); // the next Monday
    expect(expiresAt("week", new Date(2026, 9, 25, 10).getTime())).toBe(new Date(2026, 9, 26).getTime()); // from a Sunday
  });

  it("keep the reference's suggestions and their lengths", () => {
    expect(PRESETS.map((p) => p.clearAfter)).toEqual(["1h", "30m", "today", "never", "today"]);
  });

  it("show as one line until they end", () => {
    const s = { statusText: "In a meeting", statusEmoji: "📅", statusExpiresAt: now + 1000 };
    expect(statusLine(s, now)).toBe("📅 In a meeting");
    expect(statusLine(s, now + 1000)).toBeNull();
    expect(statusLine({ statusText: null, statusEmoji: null }, now)).toBeNull();
    expect(active(null, now)).toBe(true);
  });
});

describe("pausing notifications", () => {
  it("lasts a while or until tomorrow at 9:00", () => {
    expect(pauseUntil("2h", now)).toBe(now + 2 * 3_600_000);
    expect(pauseUntil("tomorrow9", now)).toBe(new Date(2026, 9, 22, 9).getTime());
    expect(paused(now + 1, now)).toBe(true);
    expect(paused(now, now)).toBe(false);
    expect(paused(null, now)).toBe(false);
  });
});

describe("Activity chips and mark all as read", () => {
  it("show their own section", () => {
    expect(activityShows("all", "calls")).toBe(true);
    expect(activityShows("mentions", "mentions")).toBe(true);
    expect(activityShows("mentions", "threads")).toBe(false);
  });

  it("clear this workspace's unread channels only", () => {
    const conv = (id: string, over: Record<string, unknown>) => ({ id, type: "CHANNEL", orgId: "o1", joined: true, ...over });
    const s = {
      ...initialState,
      conversations: {
        general: conv("general", {}),
        random: conv("random", {}),
        quiet: conv("quiet", {}),
        other: conv("other", { orgId: "o2" }),
        dm: conv("dm", { type: "DM", orgId: null }),
      },
      local: {
        general: { id: "general", unread: 2, mentions: 0 },
        random: { id: "random", unread: 0, mentions: 1 },
        other: { id: "other", unread: 5, mentions: 0 },
        dm: { id: "dm", unread: 3, mentions: 0 },
      },
    } as unknown as AppState;
    expect(markAllReadTargets(s, "o1").sort()).toEqual(["general", "random"]);
    expect(markAllReadTargets(s, null)).toEqual([]);
  });
});
