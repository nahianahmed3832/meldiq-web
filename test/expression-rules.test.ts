import { describe, expect, it } from "vitest";
import { cleanRef, cleanRefs, emojiTokens, forSending, reactionAllowed, reactionName, sha256Hex, suggestName } from "../src/sync/expressions";
import { parsePayload, encodePayload } from "../src/protocol/payload";

/** The phone's cases (android ExpressionRulesTest, CustomReactionRulesTest). */
const sha = "a".repeat(64);
const ref = (name: string, id = `emj_${name}`) => ({ id, orgId: "o_1", name, sha256: sha, animated: false });

describe("community emoji in messages", () => {
  it("keep only well-formed references whose name is in the text, one per name, at most 20", () => {
    const refs = [ref("party"), ref("party", "emj_other"), ref("cat"), { ...ref("dog"), id: "bad id" }, ref("x"), { ...ref("wave"), sha256: "nothex" }];
    expect(cleanRefs(refs, "hi :party: and :dog: :wave:").map((r) => r.id)).toEqual(["emj_party"]);
    expect(cleanRef(ref("UPPER"))).toBeNull();
    const many = Array.from({ length: 30 }, (_, i) => ref(`e${i + 1}`));
    expect(cleanRefs(many, many.map((r) => `:${r.name}:`).join(" "))).toHaveLength(20);
  });

  it("find every use of a referenced name, and ignore names without a reference", () => {
    expect(emojiTokens(":party: hi :party::nope:", [ref("party")]).map((t) => [t.start, t.end])).toEqual([
      [0, 7],
      [11, 18],
    ]);
    expect(emojiTokens(":party:", [])).toEqual([]);
  });

  it("send the emoji the text names; names for uploads are suggested from the file", () => {
    expect(forSending("look :cat:", [ref("party"), ref("cat")]).map((r) => r.name)).toEqual(["cat"]);
    expect(suggestName("Party-Parrot (1).GIF")).toBe("party_parrot_1");
  });

  it("show an image only when its hash matches", async () => {
    expect(await sha256Hex(new TextEncoder().encode("hello"))).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("travel inside the payload, and plain messages stay plain on the wire", () => {
    const p = parsePayload(JSON.stringify({ type: "text", text: "hi :party:", customEmoji: [ref("party")] }));
    expect(p?.customEmoji?.[0].id).toBe("emj_party");
    expect(encodePayload({ type: "text", text: "hi" })).not.toContain("custom");
  });
});

describe("community emoji reactions (batch B12)", () => {
  it("are the emoji's :name:, and only inside a community", () => {
    expect(reactionAllowed(":party:", true)).toBe(true);
    expect(reactionAllowed(":party:", false)).toBe(false);
    expect(reactionAllowed("👍", false)).toBe(true);
    expect(reactionAllowed(":Party:", true)).toBe(false);
    expect(reactionAllowed("hello", true)).toBe(false);
    expect(reactionAllowed(":a:", true)).toBe(false);
    expect(reactionName(":party:")).toBe("party");
    expect(reactionName("👍")).toBeNull();
  });
});
