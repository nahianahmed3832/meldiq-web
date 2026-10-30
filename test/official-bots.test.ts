import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { memberListGroups } from "../src/ui/chat/memberListRules";
import {
  BOT_LIMITS,
  botStatusLine,
  changedSettings,
  cleanSettings,
  commandProblem,
  DEFAULT_WELCOME,
  alertSourceProblem,
  fillWelcome,
  isPlusValue,
  levelFromXp,
  lookNameProblem,
  plusFields,
  plusNeeded,
  settingsDraft,
  settingsProblem,
} from "../src/sync/officialBotRules";
import { isUnavailable, officialBotError } from "../src/sync/officialBots";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "contract-fixtures/http", `${name}.json`), "utf8")) as Record<string, unknown>;

describe("official bot settings drafts", () => {
  it("fills in the defaults for anything the server left out", () => {
    // Arrange / Act
    const draft = settingsDraft("starboard", { channelId: "c1" });
    // Assert
    expect(draft).toEqual({ channelId: "c1", threshold: 5, emoji: null, selfStar: false, excludeChannelIds: [] });
    expect(settingsDraft("welcomer", null).messages).toEqual([DEFAULT_WELCOME]);
  });

  it("keeps an unknown bot's settings as they are", () => {
    expect(settingsDraft("tickets", { a: 1 })).toEqual({ a: 1 });
  });

  it("sends only the fields that changed", () => {
    const original = settingsDraft("levels", { boost: 2, roleRewards: [{ level: 5, roleId: "r" }] });
    const draft = { ...original, announce: false };
    expect(changedSettings(original, draft)).toEqual({ announce: false });
  });

  it("reads the server's welcomer fixture into a full draft", () => {
    const bot = fixture("PUT_v1_orgs_orgId_official-bots_key").bot as { settings: Record<string, unknown> };
    const draft = settingsDraft("welcomer", bot.settings);
    expect(settingsProblem("welcomer", draft, false)).toBeNull();
  });
});

describe("Plus gating", () => {
  it("lists each bot's Plus fields", () => {
    expect(plusFields("welcomer")).toEqual(["messages", "goodbye"]);
    expect(plusFields("starboard")).toEqual(["emoji", "selfStar", "excludeChannelIds"]);
    expect(plusFields("tickets")).toEqual([]);
  });

  it("counts a value as Plus only past the free amount", () => {
    expect(isPlusValue("welcomer", "messages", { messages: ["a"] })).toBe(false);
    expect(isPlusValue("welcomer", "messages", { messages: ["a", "b"] })).toBe(true);
    expect(isPlusValue("levels", "boost", { boost: 1 })).toBe(false);
    expect(isPlusValue("levels", "boost", { boost: 1.5 })).toBe(true);
    expect(isPlusValue("giveaways", "requiredRoleId", { requiredRoleId: null })).toBe(false);
    expect(isPlusValue("giveaways", "requiredRoleId", { requiredRoleId: "rl_1" })).toBe(true);
    expect(plusFields("wordy")).toEqual([]);
  });

  it("needs Bots+ for a changed Plus value, never for a kept (paused) one", () => {
    const original = settingsDraft("logger", { memberChannelId: "m1" });
    // A paused Plus setting the community kept: changing something free doesn't send it.
    expect(plusNeeded("logger", original, { ...original, channelId: "c2" }, false)).toEqual([]);
    expect(plusNeeded("logger", original, { ...original, excludeChannelIds: ["x"] }, false)).toEqual(["excludeChannelIds"]);
    expect(plusNeeded("logger", original, { ...original, excludeChannelIds: ["x"] }, true)).toEqual([]);
  });

  it("clearing a Plus value doesn't need Bots+", () => {
    const original = settingsDraft("starboard", { emoji: "🔥" });
    expect(plusNeeded("starboard", original, { ...original, emoji: null }, false)).toEqual([]);
  });
});

describe("settings checks", () => {
  it("allows one greeting without Bots+ and ten with it", () => {
    const two = settingsDraft("welcomer", { messages: ["Hi {user}", "Hey {name}"] });
    expect(settingsProblem("welcomer", two, false)).toMatch(/Bots\+/);
    expect(settingsProblem("welcomer", two, true)).toBeNull();
    const eleven = settingsDraft("welcomer", { messages: Array.from({ length: 11 }, (_, i) => `hi ${i}`) });
    expect(settingsProblem("welcomer", eleven, true)).toMatch(/10/);
  });

  it("refuses empty and over-long greetings", () => {
    expect(settingsProblem("welcomer", settingsDraft("welcomer", { messages: ["  "] }), false)).toMatch(/empty/);
    expect(settingsProblem("welcomer", settingsDraft("welcomer", { messages: ["x".repeat(301)] }), false)).toMatch(/300/);
  });

  it("checks Helper commands: names, built-ins, repeats and answers", () => {
    expect(commandProblem({ name: "!Rules", response: "Be kind" }, [])).toBeNull();
    expect(commandProblem({ name: "roll", response: "x" }, [])).toMatch(/built-in/);
    expect(commandProblem({ name: "my rules", response: "x" }, [])).toMatch(/letters/);
    expect(commandProblem({ name: "rules", response: "x" }, [{ name: "!rules", response: "y" }])).toMatch(/already/);
    expect(commandProblem({ name: "rules", response: " " }, [])).toMatch(/answer/);
    expect(commandProblem({ name: "a".repeat(33), response: "x" }, [])).toMatch(/32/);
  });

  it("checks level rewards: range, a role each, each role once", () => {
    const base = settingsDraft("levels", null);
    expect(settingsProblem("levels", { ...base, roleRewards: [{ level: 0, roleId: "r" }] }, true)).toMatch(/1 to 500/);
    expect(settingsProblem("levels", { ...base, roleRewards: [{ level: 5, roleId: "" }] }, true)).toMatch(/Pick a role/);
    expect(
      settingsProblem(
        "levels",
        {
          ...base,
          roleRewards: [
            { level: 5, roleId: "r" },
            { level: 10, roleId: "r" },
          ],
        },
        true,
      ),
    ).toMatch(/once/);
    expect(settingsProblem("levels", { ...base, boost: 3 }, true)).toMatch(/boost/);
  });

  it("allows only the reference's star thresholds and 25 left-out channels", () => {
    const base = settingsDraft("starboard", null);
    for (const t of BOT_LIMITS.starThresholds) expect(settingsProblem("starboard", { ...base, threshold: t }, false)).toBeNull();
    expect(settingsProblem("starboard", { ...base, threshold: 6 }, false)).toMatch(/stars/);
    expect(settingsProblem("logger", { ...settingsDraft("logger", null), excludeChannelIds: Array.from({ length: 26 }, (_, i) => `c${i}`) }, true)).toMatch(/25/);
  });

  it("takes a YouTube channel link or an @handle for Alerts", () => {
    for (const ok of ["https://www.youtube.com/@meldiq", "youtube.com/channel/UCabc_-1", "https://youtube.com/user/chef", "@chefanna"]) expect(alertSourceProblem(ok)).toBeNull();
    expect(alertSourceProblem("")).toMatch(/link/);
    expect(alertSourceProblem("https://youtu.be/abc")).toMatch(/isn't a YouTube channel/);
    expect(alertSourceProblem("https://example.com/@x")).toMatch(/isn't a YouTube channel/);
  });

  it("cleans what's sent: trimmed text, empty optional text as null, names without !", () => {
    expect(cleanSettings("welcomer", { channelId: null, messages: [" hi "], goodbye: "  " })).toEqual({ channelId: null, messages: ["hi"], goodbye: null });
    expect(cleanSettings("helper", { commands: [{ name: " !Rules ", response: " ok " }] })).toEqual({ commands: [{ name: "rules", response: "ok" }] });
  });
});

describe("words and previews", () => {
  it("fills the greeting's placeholders for the preview", () => {
    expect(fillWelcome(DEFAULT_WELCOME, { user: "ana", name: "Ana", server: "Night Owls", count: 42 })).toBe("Welcome to Night Owls, @ana! 👋");
    expect(fillWelcome("{name} makes {count}", { user: "a", name: "Ana", server: "S", count: 3 })).toBe("Ana makes 3");
  });

  it("limits the bot's name here to 32 characters", () => {
    expect(lookNameProblem("Doorbell")).toBeNull();
    expect(lookNameProblem("")).toBeNull();
    expect(lookNameProblem("x".repeat(33))).toMatch(/32/);
  });

  it("writes the Bots page's status line", () => {
    expect(botStatusLine({ enabled: false, available: true }, false)).toBe("Off · FREE · tap for details");
    expect(botStatusLine({ enabled: true, available: true }, true)).toBe("On · PLUS · tap for details");
    expect(botStatusLine({ enabled: false, available: false }, false)).toBe("Coming soon · FREE · tap for details");
    expect(botStatusLine({ enabled: false, available: false, unavailableReason: "Needs a YouTube API key" }, false)).toBe("Unavailable · FREE · tap for details");
  });

  it("turns Levels XP into levels", () => {
    expect([0, 99, 100, 399, 400, 2500].map(levelFromXp)).toEqual([0, 0, 1, 1, 2, 5]);
  });

  it("puts the server's refusals in words", () => {
    expect(officialBotError(new ApiError(403, "bots_plus_required", "x", { bot: "levels", settings: ["boost"] }))).toMatch(/Bots\+ \(boost\)/);
    expect(officialBotError(new ApiError(409, "official_bot_off", "x"))).toMatch(/on first/);
    const unavailable = new ApiError(409, "official_bot_unavailable", "Giveaways isn't ready yet.");
    expect(isUnavailable(unavailable)).toBe(true);
    expect(officialBotError(unavailable)).toBe("Giveaways isn't ready yet.");
  });
});

describe("member list bots", () => {
  it("lists bots under Bots before Offline, whatever their presence", () => {
    const groups = memberListGroups(
      [
        { id: "1", displayName: "zoe", presence: "online" as const, online: true },
        { id: "2", displayName: "Doorbell", presence: null, online: null, bot: true },
        { id: "3", displayName: "amir", presence: "offline" as const, online: false },
      ],
      () => [],
    );
    expect(groups.map((g) => [g.label, g.members.map((m) => m.displayName)])).toEqual([
      ["Online", ["zoe"]],
      ["Bots", ["Doorbell"]],
      ["Offline", ["amir"]],
    ]);
  });
});
