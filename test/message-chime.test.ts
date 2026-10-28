import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The message chime (continuation brief v3 §4): locked until a gesture, resumed when the browser suspended it, refused
 * honestly when it stays blocked, silent at volume 0, one chime per burst.
 */
class FakeContext {
  static resumeWorks = true;
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = {};
  played = 0;
  async resume() {
    if (FakeContext.resumeWorks) this.state = "running";
  }
  createOscillator() {
    return { type: "", frequency: { value: 0 }, connect: (g: unknown) => g, start: () => void this.played++, stop: () => undefined };
  }
  createGain() {
    const g = { gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => g };
    return g;
  }
}

beforeEach(() => {
  vi.resetModules();
  FakeContext.resumeWorks = true;
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
});

describe("the message chime", () => {
  it("is locked until a gesture unlocks it, then plays", async () => {
    const m = await import("../src/application/messageChime");
    expect(m.chimeState()).toBe("locked");
    expect(await m.playChime(60)).toBe(false);
    expect(await m.unlockChime()).toBe("ready");
    expect(await m.playChime(60)).toBe(true);
  });

  it("stays silent at volume 0 and says so when the browser keeps it blocked", async () => {
    const m = await import("../src/application/messageChime");
    FakeContext.resumeWorks = false;
    expect(await m.unlockChime()).toBe("locked");
    expect(await m.playChime(60)).toBe(false);
    FakeContext.resumeWorks = true;
    await m.unlockChime();
    expect(await m.playChime(0)).toBe(false);
  });

  it("plays once for a burst of messages", async () => {
    const m = await import("../src/application/messageChime");
    await m.unlockChime();
    const now = vi.spyOn(Date, "now");
    let stored: string | null = null;
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_k: string, v: string) => void (stored = v) });
    now.mockReturnValue(10_000);
    await m.playChime(60);
    now.mockReturnValue(10_500);
    await m.playChime(60);
    now.mockReturnValue(10_000 + m.CHIME_GAP_MS + 1);
    await m.playChime(60);
    expect(Number(stored)).toBe(10_000 + m.CHIME_GAP_MS + 1);
  });
});
