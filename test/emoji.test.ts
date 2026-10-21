import { describe, expect, it } from "vitest";
import file from "../src/emoji/emoji.json";
import { type EmojiItem, inTone, parseCatalog, searchEmoji } from "../src/emoji/catalog";
import { isReaction } from "../src/emoji/rules";

/** The shared catalogue and rules (meldiq docs/EMOJI.md), the same checks as android EmojiCatalogTest. */
const groups = parseCatalog(file as unknown as Parameters<typeof parseCatalog>[0]);
const all = groups.flatMap((g) => g.items);

describe("emoji catalogue", () => {
  it("has Unicode's nine groups in order and every emoji once", () => {
    expect(groups.map((g) => g.id)).toEqual(["smileys", "people", "nature", "food", "travel", "activities", "objects", "symbols", "flags"]);
    expect(all.length).toBeGreaterThan(1800);
    expect(new Set(all.map((i) => i.emoji)).size).toBe(all.length);
  });

  it("folds skin tones into their base, light to dark", () => {
    const wave = all.find((i) => i.emoji === "👋") as EmojiItem;
    expect(wave.tones).toEqual(["👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"]);
    expect(inTone(wave, 3)).toBe("👋🏽");
    expect(inTone(wave, 0)).toBe("👋");
    expect(inTone(all.find((i) => i.emoji === "😀") as EmojiItem, 4)).toBe("😀");
  });

  it("finds by name and keyword, best match first", () => {
    expect(searchEmoji(groups, "thumbs up")[0].emoji).toBe("👍");
    expect(searchEmoji(groups, "red heart")[0].emoji).toBe("❤️");
    expect(searchEmoji(groups, "  HAPPY ").some((i) => i.emoji === "😀")).toBe(true);
    expect(searchEmoji(groups, "bangladesh").some((i) => i.emoji === "🇧🇩")).toBe(true);
    expect(searchEmoji(groups, "zzqqxx")).toEqual([]);
    expect(searchEmoji(groups, "   ")).toEqual([]);
    expect(searchEmoji(groups, "face", 5)).toHaveLength(5);
  });
});

describe("reactions", () => {
  it("accepts every emoji and tone in the catalogue", () => {
    const bad = all.flatMap((i) => [i.emoji, ...(i.tones ?? [])]).filter((e) => !isReaction(e));
    expect(bad).toEqual([]);
  });

  it("refuses text, spaces, control characters and long strings", () => {
    for (const v of [null, undefined, "", " ", "lol", "👍 👍", "👍\n", "a👍", "\u0000", "👍".repeat(33)]) expect(isReaction(v)).toBe(false);
    for (const v of ["👍", "ℹ️", "1️⃣", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "👨‍👩‍👧‍👦", "🇧🇩"]) expect(isReaction(v)).toBe(true);
  });
});
