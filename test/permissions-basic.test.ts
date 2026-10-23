import { describe, expect, it } from "vitest";
import { accessRule, EVERYONE, isPrivate, privacyRule, VIEW, whoCanView } from "../src/sync/communityRules";

const o = (subject: string, kind: "everyone" | "role" | "member", label: string, allow: string[] = [], deny: string[] = []) => ({ subject, kind, label, color: null, allow, deny });

describe("channel permissions, Basic view", () => {
  it("is private when @everyone can't see it", () => {
    expect(isPrivate([o(EVERYONE, "everyone", "@everyone", [], [VIEW])])).toBe(true);
    expect(isPrivate([o(EVERYONE, "everyone", "@everyone", [], ["messages.send"])])).toBe(false);
    expect(isPrivate([])).toBe(false);
  });

  it("lists the roles and members who can see it, roles first", () => {
    const list = [o(EVERYONE, "everyone", "@everyone", [], [VIEW]), o("user:zed", "member", "Zed", [VIEW]), o("r1", "role", "Staff", [VIEW]), o("r2", "role", "Guests", [], [VIEW])];
    expect(whoCanView(list).map((x) => x.label)).toEqual(["Staff", "Zed"]);
  });

  it("changes only seeing it, keeping every other rule", () => {
    const list = [o(EVERYONE, "everyone", "@everyone", ["messages.react"], ["messages.send"])];
    expect(privacyRule(list, true)).toEqual({ subject: EVERYONE, allow: ["messages.react"], deny: ["messages.send", VIEW] });
    expect(privacyRule([o(EVERYONE, "everyone", "@everyone", [], [VIEW, "messages.send"])], false)).toEqual({ subject: EVERYONE, allow: [], deny: ["messages.send"] });
    expect(accessRule([o("r1", "role", "Staff", [], ["messages.send"])], "r1", true)).toEqual({ subject: "r1", allow: [VIEW], deny: ["messages.send"] });
    expect(accessRule([o("r1", "role", "Staff", [VIEW])], "r1", false)).toEqual({ subject: "r1", allow: [], deny: [] });
    expect(accessRule([], "user:u1", true)).toEqual({ subject: "user:u1", allow: [VIEW], deny: [] });
  });
});

describe("event creation steps", () => {
  it("goes on from Where with a room, and from What and when with nothing left to fix", async () => {
    const { eventStepReady } = await import("../src/sync/workspaceC5");
    expect(eventStepReady(0, null, [])).toBe(false);
    expect(eventStepReady(0, "room", ["Give the meeting a title"])).toBe(true);
    expect(eventStepReady(1, "room", ["Give the meeting a title"])).toBe(false);
    expect(eventStepReady(1, "room", [])).toBe(true);
  });
});
