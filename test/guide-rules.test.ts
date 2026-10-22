import { describe, expect, it } from "vitest";
import { guideProgress, missingAnswer, toggleAnswer, visitGuide } from "../src/sync/guide";
import { repeatLabel, weekdayAndNth } from "../src/sync/workspaceC5";
import { activityShows } from "../src/ui/selectors";

/** The phone's cases (android GuideOnboardingRulesTest, EventRepeatRules; ChatInterfaceRulesTest's Unreads chip). */
const guide = {
  welcome: "Hi",
  tasks: [
    { id: "t1", title: "Read the welcome", channelId: "c1" },
    { id: "t2", title: "Say hello", channelId: "c2" },
  ],
  resources: [],
};

describe("community guide", () => {
  it("ticks the tasks pointing to a channel once it's opened, and counts them", () => {
    const d1 = visitGuide({}, "o1", guide, "c1");
    expect(d1).toEqual({ o1: ["t1"] });
    expect(visitGuide(d1, "o1", guide, "c1")).toEqual(d1);
    expect(visitGuide(d1, "o1", guide, "elsewhere")).toEqual(d1);
    expect(guideProgress(guide, d1.o1)).toEqual([1, 2]);
    expect(guideProgress(guide, [])).toEqual([0, 2]);
  });
});

describe("onboarding answers", () => {
  const single = {
    id: "q1",
    title: "Pick one",
    single: true,
    required: true,
    options: [
      { id: "a", title: "A", roleIds: [], channelIds: [] },
      { id: "b", title: "B", roleIds: [], channelIds: [] },
    ],
  };
  const multi = {
    ...single,
    id: "q2",
    single: false,
    required: false,
    options: [
      { id: "x", title: "X", roleIds: [], channelIds: [] },
      { id: "y", title: "Y", roleIds: [], channelIds: [] },
    ],
  };
  it("replace a single answer, toggle the others, and name the first required question left", () => {
    let c = toggleAnswer(new Set(), single, "a");
    c = toggleAnswer(c, single, "b");
    expect([...c]).toEqual(["b"]);
    c = toggleAnswer(c, multi, "x");
    c = toggleAnswer(c, multi, "y");
    expect(new Set(c)).toEqual(new Set(["b", "x", "y"]));
    expect(toggleAnswer(c, multi, "x").has("x")).toBe(false);
    expect(missingAnswer([single, multi], new Set(["x"]))?.id).toBe("q1");
    expect(missingAnswer([single, multi], new Set(["a"]))).toBeNull();
  });
});

describe("repeating events", () => {
  it("are named from the chosen date in its time zone", () => {
    // Thursday 22 October 2026, 10:00 in New York: the fourth Thursday.
    const t = Date.UTC(2026, 9, 22, 14, 0);
    expect(weekdayAndNth(t, "America/New_York")).toEqual({ weekday: "Thursday", nth: 4 });
    expect(repeatLabel("weekly", t, "America/New_York")).toBe("Weekly on Thursday");
    expect(repeatLabel("biweekly", t, "America/New_York")).toBe("Every other Thursday");
    expect(repeatLabel("monthly", t, "America/New_York")).toBe("Monthly on the fourth Thursday");
    expect(repeatLabel("monthly", Date.UTC(2026, 9, 29, 14), "America/New_York")).toBe("Monthly on the last Thursday");
    expect(repeatLabel("none", t, "UTC")).toBe("Does not repeat");
    expect(repeatLabel("yearly", t, "UTC")).toBe("Every year");
  });
});

describe("activity", () => {
  it("shows Unreads under its own chip only", () => {
    expect(activityShows("unreads", "unreads")).toBe(true);
    expect(activityShows("all", "unreads")).toBe(false);
    expect(activityShows("all", "mentions")).toBe(true);
  });
});
