import { describe, expect, it } from "vitest";
import {
  cleanTagNames,
  cleanTags,
  cleanTitle,
  filterPosts,
  guidelinesPreview,
  MAX_TAG_NAME,
  MAX_TAGS_PER_POST,
  MAX_TITLE,
  postBody,
  posts,
  postText,
  titleOf,
  topReaction,
} from "../src/sync/forumRules";

/** The phone's cases (android ForumRulesTest, ForumPollRulesTest). */
describe("forum posts", () => {
  it("have one bounded line as a title", () => {
    expect(cleanTitle("  Best telescope\n for   beginners?  ")).toBe("Best telescope for beginners?");
    expect(cleanTitle("   ")).toBeNull();
    expect(cleanTitle("x".repeat(500))!.length).toBe(MAX_TITLE);
  });

  it("start their text with the title so apps without forums still show it", () => {
    const text = postText("Meetup on Friday", "Who's coming?");
    expect(text).toBe("Meetup on Friday\n\nWho's coming?");
    expect(postBody("Meetup on Friday", text)).toBe("Who's coming?");
    expect(postText("Only a title", "  ")).toBe("Only a title");
    expect(titleOf(null, "first line\nmore")).toBe("first line");
    expect(titleOf("Sent title", "whatever")).toBe("Sent title");
  });

  it("sort by latest activity or newest, with their reply counts", () => {
    const roots = [
      { id: "a", ts: 100 },
      { id: "b", ts: 200 },
      { id: "gone", ts: 300, deleted: true },
    ];
    const replies = new Map([["a", { count: 3, last: 900 }]]);
    const latest = posts(
      roots,
      replies,
      "latest",
      (m) => m.id,
      (m) => m.ts,
      (m) => !("deleted" in m),
    );
    expect(latest.map((p) => p.root.id)).toEqual(["a", "b"]);
    expect(latest.map((p) => p.replies)).toEqual([3, 0]);
    expect(latest[0].lastActivity).toBe(900);
    expect(
      posts(
        roots,
        replies,
        "newest",
        (m) => m.id,
        (m) => m.ts,
        (m) => !("deleted" in m),
      ).map((p) => p.root.id),
    ).toEqual(["b", "a"]);
  });

  it("carry well-formed, distinct tags, at most five; tag names are trimmed and not repeated", () => {
    expect(cleanTags(["tag_a", "tag_a", "bad id!", "tag_b"])).toEqual(["tag_a", "tag_b"]);
    expect(cleanTags(Array.from({ length: 9 }, (_, i) => `t${i}`))).toHaveLength(MAX_TAGS_PER_POST);
    expect(cleanTags(null)).toEqual([]);
    expect(cleanTagNames(["  Bug ", "Idea", "bug", " "])).toEqual(["Bug", "Idea"]);
    expect(cleanTagNames(["x".repeat(40)])[0].length).toBe(MAX_TAG_NAME);
  });

  it("are searched and filtered here, by any or all of the chosen tags", () => {
    const list = [
      { title: "Lens advice", body: "which one?", tags: ["q"] },
      { title: "Star party", body: "Friday night", tags: ["event"] },
      { title: "Untagged", body: "", tags: [] as string[] },
    ].map((root) => ({ root, replies: 0, lastActivity: 0 }));
    const run = (q: string, sel: string[], all = false) =>
      filterPosts(
        list,
        q,
        new Set(sel),
        (p) => p.title,
        (p) => p.body,
        (p) => p.tags,
        all,
      ).map((p) => p.root.title);
    expect(run("", [])).toEqual(["Lens advice", "Star party", "Untagged"]);
    expect(run("FRIDAY", [])).toEqual(["Star party"]);
    expect(run("", ["q", "event"])).toEqual(["Lens advice", "Star party"]);
    expect(run("lens", ["event"])).toEqual([]);
    const both = [{ tags: ["t1"] }, { tags: ["t1", "t2"] }, { tags: ["t2"] }].map((root, i) => ({ root: { ...root, id: String(i) }, replies: 0, lastActivity: 0 }));
    expect(
      filterPosts(
        both,
        "",
        new Set(["t1", "t2"]),
        () => "",
        () => "",
        (p) => p.tags,
        true,
      ).map((p) => p.root.id),
    ).toEqual(["1"]);
  });

  it("show the most-used reaction on the card, counted by people; guidelines collapse to their first lines", () => {
    expect(topReaction({ "🎉": ["u1"], "👍": ["u1", "u2", "u2"] })).toEqual(["👍", 2]);
    expect(topReaction({ "🎉": ["u1"], "😀": ["u2"] })).toEqual(["🎉", 1]);
    expect(topReaction({ "👍": [] })).toBeNull();
    expect(guidelinesPreview("a\nb\nc\nd")).toEqual(["a\nb\nc", true]);
    expect(guidelinesPreview("a\nb")).toEqual(["a\nb", false]);
  });
});
