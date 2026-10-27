import { describe, expect, it } from "vitest";
import { newRequests } from "../src/ui/people/connectionRequests";

const req = (id: string, at: number) => ({
  user: {
    id,
    username: id,
    displayName: id.toUpperCase(),
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
    avatarMedia: null,
    profileStyle: null,
    tag: null,
  },
  at,
});

describe("connection requests to tell about", () => {
  it("tells about requests that weren't there at the last check", () => {
    expect(newRequests([req("a", 1)], [req("a", 1), req("b", 2)], 0).map((e) => e.user.id)).toEqual(["b"]);
  });

  it("tells about nothing when a request was accepted, declined or cancelled", () => {
    expect(newRequests([req("a", 1), req("b", 2)], [req("a", 1)], 0)).toEqual([]);
  });

  it("on a page's first check, tells only about requests newer than the ones already told about in this browser", () => {
    expect(newRequests(null, [req("old", 100), req("new", 300)], 200).map((e) => e.user.id)).toEqual(["new"]);
    expect(newRequests(null, [req("a", 100)], 0).map((e) => e.user.id)).toEqual(["a"]);
  });
});
