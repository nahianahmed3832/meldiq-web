import { describe, expect, it } from "vitest";
import { displayConstraints, encodingFor, receivedVideo, VideoAdapter, sentVideo, videoLadder } from "../src/call/shareQuality";
import { MAX_SCREEN_SHARES, mayShare, nextWatched, shareIdentity, shareKey, type CallShareView } from "../src/call/shares";

/** Screen sharing quality and several shares at once (2026-10-24). */
describe("screen share capture and encoding", () => {
  it("caps the captured screen dimensions and frame rate before publication", () => {
    expect(displayConstraints("1080p60", false)).toEqual({ width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 60, max: 60 } });
    expect(displayConstraints("720p60", false)).toEqual({ width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 60, max: 60 } });
    // Rotate the width and height constraints for a portrait display.
    expect(displayConstraints("1080p60", true)).toEqual({ width: { ideal: 1080, max: 1080 }, height: { ideal: 1920, max: 1920 }, frameRate: { ideal: 60, max: 60 } });
  });

  it("encodes each rung at its rate and bitrate, scaling the capture down to the rung's height", () => {
    const [top, , third] = videoLadder("1080p60", "auto");
    expect(encodingFor(top, 1920, 1080)).toEqual({ maxBitrate: 6_000_000, maxFramerate: 60, scaleResolutionDownBy: 1 });
    expect(encodingFor(third, 1920, 1080)).toEqual({ maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1.5 });
    expect(encodingFor(top, 3840, 1080).scaleResolutionDownBy).toBe(2);
    // A smaller window is never scaled up; an uncapped 1440p capture is scaled down to 1080.
    expect(encodingFor(top, 600, 800).scaleResolutionDownBy).toBe(1);
    expect(encodingFor(top, 2560, 1440).scaleResolutionDownBy).toBe(1.334);
    expect(encodingFor(top, 0, 0).scaleResolutionDownBy).toBe(1);
  });
});

describe("adaptive fallback", () => {
  const run = (adapter: VideoAdapter, pattern: ("none" | "bandwidth" | "cpu")[], start: number, step = 2_000) => {
    const changes: { at: number; level: number }[] = [];
    pattern.forEach((l, i) => {
      const at = start + i * step;
      const level = adapter.sample(l, at);
      if (level !== null) changes.push({ at, level });
    });
    return changes;
  };

  it("keeps the fixed plan target when sender stats report a limitation", () => {
    const adapter = new VideoAdapter(videoLadder("720p60", "plan"));
    expect(run(adapter, Array(12).fill("bandwidth"), 0)).toEqual([]);
    expect(adapter.current).toMatchObject({ height: 720, frameRate: 60 });
  });

  it("steps down after three limited samples in a row, one rung at a time, at most every 8 s", () => {
    const a = new VideoAdapter(videoLadder("1080p60", "auto"));
    const changes = run(a, Array(12).fill("bandwidth"), 0);
    expect(changes.map((c) => c.level)).toEqual([1, 2, 3]);
    for (let i = 1; i < changes.length; i++) expect(changes[i].at - changes[i - 1].at).toBeGreaterThanOrEqual(8_000);
    expect(a.current).toEqual(videoLadder("1080p60", "auto")[3]);
  });

  it("ignores a short blip, and goes back up only after a long clean stretch", () => {
    const a = new VideoAdapter(videoLadder("720p60", "auto"));
    expect(run(a, ["bandwidth", "bandwidth", "none", "bandwidth", "none"], 0)).toEqual([]);
    run(a, ["cpu", "cpu", "cpu"], 100_000);
    expect(a.level).toBe(1);
    // Nine clean samples aren't enough; the tenth (after 20 s at least) is.
    expect(run(a, Array(9).fill("none"), 110_000)).toEqual([]);
    expect(run(a, ["none"], 130_000)).toEqual([{ at: 130_000, level: 0 }]);
  });

  it("doesn't flap: an upgrade that fails again soon makes the next one wait twice as long", () => {
    const a = new VideoAdapter(videoLadder("1080p60", "auto"));
    run(a, ["bandwidth", "bandwidth", "bandwidth"], 0); // → 1 at 4 s
    run(a, Array(10).fill("none"), 30_000); // → 0 at 48 s
    expect(a.level).toBe(0);
    run(a, ["bandwidth", "bandwidth", "bandwidth"], 60_000); // fails within 30 s: → 1, wait doubles to 40 s
    expect(a.level).toBe(1);
    expect(run(a, Array(10).fill("none"), 70_000)).toEqual([]); // 18 s of clean samples, 30 s after the change: too soon
    expect(run(a, Array(10).fill("none"), 104_000).at(-1)?.level).toBe(0);
    // Over ten minutes of a connection going bad and good every 8 s, it changes far less often than that.
    const b = new VideoAdapter(videoLadder("1080p60", "auto"));
    const pattern = Array.from({ length: 300 }, (_, i) => (Math.floor(i / 4) % 2 ? "none" : "bandwidth") as "none" | "bandwidth");
    expect(run(b, pattern, 0).length).toBeLessThan(8);
  });
});

describe("stats read back", () => {
  it("finds the sent and received video and why the encoder holds back", () => {
    const stats = [
      { type: "outbound-rtp", kind: "audio", bytesSent: 10 },
      { type: "outbound-rtp", kind: "video", frameWidth: 1920, frameHeight: 1080, framesPerSecond: 59.6, qualityLimitationReason: "none" },
      { type: "inbound-rtp", kind: "video", frameWidth: 1280, frameHeight: 720, framesPerSecond: 29.9 },
    ];
    expect(sentVideo(stats)).toEqual({ width: 1920, height: 1080, fps: 60, limitation: "none" });
    expect(sentVideo([{ type: "outbound-rtp", kind: "video", frameWidth: 1280, frameHeight: 720, framesPerSecond: 20, qualityLimitationReason: "bandwidth" }])?.limitation).toBe("bandwidth");
    expect(receivedVideo(stats)).toEqual({ width: 1280, height: 720, fps: 30 });
    expect(sentVideo([])).toBeNull();
    expect(receivedVideo([{ type: "inbound-rtp", kind: "video" }])).toBeNull();
  });
});

const share = (identity: string, sid: string, isLocal = false): CallShareView => ({ key: shareKey(identity, sid), identity, userId: identity, name: identity, isLocal, withAudio: false, ready: true });

describe("which share a viewer watches", () => {
  it("keys a share by participant and track", () => {
    expect(shareKey("u1.d1", "TR_x")).toBe("u1.d1#TR_x");
    expect(shareIdentity("u1.d1#TR_x")).toBe("u1.d1");
  });

  it("keeps the watched share while it lives; a new one never takes over", () => {
    const a = share("a", "1");
    const b = share("b", "2");
    expect(nextWatched(null, false, [a])).toBe(a.key);
    expect(nextWatched(a.key, false, [a, b])).toBe(a.key);
    expect(nextWatched(b.key, false, [a, b])).toBe(b.key);
  });

  it("moves to the same presenter's new share, else another, else the people", () => {
    const a = share("a", "1");
    expect(nextWatched(a.key, false, [share("b", "2"), share("a", "9")])).toBe("a#9");
    expect(nextWatched(a.key, false, [share("b", "2")])).toBe("b#2");
    expect(nextWatched(a.key, false, [])).toBeNull();
  });

  it("leaves the people on screen when the viewer chose them, and never watches your own share", () => {
    expect(nextWatched(null, true, [share("a", "1")])).toBeNull();
    expect(nextWatched(null, false, [share("me", "1", true)])).toBeNull();
    expect(nextWatched("me#1", false, [share("me", "1", true), share("b", "2")])).toBe("b#2");
  });

  it("allows at least two shares at once, up to the cap", () => {
    expect(MAX_SCREEN_SHARES).toBeGreaterThanOrEqual(2);
    expect(mayShare([share("a", "1")], 2)).toBe(true);
    expect(mayShare([share("a", "1"), share("b", "2")], 2)).toBe(false);
    // Your own share doesn't count against you (it's the one you'd stop).
    expect(mayShare([share("a", "1"), share("me", "3", true)], 2)).toBe(true);
  });
});
