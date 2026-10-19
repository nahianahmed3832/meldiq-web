import { describe, expect, it } from "vitest";
import { applyClose, applyVote, cleanPoll, composePoll, pollFallback, tally, voters } from "../src/sync/polls";
import { cleanSticker, findSticker, searchStickers, STICKER_PACKS, stickerFallback } from "../src/sync/stickers";

/** android PollRulesTest / RichContentRulesTest cases, against the browser's port. */
describe("polls", () => {
  const poll = composePoll("Lunch?", ["Pizza", "  ", "Sushi", "Salad"], false)!;

  it("composes ids in order, drops blanks, and refuses fewer than two options or no question", () => {
    expect(poll.options).toEqual([
      { id: "o1", text: "Pizza" },
      { id: "o2", text: "Sushi" },
      { id: "o3", text: "Salad" },
    ]);
    expect(composePoll("Q", ["only one"], false)).toBeNull();
    expect(composePoll("   ", ["a", "b"], false)).toBeNull();
  });

  it("cleans received polls: squashed whitespace, bounded, bad and repeated ids dropped, at most ten options", () => {
    const p = cleanPoll({
      question: "  What \n now?  ",
      options: [{ id: "a", text: "x" }, { id: "a", text: "dup" }, { id: "bad id!", text: "y" }, ...Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, text: `t${i}` }))],
      multi: true,
    })!;
    expect(p.question).toBe("What now?");
    expect(p.options[0]).toEqual({ id: "a", text: "x" });
    expect(p.options.map((o) => o.id)).not.toContain("bad id!");
    expect(p.options).toHaveLength(10);
  });

  it("a vote replaces the voter's earlier one, keeps one choice unless several are allowed, ignores unknown options, and empty takes it back", () => {
    let r = applyVote({ poll }, "u1", ["o1"]);
    r = applyVote(r, "u2", ["o2", "o3", "zz"]);
    expect(r.votes).toEqual({ u1: ["o1"], u2: ["o2"] });
    r = applyVote(r, "u1", ["o3"]);
    expect(tally(r).map((o) => o.votes)).toEqual([0, 1, 1]);
    expect(voters(r)).toBe(2);
    r = applyVote(r, "u2", []);
    expect(voters(r)).toBe(1);
    const multi = applyVote({ poll: { ...poll, multi: true } }, "u1", ["o1", "o3", "o1"]);
    expect(multi.votes?.u1).toEqual(["o1", "o3"]);
  });

  it("only the poll's sender closes it, and a closed poll takes no more votes", () => {
    expect(applyClose({ poll }, "creator", "someone").pollClosed).toBeUndefined();
    const closed = applyClose({ poll }, "creator", "creator");
    expect(closed.pollClosed).toBe(true);
    expect(applyVote(closed, "u1", ["o1"]).votes).toBeUndefined();
  });

  it("gives older apps a readable fallback", () => {
    expect(pollFallback(poll)).toBe("📊 Lunch?\n1. Pizza\n2. Sushi\n3. Salad");
  });
});

describe("stickers", () => {
  it("reads the shared catalogue: three packs, every sticker with a known tone and motion", () => {
    expect(STICKER_PACKS.map((p) => [p.id, p.stickers.length])).toEqual([
      ["work", 12],
      ["celebrate", 8],
      ["feels", 8],
    ]);
    expect(findSticker({ pack: "work", id: "lgtm" })).toMatchObject({ emoji: "👍", caption: "LGTM", tone: "green", motion: "stamp" });
    expect(stickerFallback(findSticker({ pack: "work", id: "lgtm" })!)).toBe("👍 LGTM");
  });

  it("checks received references and finds nothing for unknown ones (they show their fallback text)", () => {
    expect(cleanSticker({ pack: "work", id: "../x" })).toBeNull();
    expect(findSticker({ pack: "work", id: "not-there" })).toBeNull();
  });

  it("searches captions and keywords", () => {
    expect(searchStickers("approve").map((s) => s.spec.id)).toContain("lgtm");
    expect(searchStickers("").length).toBe(28);
  });
});
