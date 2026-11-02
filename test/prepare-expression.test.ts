import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPRESSION_MAX_BYTES } from "../src/sync/expressions";
import { expressionFormat, prepareExpression } from "../src/sync/prepareExpression";
const ascii = (s: string) => new TextEncoder().encode(s);
const file = (bytes: Uint8Array) => new File([new Uint8Array(bytes)], "picture.gif", { type: "image/gif" });
afterEach(() => vi.unstubAllGlobals());
describe("expression upload preparation", () => {
  it("preserves supported animated originals byte for byte", async () => {
    const bytes = ascii("GIF89a-synthetic-test");
    const result = await prepareExpression(file(bytes), "emoji");
    expect(result.bytes).toEqual(bytes);
    expect(result.converted).toBe(false);
    expect(result.mime).toBe("image/gif");
  });
  it("rejects oversized animation with an actionable reason before any canvas conversion", async () => {
    const bytes = new Uint8Array(EXPRESSION_MAX_BYTES + 1);
    bytes.set(ascii("GIF89a"));
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(prepareExpression(file(bytes), "sticker")).rejects.toThrow("keep its animation");
    expect(decode).not.toHaveBeenCalled();
  });
  it("recognizes APNG and animated WebP rather than silently flattening them", () => {
    const png = new Uint8Array(28);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    png.set(ascii("acTL"), 12);
    expect(expressionFormat(png)).toEqual({ mime: "image/png", animated: true });
    const webp = new Uint8Array(30);
    webp.set(ascii("RIFF"));
    webp.set(ascii("WEBP"), 8);
    webp.set(ascii("VP8X"), 12);
    webp[20] = 2;
    expect(expressionFormat(webp)).toEqual({ mime: "image/webp", animated: true });
    expect(expressionFormat(ascii("invalid"))).toBeNull();
  });
});
