import { describe, expect, it } from "vitest";
import { previewOf, REACTOR_PREVIEW, reactorsOf } from "../src/ui/chat/reactors";
import type { UserLite } from "../src/state/store";

const user = (id: string, displayName: string): UserLite => ({ id, username: id, displayName, avatarColor: 0, statusText: null, online: null });
const users = { ada: user("ada", "Ada"), ben: user("ben", "Ben"), cy: user("cy", "Cy") };

describe("who reacted", () => {
  it("lists each person once, you first, then in the order they reacted", () => {
    const r = reactorsOf(["ben", "me", "ada", "ben"], { ...users, me: user("me", "Me") }, "me", "You", "Someone");
    expect(r.map((x) => x.name)).toEqual(["You", "Ben", "Ada"]);
    expect(r[0].me).toBe(true);
  });

  it("names someone this browser hasn't loaded yet without inventing a name", () => {
    expect(reactorsOf(["zed"], users, "me", "You", "Someone").map((x) => x.name)).toEqual(["Someone"]);
  });

  it("falls back to the username when there's no display name", () => {
    const r = reactorsOf(["dee"], { dee: { ...user("dee", ""), displayName: undefined as unknown as string, username: "dee_42" } }, "me", "You", "Someone");
    expect(r[0].name).toBe("dee_42");
  });

  it("previews a long list and counts the rest", () => {
    const many = Array.from({ length: 23 }, (_, i) => `u${i}`);
    const { shown, more } = previewOf(reactorsOf(many, {}, "me", "You", "Someone"));
    expect(shown).toHaveLength(REACTOR_PREVIEW);
    expect(more).toBe(23 - REACTOR_PREVIEW);
  });

  it("has nothing more to show for a short list", () => {
    expect(previewOf(reactorsOf(["ada"], users, "me", "You", "Someone")).more).toBe(0);
  });
});
