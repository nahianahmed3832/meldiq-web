import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zMember } from "../src/api/schemas";
import { zAttachmentRef, zPayload } from "../src/protocol/payload";

describe("patched Zod and legacy wire compatibility", () => {
  it("rejects an oversized constrained collection before validating its elements", () => {
    let visited = 0;
    const item = z.preprocess((value) => {
      visited++;
      return value;
    }, z.string());
    const result = z
      .array(item)
      .max(10)
      .safeParse(Array.from({ length: 10_000 }, () => ({})));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.code)).toEqual(["too_big"]);
    expect(visited).toBe(0);
  });

  it("keeps omitted payload fields optional and normalizes legacy nulls", () => {
    expect(zPayload.parse({ type: "text", text: "hello", newerField: true })).toEqual({ type: "text", text: "hello" });
    expect(zPayload.parse({ type: "text", text: null })).toEqual({ type: "text", text: undefined });
    const attachment = { id: "f_1", name: "file", mime: "text/plain", size: 1, key: "key", nonce: "nonce", sha256: "hash" };
    expect(zAttachmentRef.parse(attachment)).toEqual(attachment);
  });

  it("keeps the optional bot marker absent for ordinary members", () => {
    const marker = z.object({ bot: zMember.shape.bot });
    expect(marker.parse({})).toEqual({});
    expect(marker.parse({ bot: true })).toEqual({ bot: true });
    expect(marker.parse({ bot: false })).toEqual({ bot: undefined });
    expect(marker.safeParse({ bot: "true" }).success).toBe(false);
  });
});
