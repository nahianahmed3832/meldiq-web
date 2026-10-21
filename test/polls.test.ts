import { describe, expect, it } from "vitest";
import type { RichContent } from "../src/model/types";
import { applyVote, cleanEmoji, cleanPoll, pollClosed, pollFallback } from "../src/sync/polls";

/** Poll end times and answer emoji (android batch B8, ForumPollRulesTest): the same rules on the web. */
describe("polls with an end time and answer emoji", () => {
  const poll = {
    question: "Lunch?",
    options: [
      { id: "o1", text: "Pizza", emoji: "🍕" },
      { id: "o2", text: "Rice", emoji: "A" },
    ],
    multi: false,
    endsAt: 5000,
  };

  it("keep a valid emoji per answer and the end time", () => {
    const p = cleanPoll(poll)!;
    expect(p.options.map((o) => o.emoji)).toEqual(["🍕", undefined]);
    expect(p.endsAt).toBe(5000);
    expect(cleanPoll({ ...poll, endsAt: -1 })!.endsAt).toBeUndefined();
    expect(cleanEmoji("🎉1")).toBeUndefined();
    expect(pollFallback(p)).toBe("📊 Lunch?\n1. 🍕 Pizza\n2. Rice");
  });

  it("close at the end time, and votes the server accepted after it don't count", () => {
    const rich = { poll: cleanPoll(poll)! } as RichContent;
    expect(pollClosed(rich, 4999)).toBe(false);
    expect(pollClosed(rich, 5000)).toBe(true);
    expect(applyVote(rich, "u1", ["o1"], 4000).votes).toEqual({ u1: ["o1"] });
    expect(applyVote(rich, "u1", ["o1"], 6000)).toBe(rich);
  });
});
