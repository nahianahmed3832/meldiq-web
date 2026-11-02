import { describe, expect, it, vi } from "vitest";
import type { RichContent } from "../src/model/types";
import { encodePayload, parsePayload } from "../src/protocol/payload";
import { applyVote, composePoll, pollPercentage, pollVoterList, tally, voters } from "../src/sync/polls";

const poll = composePoll("Next community night?", ["Games", "Film"], true)!;
describe("poll results and hidden-name ballots", () => {
  it("uses distinct valid voters as the percentage denominator for multiple answers", () => {
    const rich: RichContent = { poll, votes: { a: ["o1", "o1", "o2"], b: ["o1"], empty: [], invalid: ["missing"] } };
    expect(voters(rich)).toBe(2);
    expect(tally(rich).map((o) => [o.votes, pollPercentage(o.votes, voters(rich))])).toEqual([
      [2, 100],
      [1, 50],
    ]);
    expect(pollPercentage(0, 0)).toBe(0);
    expect(pollPercentage(1, 3)).toBe(33);
    expect(tally({ ...rich, poll: { ...poll, multi: false } }).map((o) => o.votes)).toEqual([2, 0]);
  });
  it("never resolves hidden voters or returns their identifiers in display records", () => {
    const nameOf = vi.fn((id: string) => (id === "public" ? "Mina" : "Should never appear"));
    const rich = applyVote(applyVote({ poll }, "secret-user-id", ["o1", "o2"], 1, true), "public", ["o1"], 2, false);
    const rows = pollVoterList(rich, nameOf);
    expect(nameOf.mock.calls).toEqual([["public"]]);
    expect(rows).toEqual([
      { key: "member-public", userId: "public", name: "Mina", choices: ["Games"], anonymous: false },
      { key: "anonymous-0", userId: null, name: "Anonymous voter", choices: ["Games", "Film"], anonymous: true },
    ]);
    expect(JSON.stringify(rows)).not.toContain("secret-user-id");
    expect(pollVoterList(rich, nameOf, "o2")).toHaveLength(1);
  });
  it("syncs visibility changes, keeps hidden names for legacy votes, and clears retracted ballots", () => {
    let rich = applyVote({ poll }, "u1", ["o1"], 1, true);
    rich = applyVote(rich, "u1", ["o2"], 2);
    expect(rich.votePrivacy).toEqual({ u1: true });
    expect(voters(rich)).toBe(1);
    rich = applyVote(rich, "u1", ["o2"], 3, false);
    expect(rich.votePrivacy).toBeUndefined();
    rich = applyVote(rich, "u1", ["o1"], 4, true);
    rich = applyVote(rich, "u1", [], 5, true);
    expect(rich.votePrivacy).toBeUndefined();
    expect(voters(rich)).toBe(0);
  });
  it("round-trips vote privacy through the existing control protocol", () => {
    expect(parsePayload(encodePayload({ type: "vote", target: "poll-id", choices: ["o1"], anonymous: true }))).toMatchObject({ anonymous: true });
    expect(parsePayload(encodePayload({ type: "vote", target: "poll-id", choices: ["o1"], anonymous: false }))).toMatchObject({ anonymous: false });
    expect(parsePayload('{"type":"vote","anonymous":"yes"}')).toBeNull();
  });
  it("rejects duplicate answers and stops votes exactly at the scheduled end", () => {
    expect(composePoll("Q", [" Film ", "film"], false)).toBeNull();
    expect(composePoll("Q", ["a b", "a  b"], false)).toBeNull();
    const rich = { poll: composePoll("Q", ["a", "b"], false, 5000)! };
    expect(applyVote(rich, "u1", ["o1"], 5000, true)).toBe(rich);
    expect(applyVote(rich, "u1", ["o1"], 4999, true).votePrivacy).toEqual({ u1: true });
  });
});
