import { afterEach, expect, it, vi } from "vitest";
import { optimizeVideo } from "../src/sync/videoQuality";

function browserVideo(width = 1920, height = 1080) {
  const revoke = vi.fn();
  const video = Object.assign(new EventTarget(), {
    src: "",
    videoWidth: width,
    videoHeight: height,
    duration: 2,
    readyState: 2,
    pause: vi.fn(),
    removeAttribute: () => {
      video.src = "";
    },
    load: () =>
      queueMicrotask(() => {
        if (video.src) video.dispatchEvent(new Event("loadedmetadata"));
      }),
  });
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:video"), revokeObjectURL: revoke });
  vi.stubGlobal("document", { createElement: () => video });
  vi.stubGlobal("MediaRecorder", undefined);
  return { video, revoke };
}
afterEach(() => vi.unstubAllGlobals());

it("keeps an already efficient small video without unnecessary quality loss", async () => {
  const { video, revoke } = browserVideo(640, 360);
  const original = new File(["small video"], "clip.mp4", { type: "video/mp4" });
  expect(await optimizeVideo(original)).toBe(original);
  expect(video.pause).toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:video");
});
it("preserves QuickTime without opening a decoder or changing its container", async () => {
  browserVideo();
  const original = new File(["video"], "clip.mov", { type: "video/quicktime" });
  expect(await optimizeVideo(original)).toBe(original);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("skips real-time re-encoding for longer clips", async () => {
  const { video } = browserVideo();
  video.duration = 31;
  const original = new File([new Uint8Array(10 * 1024 * 1024)], "clip.mp4", { type: "video/mp4" });
  expect(await optimizeVideo(original)).toBe(original);
  expect(video.src).toBe("");
});
it("honors cancellation before opening the selected file", async () => {
  browserVideo();
  const controller = new AbortController();
  controller.abort();
  await expect(optimizeVideo(new File(["video"], "clip.mp4"), controller.signal)).rejects.toThrow();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
