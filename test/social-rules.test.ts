import { describe, expect, it } from "vitest";
import { cleanUsername, connectionState, currentPresence, dndPauseUntil, invitableCommunities, PRESENCE_MAX_MS, presenceWords, profileInviteMessage, remaining } from "../src/sync/social";

/** The phone's cases (android ConnectionRulesTest, PresenceRulesTest, ProfileInvite). */
const m = (id: string) => ({
  id,
  username: id,
  displayName: id,
  avatarColor: 0,
  statusText: null,
  statusEmoji: null,
  notificationsPaused: null,
  photoRev: null,
  homeServer: null,
  role: null,
  orgRole: null,
  online: null,
  presence: null,
  pronouns: null,
});

describe("connections and requests", () => {
  it("say where someone stands from the lists", () => {
    const lists = { connected: [m("a")], incoming: [{ user: m("b"), at: 1 }], outgoing: [{ user: m("c"), at: 1 }] };
    expect(connectionState(lists, "a")).toBe("connected");
    expect(connectionState(lists, "b")).toBe("received");
    expect(connectionState(lists, "c")).toBe("sent");
    expect(connectionState(lists, "d")).toBe("none");
    expect(connectionState(null, "a")).toBe("none");
  });

  it("clean a typed username and count what's left to send", () => {
    expect(cleanUsername("  @erin  ")).toBe("erin");
    expect(cleanUsername("@ ")).toBeNull();
    expect(cleanUsername("x".repeat(65))).toBeNull();
    expect(remaining(1, 3)).toBe(2);
    expect(remaining(5, 3)).toBe(0);
  });
});

describe("presence", () => {
  it("is automatic once a timed choice ends", () => {
    expect(currentPresence("idle", 2000, 1000)).toBe("idle");
    expect(currentPresence("idle", 1000, 1000)).toBe("auto");
    expect(currentPresence(null, null, 1)).toBe("auto");
    expect(currentPresence("dnd", null, 1)).toBe("dnd");
    expect(currentPresence("weird", null, 1)).toBe("auto");
  });

  it("pauses notifications as long as do not disturb lasts, and reads as words for others", () => {
    expect(dndPauseUntil(5000, 1000)).toBe(5000);
    expect(dndPauseUntil(null, 1000)).toBe(1000 + PRESENCE_MAX_MS);
    expect(presenceWords("idle", true)).toBe("Idle");
    expect(presenceWords("dnd", true)).toBe("Do not disturb");
    expect(presenceWords(null, true)).toBe("Online");
    expect(presenceWords("offline", false)).toBeNull();
  });
});

describe("invite from a profile", () => {
  it("offers communities where you're more than a guest, by name, and sends the name and link", () => {
    const orgs = [
      { name: "zeta", myRole: "MEMBER" },
      { name: "Alpha", myRole: "OWNER" },
      { name: "guests", myRole: "GUEST" },
    ];
    expect(invitableCommunities(orgs).map((o) => o.name)).toEqual(["Alpha", "zeta"]);
    expect(profileInviteMessage("Paint Club", "https://meldiq.app/invite/ABCD-EFGH-JKLM")).toBe("Paint Club: https://meldiq.app/invite/ABCD-EFGH-JKLM");
  });
});
