import { describe, expect, it } from "vitest";
import { LONG_PRESS_MS, LongPress, MOVE_TOLERANCE_PX, SWALLOW_WITHIN_MS } from "../src/ui/chat/longPress";

const touch = (x = 0, y = 0) => ({ pointerType: "touch", x, y });

describe("long press on a message (touch screens)", () => {
  it("fires after holding still, and the click that follows is swallowed", () => {
    const lp = new LongPress();
    lp.down(touch(), 0);
    expect(lp.due(LONG_PRESS_MS - 1)).toBe(false);
    expect(lp.due(LONG_PRESS_MS)).toBe(true);
    expect(lp.up(LONG_PRESS_MS + 100)).toBe("fired");
    expect(lp.swallowClick(LONG_PRESS_MS + 120)).toBe(true);
    expect(lp.swallowClick(LONG_PRESS_MS + 130)).toBe(false);
  });

  it("a quick tap stays a tap: reactions and links work as usual", () => {
    const lp = new LongPress();
    lp.down(touch(), 0);
    expect(lp.up(100)).toBe("tap");
    expect(lp.swallowClick(110)).toBe(false);
    expect(lp.due(LONG_PRESS_MS * 2)).toBe(false);
  });

  it("scrolling (moving, or the browser cancelling the touch) never opens the menu", () => {
    const moved = new LongPress();
    moved.down(touch(0, 0), 0);
    moved.move(touch(0, MOVE_TOLERANCE_PX + 1));
    expect(moved.due(LONG_PRESS_MS)).toBe(false);
    const cancelled = new LongPress();
    cancelled.down(touch(), 0);
    cancelled.cancel();
    expect(cancelled.due(LONG_PRESS_MS)).toBe(false);
    const jitter = new LongPress();
    jitter.down(touch(0, 0), 0);
    jitter.move(touch(3, 4));
    expect(jitter.due(LONG_PRESS_MS)).toBe(true);
  });

  it("is for fingers and pens only: a mouse keeps its own clicks and right-click", () => {
    const lp = new LongPress();
    lp.down({ pointerType: "mouse", x: 0, y: 0 }, 0);
    expect(lp.due(LONG_PRESS_MS)).toBe(false);
  });

  it("swallows only the click of the release itself, not a tap in the menu a moment later", () => {
    const lp = new LongPress();
    lp.down(touch(), 0);
    lp.due(LONG_PRESS_MS);
    lp.up(LONG_PRESS_MS + 50);
    expect(lp.swallowClick(LONG_PRESS_MS + 50 + SWALLOW_WITHIN_MS + 1)).toBe(false);
  });

  it("fires once per press", () => {
    const lp = new LongPress();
    lp.down(touch(), 0);
    expect(lp.due(LONG_PRESS_MS)).toBe(true);
    expect(lp.due(LONG_PRESS_MS + 10)).toBe(false);
  });
});
