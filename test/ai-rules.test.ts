import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import { CATCH_UP_CHARS, CATCH_UP_MAX, CATCH_UP_MESSAGE_CHARS, catchUpMessages } from "../src/sync/ai";

/** The catch-up selection, ported from android AiRules.catchUp (round 7 C8). */
const msg = (i: number, extra: Partial<StoredMessage> = {}): StoredMessage =>
  ({ id: `m${i}`, senderUserId: i % 2 ? "u1" : "u2", kind: "text", text: `message ${i}`, deleted: false, sortTs: 1000 + i, ...extra }) as StoredMessage;
const names = (id: string) => (id === "u1" ? "Ann" : "Bo");

describe("catch-up messages", () => {
  it("keeps the newest readable messages, oldest first, with their authors", () => {
    const picked = catchUpMessages([msg(1), msg(2, { deleted: true }), msg(3, { kind: "undecryptable" }), msg(4, { kind: "call" }), msg(5, { text: "  " }), msg(6)], names);
    expect(picked).toEqual([
      { author: "Ann", text: "message 1", at: 1001 },
      { author: "Bo", text: "message 6", at: 1006 },
    ]);
  });

  it(`takes at most ${CATCH_UP_MAX} messages, the newest`, () => {
    const picked = catchUpMessages(
      Array.from({ length: CATCH_UP_MAX + 20 }, (_, i) => msg(i)),
      names,
    );
    expect(picked).toHaveLength(CATCH_UP_MAX);
    expect(picked[0].text).toBe("message 20");
    expect(picked.at(-1)?.text).toBe(`message ${CATCH_UP_MAX + 19}`);
  });

  it("cuts one long message and stops before the text limit", () => {
    const long = "x".repeat(CATCH_UP_MESSAGE_CHARS + 500);
    const picked = catchUpMessages(
      Array.from({ length: 40 }, (_, i) => msg(i, { text: long })),
      names,
    );
    expect(picked.every((m) => m.text.length === CATCH_UP_MESSAGE_CHARS)).toBe(true);
    expect(picked.reduce((n, m) => n + m.text.length + m.author.length + 2, 0)).toBeLessThanOrEqual(CATCH_UP_CHARS);
    expect(picked).toHaveLength(Math.floor(CATCH_UP_CHARS / (CATCH_UP_MESSAGE_CHARS + 4)));
  });

  it("names an unknown author ?", () => {
    expect(catchUpMessages([msg(1)], () => "")[0].author).toBe("?");
  });
});
