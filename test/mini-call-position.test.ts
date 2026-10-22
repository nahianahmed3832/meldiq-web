import { describe, expect, it } from "vitest";
import { clampToViewport, EDGE, KEY_STEP, KEY_STEP_LARGE, nudge } from "../src/ui/call/miniPosition";

describe("the minimised call's position", () => {
  const size = { width: 300, height: 56 };
  const viewport = { width: 1280, height: 800 };

  it("stays where it's dropped while it's fully on screen", () => {
    expect(clampToViewport({ x: 400, y: 300 }, size, viewport)).toEqual({ x: 400, y: 300 });
  });

  it("is pulled back on screen past any edge, keeping a margin", () => {
    expect(clampToViewport({ x: -50, y: -10 }, size, viewport)).toEqual({ x: EDGE, y: EDGE });
    expect(clampToViewport({ x: 5000, y: 5000 }, size, viewport)).toEqual({ x: 1280 - 300 - EDGE, y: 800 - 56 - EDGE });
  });

  it("on a window narrower than itself, its left edge stays visible", () => {
    expect(clampToViewport({ x: 100, y: 100 }, size, { width: 280, height: 600 })).toEqual({ x: EDGE, y: 100 });
  });

  it("moves with the arrow keys, further with Shift, and ignores other keys", () => {
    expect(nudge({ x: 100, y: 100 }, "ArrowLeft", false)).toEqual({ x: 100 - KEY_STEP, y: 100 });
    expect(nudge({ x: 100, y: 100 }, "ArrowDown", true)).toEqual({ x: 100, y: 100 + KEY_STEP_LARGE });
    expect(nudge({ x: 100, y: 100 }, "Enter", false)).toBeNull();
  });
});
