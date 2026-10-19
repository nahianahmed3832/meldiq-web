import { describe, expect, it } from "vitest";
import { encodedName, fitWithin, reencodable } from "../src/sync/photoQuality";

/** Photo quality before sending (android BatchComposer, docs/ATTACHMENTS.md › Quality). */
describe("photo quality", () => {
  it("scales the longest edge down to the quality's size, never up", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
    expect(fitWithin(9000, 3, 4096)).toEqual({ width: 4096, height: 1 });
  });

  it("re-encodes JPEG, PNG and WebP; GIFs and everything else go as they are", () => {
    expect(["image/jpeg", "image/png", "image/webp"].every(reencodable)).toBe(true);
    expect(["image/gif", "image/svg+xml", "image/heic", "video/mp4", ""].some(reencodable)).toBe(false);
  });

  it("names a re-encoded photo .jpg; a PNG keeps its name", () => {
    expect(encodedName("IMG_0001.HEIC.webp", "image/jpeg")).toBe("IMG_0001.HEIC.jpg");
    expect(encodedName("holiday.jpeg", "image/jpeg")).toBe("holiday.jpg");
    expect(encodedName(".webp", "image/jpeg")).toBe("photo.jpg");
    expect(encodedName("logo.png", "image/png")).toBe("logo.png");
  });
});
