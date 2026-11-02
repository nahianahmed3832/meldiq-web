import { describe, expect, it, vi } from "vitest";
import { followVisualViewport, visibleViewport } from "../src/application/viewport";

function viewport() {
  const values = new Map<string, string>();
  const vv = Object.assign(new EventTarget(), { height: 844, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const win = Object.assign(new EventTarget(), {
    visualViewport: vv,
    innerHeight: 844,
    innerWidth: 390,
    document: { documentElement: { style: { setProperty: (key: string, value: string) => values.set(key, value), removeProperty: (key: string) => values.delete(key) } } },
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frames.set(++next, callback);
      return next;
    }),
    cancelAnimationFrame: vi.fn((id: number) => frames.delete(id)),
  });
  const paint = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
  };
  return { win: win as unknown as Window, vv, values, paint, frames };
}

describe("mobile visible viewport lifecycle", () => {
  it("follows keyboard shrink and pan, coalesces events, and restores after orientation / page restoration", () => {
    const { win, vv, values, paint } = viewport();
    const stop = followVisualViewport(win);
    expect(values.get("--app-height")).toBe("844px");
    Object.assign(vv, { height: 380.4, offsetTop: 70.6 });
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
    expect(win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    paint();
    expect(values.get("--app-height")).toBe("380px");
    expect(values.get("--app-top")).toBe("71px");
    Object.assign(vv, { height: 390, width: 844, offsetTop: 0 });
    win.dispatchEvent(new Event("resize"));
    win.dispatchEvent(new Event("pageshow"));
    paint();
    expect(values.get("--app-height")).toBe("390px");
    expect(visibleViewport(win)).toMatchObject({ top: 0, bottom: 390, width: 844 });
    stop();
  });

  it("leaves pinch zoom alone and cancels pending callbacks and listeners on teardown", () => {
    const { win, vv, values, paint, frames } = viewport();
    const stop = followVisualViewport(win);
    Object.assign(vv, { height: 200, scale: 2 });
    vv.dispatchEvent(new Event("resize"));
    paint();
    expect(values.get("--app-height")).toBe("844px");
    expect(visibleViewport(win).height).toBe(844);
    vv.dispatchEvent(new Event("resize"));
    stop();
    expect(frames.size).toBe(0);
    expect(values.size).toBe(0);
    vv.dispatchEvent(new Event("resize"));
    win.dispatchEvent(new Event("pageshow"));
    expect(frames.size).toBe(0);
  });

  it("falls back to the layout viewport when VisualViewport is unavailable", () => {
    const { win } = viewport();
    Object.defineProperty(win, "visualViewport", { value: null });
    expect(visibleViewport(win)).toMatchObject({ top: 0, left: 0, height: 844, width: 390 });
    expect(() => followVisualViewport(win)()).not.toThrow();
  });
});
