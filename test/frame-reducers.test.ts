import { describe, expect, it } from "vitest";
import { initialState } from "../src/state/store";
import { callFrame, orgDeletedFrame, presenceFrame, typingFrame } from "../src/sync/frameReducers";

describe("realtime frames that only change what's shown", () => {
  it("typing shows for six seconds and stops when told", () => {
    const on = typingFrame(initialState, "c1", "u1", true, 1000);
    expect(on.typing.c1.u1).toBe(7000);
    expect(typingFrame(on, "c1", "u1", false).typing.c1).toEqual({});
  });

  it("presence changes only people already known", () => {
    const s = { ...initialState, users: { u1: { id: "u1", username: "a", displayName: "A", avatarColor: 0, online: false } as never } };
    expect(presenceFrame(s, "u1", true).users.u1.online).toBe(true);
    expect(presenceFrame(s, "u2", true)).toBe(s);
  });

  it("a deleted workspace takes its conversations with it; ended calls leave the live list", () => {
    const s = { ...initialState, orgs: [{ id: "o1" } as never, { id: "o2" } as never], conversations: { a: { id: "a", orgId: "o1" } as never, b: { id: "b", orgId: null } as never } };
    const after = orgDeletedFrame(s, "o1");
    expect(after.orgs.map((o) => o.id)).toEqual(["o2"]);
    expect(Object.keys(after.conversations)).toEqual(["b"]);
    const live = callFrame(initialState, { conversationId: "c1", state: "RINGING" } as never);
    expect(Object.keys(live.calls)).toEqual(["c1"]);
    expect(callFrame(live, { conversationId: "c1", state: "ENDED" } as never).calls).toEqual({});
  });
});
