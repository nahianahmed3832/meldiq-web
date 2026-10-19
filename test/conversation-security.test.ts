import { describe, expect, it } from "vitest";
import { isRemoteUsername, needsAttention, securityPoints } from "../src/sync/conversationSecurity";

/** The conversation security panel's facts (android ConversationSecurity), only those that apply. */
describe("conversation security facts", () => {
  it("a verified direct message: encryption, verified, what the server sees", () => {
    expect(securityPoints({ type: "DM", peerVerified: true, changedMembers: 0, otherServers: 0 })).toEqual(["messages", "files", "calls_e2ee", "verified", "metadata"]);
  });

  it("a channel with a changed key and a member elsewhere: the warning comes first, app updates are named", () => {
    const f = { type: "CHANNEL" as const, peerVerified: null, changedMembers: 1, otherServers: 2 };
    expect(securityPoints(f)).toEqual(["keys_changed", "messages", "files", "calls_e2ee", "verify_members", "other_servers", "app_updates", "metadata"]);
    expect(needsAttention(f)).toBe(true);
  });

  it("an unverified direct message and a group", () => {
    expect(securityPoints({ type: "DM", peerVerified: false, changedMembers: 0, otherServers: 0 })).toContain("not_verified");
    const group = { type: "GROUP" as const, peerVerified: null, changedMembers: 0, otherServers: 0 };
    expect(securityPoints(group)).not.toContain("app_updates");
    expect(needsAttention(group)).toBe(false);
    expect(isRemoteUsername("ann:meldiq.example")).toBe(true);
    expect(isRemoteUsername("ann")).toBe(false);
  });
});
