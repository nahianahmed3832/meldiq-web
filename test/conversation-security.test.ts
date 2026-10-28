import { describe, expect, it } from "vitest";
import { isRemoteUsername, needsAttention, securityPoints } from "../src/sync/conversationSecurity";

/** The conversation security panel's facts (android ConversationSecurity), only those that apply. */
describe("conversation security facts", () => {
  it("a direct message: encryption and what the server sees, with no safety-number points (retired in brief v4 §13)", () => {
    expect(securityPoints({ type: "DM", changedMembers: 0, otherServers: 0 })).toEqual(["messages", "files", "calls_e2ee", "metadata"]);
  });

  it("a channel with a changed key and a member elsewhere: the warning comes first, app updates are named", () => {
    const f = { type: "CHANNEL" as const, changedMembers: 1, otherServers: 2 };
    expect(securityPoints(f)).toEqual(["keys_changed", "messages", "files", "calls_e2ee", "other_servers", "app_updates", "metadata"]);
    expect(needsAttention(f)).toBe(true);
  });

  it("a group", () => {
    const group = { type: "GROUP" as const, changedMembers: 0, otherServers: 0 };
    expect(securityPoints(group)).not.toContain("app_updates");
    expect(needsAttention(group)).toBe(false);
    expect(isRemoteUsername("ann:meldiq.example")).toBe(true);
    expect(isRemoteUsername("ann")).toBe(false);
  });
});
