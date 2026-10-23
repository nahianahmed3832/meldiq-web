import { describe, expect, it } from "vitest";
import { cleanOrigin } from "../src/sync/rules";

describe("a forwarded message's origin", () => {
  it("keeps a short place name, a plausible time and well-formed ids", () => {
    expect(cleanOrigin({ place: "  GriipBuddy   Team ", at: 1_700_000_000_000, conversationId: "c_1", messageId: "m-2" })).toEqual({
      place: "GriipBuddy Team",
      at: 1_700_000_000_000,
      conversationId: "c_1",
      messageId: "m-2",
    });
    expect(cleanOrigin({ place: "x".repeat(100) })?.place).toHaveLength(60);
  });

  it("drops what isn't usable: no place, a bad time, ids that don't come in pairs or look wrong", () => {
    expect(cleanOrigin({ at: 5 })).toBeNull();
    expect(cleanOrigin(null)).toBeNull();
    expect(cleanOrigin({ place: "A", at: -1 })?.at).toBeNull();
    expect(cleanOrigin({ place: "A", conversationId: "c1" })).toEqual({ place: "A", at: null, conversationId: null, messageId: null });
    expect(cleanOrigin({ place: "A", conversationId: "c 1", messageId: "m1" })?.conversationId).toBeNull();
  });
});
