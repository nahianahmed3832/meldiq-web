import { expect, it } from "vitest";
import { activeEmojiQuery } from "../src/sync/emojiCompletion";
it("opens only the current colon token and preserves its exact replacement range", () => {
  expect(activeEmojiQuery("Hi :thumbs_up", 13)).toEqual({ start: 3, end: 13, query: "thumbs up" });
  expect(activeEmojiQuery(":", 1)).toEqual({ start: 0, end: 1, query: "" });
  for (const text of ["https://example.test", "word:smile", "`code :smile", "```\ncode :smile", ":already:", ":a" + "b".repeat(40)]) expect(activeEmojiQuery(text, text.length)).toBeNull();
  expect(activeEmojiQuery("`code` :smile tail", 13)).toEqual({ start: 7, end: 13, query: "smile" });
});
