import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizePhoto, photoDownload } from "../src/sync/photoQuality";

function canvas(alpha = 255, supported = true) {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 2000, close }));
  const result = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([120, 30, 30, alpha]) }) }),
    toBlob: (callback: (blob: Blob | null) => void, type: string) => callback(supported ? new Blob(["encoded"], { type }) : null),
  };
  vi.stubGlobal("document", { createElement: () => result });
  return { result, close };
}
afterEach(() => vi.unstubAllGlobals());
describe("automatic photo upload and export", () => {
  it("scales a static photo to 2560, encodes WebP and releases the bitmap", async () => {
    const { result, close } = canvas();
    const file = await optimizePhoto(new File([new Uint8Array(100)], "camera.jpeg", { type: "image/jpeg" }));
    expect([result.width, result.height]).toEqual([2560, 1280]);
    expect([file.name, file.type]).toEqual(["camera.webp", "image/webp"]);
    expect(close).toHaveBeenCalledOnce();
  });
  it("falls back to the original when encoding or decoding is unavailable", async () => {
    canvas(255, false);
    const file = new File(["jpeg"], "camera.jpg", { type: "image/jpeg" });
    expect(await optimizePhoto(file)).toBe(file);
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
    expect(await optimizePhoto(file)).toBe(file);
  });
  it("preserves animated WebP before opening a bitmap", async () => {
    canvas();
    const bytes = new Uint8Array(20);
    bytes.set(new TextEncoder().encode("RIFF"), 0);
    bytes.set(new TextEncoder().encode("WEBP"), 8);
    bytes.set(new TextEncoder().encode("ANIM"), 12);
    const file = new File([bytes], "animation.webp", { type: "image/webp" });
    expect(await optimizePhoto(file)).toBe(file);
    expect(await photoDownload(file, file.name)).toEqual({ blob: file, name: file.name });
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
  it.each([
    [255, "image/jpeg", "photo.jpg"],
    [0, "image/png", "photo.png"],
  ])("exports alpha %i as %s", async (alpha, type, name) => {
    const { close } = canvas(Number(alpha));
    const downloaded = await photoDownload(new Blob(["webp"], { type: "image/webp" }), "photo.webp");
    expect([downloaded.blob.type, downloaded.name]).toEqual([type, name]);
    expect(close).toHaveBeenCalledOnce();
  });
});
