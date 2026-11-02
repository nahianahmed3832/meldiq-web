import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { zProfile } from "../src/api/schemas";
import { zProfileStyle } from "../src/api/profileSchemas";
import { groupAddProblem, groupAddRefusalText } from "../src/sync/groupAdd";
import { levelColor, LEVEL_COLORS } from "../src/ui/people/LevelRing";
import { nameBadge } from "../src/ui/people/NameBadge";
import { isPreset, THEME_PRESETS, themeBackground, themeColorsOf } from "../src/ui/people/profileTheme";
import { leaveSummary } from "../src/ui/settings/LeaveManyDialog";
import { lighten } from "../src/ui/settings/ProfileThemePicker";
import { levelUpProblem } from "../src/ui/points/PointsPage";
import { historyLabel, levelProgress, questLabel, signed, streakInWeek } from "../src/ui/points/pointsWords";

/** Settings parity, batch A (API 0.65.0): the rules the web adds on top of the server's answers. */

describe("profile theme", () => {
  it("reads theme colours, falls back to the accent of older servers, and drops anything malformed", () => {
    expect(themeColorsOf({ accent: "#ff0000", themeColors: ["#ff0000", "#00ff00"] })).toEqual(["#ff0000", "#00ff00"]);
    expect(themeColorsOf({ accent: "#123456", themeColors: null })).toEqual(["#123456"]);
    expect(themeColorsOf({ accent: null, themeColors: null })).toBeNull();
    const style = zProfileStyle.parse({ decoration: null, effect: null, accent: "#AA0000", themeColors: ["#AA0000", "#00BB00"] });
    expect(style?.themeColors).toEqual(["#aa0000", "#00bb00"]);
    expect(zProfileStyle.parse({ decoration: null, effect: null, accent: null, themeColors: ["red", "#000000", "#111111"] })?.themeColors).toBeNull();
  });

  it("paints one colour solid and two as a gradient", () => {
    expect(themeBackground(["#101010"])).toBe("#101010");
    expect(themeBackground(["#101010", "#202020"])).toBe("linear-gradient(135deg, #101010, #202020)");
  });

  it("has twelve two-colour presets in lower case, recognised when picked", () => {
    expect(THEME_PRESETS).toHaveLength(12);
    for (const p of THEME_PRESETS) expect(p.colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(isPreset(["#FF7E5F", "#feb47b"], THEME_PRESETS[0].colors)).toBe(true);
    expect(isPreset(["#ff7e5f"], THEME_PRESETS[0].colors)).toBe(false);
    expect(isPreset(null, THEME_PRESETS[0].colors)).toBe(false);
  });

  it("starts a second colour as a lighter shade of the first", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#ffffff", 0.5)).toBe("#ffffff");
  });
});

describe("the badge shown by a name", () => {
  const mojo = { badge: "plus" as const, check: false };
  it("shows the chosen badge, none for none, and the Meldiq Plus badge by default", () => {
    expect(nameBadge(null, mojo)).toBe("mojo");
    expect(nameBadge(null, null)).toBeNull();
    expect(nameBadge("none", mojo)).toBeNull();
    expect(nameBadge("bug-hunter", mojo)).toBe("bug-hunter");
    expect(nameBadge("artist", null)).toBe("artist");
    expect(nameBadge("mojo", null)).toBeNull();
  });

  it("reads an unknown badge as the default", () => {
    expect(zProfileStyle.parse({ decoration: null, effect: null, accent: null, shownBadge: "creator" })?.shownBadge).toBeNull();
  });
});

describe("account levels", () => {
  it("changes the ring colour every 10 levels and keeps the last one past 100", () => {
    expect(levelColor(1)).toBe(LEVEL_COLORS[0]);
    expect(levelColor(10)).toBe(LEVEL_COLORS[0]);
    expect(levelColor(11)).toBe(LEVEL_COLORS[1]);
    expect(levelColor(100)).toBe(LEVEL_COLORS[9]);
    expect(levelColor(250)).toBe(LEVEL_COLORS[9]);
    expect(new Set(LEVEL_COLORS).size).toBe(10);
  });

  it("reads the level from profiles, null on older servers", () => {
    const base = { id: "u", username: "a", displayName: "A", identityKey: "k", fingerprint: "f" };
    expect(zProfile.parse({ ...base, level: 4 }).level).toBe(4);
    expect(zProfile.parse(base).level).toBeNull();
  });

  it("says what a refused level-up costs", () => {
    expect(levelUpProblem(new ApiError(409, "not_enough_points", "x", { cost: 100, balance: 30 }))).toBe("The next level costs 100 Embers and you have 30.");
    expect(levelUpProblem(new ApiError(500, "internal", "Server trouble"))).toBe("Server trouble");
    expect(levelUpProblem(new Error("boom"))).toBe("Couldn't level up. Try again.");
  });
});

describe("points page words", () => {
  it("names quests and history rows, and an unknown quest from its id", () => {
    expect(questLabel({ id: "daily-chats", goal: 3 })).toBe("Talk in 3 different chats");
    expect(questLabel({ id: "two-step", goal: 1 })).toBe("Turn on two-step sign-in");
    expect(questLabel({ id: "new-thing", goal: 1 })).toBe("New thing");
    expect(historyLabel({ kind: "quest", detail: "friend" })).toBe("Quest: Make a friend");
    expect(historyLabel({ kind: "level", detail: "3" })).toBe("Reached level 3");
    expect(historyLabel({ kind: "unknown", detail: null })).toBe("Embers");
  });

  it("signs amounts, bounds progress and shows a full week on the 7th day", () => {
    expect(signed(5)).toBe("+5");
    expect(signed(-100)).toBe("−100");
    expect(levelProgress(50, 100)).toBe(0.5);
    expect(levelProgress(250, 100)).toBe(1);
    expect(streakInWeek(0)).toBe(0);
    expect(streakInWeek(3)).toBe(3);
    expect(streakInWeek(7)).toBe(7);
    expect(streakInWeek(8)).toBe(1);
  });
});

describe("who may add you to group chats", () => {
  const names: Record<string, string> = { a: "Ana", b: "Ben", c: "Cal" };
  it("names who refused, then counts the rest", () => {
    expect(groupAddRefusalText(["a"], (id) => names[id])).toBe("Ana doesn't let you add them to group chats.");
    expect(groupAddRefusalText(["a", "b"], (id) => names[id])).toBe("Ana and Ben don't let you add them to group chats.");
    expect(groupAddRefusalText(["a", "b", "c", "x"], (id) => names[id])).toBe("Ana, Ben and 2 more don't let you add them to group chats.");
    expect(groupAddRefusalText(["x"], () => null)).toBe("Someone doesn't let you add them to group chats.");
  });

  it("reads only the group_add_not_allowed refusal", () => {
    const refusal = new ApiError(403, "group_add_not_allowed", "Some of these people don't let you add them", { userIds: ["b"] });
    expect(groupAddProblem(refusal, (id) => names[id])).toBe("Ben doesn't let you add them to group chats.");
    expect(groupAddProblem(new ApiError(403, "forbidden", "No"), (id) => names[id])).toBeNull();
    expect(groupAddProblem(new Error("x"), (id) => names[id])).toBeNull();
  });
});

describe("leaving several communities", () => {
  const names: Record<string, string> = { o1: "Cats", o2: "Dogs", o3: "Birds" };
  it("says what was left, what you own and what you'd already left", () => {
    expect(leaveSummary({ left: ["o1", "o2"], skippedOwned: ["o3"], notMember: [] }, (id) => names[id])).toEqual(["You left 2 communities: Cats, Dogs.", "You own Birds, so it stays."]);
    expect(leaveSummary({ left: [], skippedOwned: [], notMember: ["o1"] }, (id) => names[id])).toEqual(["You didn't leave any community.", "You weren't in Cats any more."]);
  });
});
