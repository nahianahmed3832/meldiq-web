import { describe, expect, it } from "vitest";
import { MAX_BYTES, MAX_ITEMS, planSave, saveSummary, uniqueNames } from "../src/sync/bulkSave";

/** The phone's bulk save rules (android round 7 BulkSaveTest). */
const ref = (id: string, name: string, mime = "image/jpeg", size = 1000) => ({ id, name, mime, size, key: "k", nonce: "n", sha256: "s" });

describe("saving several files", () => {
  it("five albums of ten photos plan as one batch of fifty, every name distinct", () => {
    const picked = Array.from({ length: 5 }, (_, a) => Array.from({ length: 10 }, (_, i) => ({ messageId: `m${a}`, ref: ref(`${a}-${i}`, `IMG_${i}.jpg`) }))).flat();
    const plan = planSave(picked);
    if (plan.kind !== "ready") throw new Error(plan.kind);
    expect(plan.items).toHaveLength(50);
    expect(new Set(plan.items.map((i) => i.fileName.toLowerCase())).size).toBe(50);
  });

  it("clashing names get a number before the extension", () => {
    expect(uniqueNames(["a.jpg", "a.jpg", "A.JPG", "report"])).toEqual(["a.jpg", "a (1).jpg", "A (2).JPG", "report"]);
    expect(uniqueNames(["notes", "notes"])).toEqual(["notes", "notes (1)"]);
  });

  it("excluded files and duplicates are left out", () => {
    const plan = planSave(
      [
        { messageId: "m1", ref: ref("1", "a.jpg") },
        { messageId: "m1", ref: ref("1", "a.jpg") },
        { messageId: "m1", ref: ref("2", "b.jpg") },
        { messageId: "m2", ref: ref("3", "c.jpg") },
      ],
      new Set(["m1/2"]),
    );
    expect(plan.kind === "ready" && plan.items.map((i) => i.key)).toEqual(["m1/1", "m2/3"]);
  });

  it("limits are reported, not silently cut", () => {
    const many = Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({ messageId: "m", ref: ref(`${i}`, `${i}.jpg`) }));
    expect(planSave(many)).toEqual({ kind: "tooMany", count: MAX_ITEMS + 1, limit: MAX_ITEMS });
    expect(planSave([{ messageId: "m", ref: ref("big", "big.mp4", "video/mp4", MAX_BYTES + 1) }]).kind).toBe("tooLarge");
    expect(planSave([])).toEqual({ kind: "empty" });
  });

  it("the summary tells partial success from running", () => {
    expect(saveSummary({ a: "saved", b: "saving" })).toMatchObject({ running: true, finished: false });
    expect(saveSummary({ a: "saved", b: "failed", c: "cancelled" })).toMatchObject({ finished: true, retryable: 2, saved: 1 });
  });
});
