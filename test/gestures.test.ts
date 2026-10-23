import { describe, expect, it } from "vitest";
import { DOUBLE_TAP_MS, DoubleTap, mergeHandlers, SWIPE_MAX_PX, SwipeReply } from "../src/ui/chat/gestures";

const touch = (x: number, y: number) => ({ pointerType: "touch", x, y });

describe("swipe to reply", () => {
  it("replies when a message is pulled far enough to the left, following the finger up to a limit", () => {
    const s = new SwipeReply();
    s.down(touch(300, 100));
    expect(s.move(touch(295, 101))).toBe(0); // not decided yet
    expect(s.move(touch(260, 102))).toBe(-40);
    expect(s.move(touch(100, 104))).toBe(-SWIPE_MAX_PX);
    expect(s.moved).toBe(true);
    expect(s.up()).toBe(true);
  });

  it("doesn't reply for a short pull, a scroll, a swipe to the right or a mouse", () => {
    const s = new SwipeReply();
    s.down(touch(300, 100));
    s.move(touch(260, 100));
    expect(s.up()).toBe(false);

    s.down(touch(300, 100));
    expect(s.move(touch(290, 160))).toBe(0); // mostly vertical: a scroll
    expect(s.move(touch(150, 170))).toBe(0);
    expect(s.up()).toBe(false);

    s.down(touch(100, 100));
    expect(s.move(touch(220, 100))).toBe(0);
    expect(s.up()).toBe(false);

    s.down({ pointerType: "mouse", x: 300, y: 100 });
    expect(s.move({ pointerType: "mouse", x: 100, y: 100 })).toBe(0);
    expect(s.up()).toBe(false);
  });
});

describe("double tap to react", () => {
  it("is two taps close together in time and place", () => {
    const d = new DoubleTap();
    expect(d.tap({ x: 10, y: 10 }, 1000)).toBe(false);
    expect(d.tap({ x: 14, y: 12 }, 1000 + DOUBLE_TAP_MS - 10)).toBe(true);
    // and then starts over: a third tap isn't another double tap
    expect(d.tap({ x: 14, y: 12 }, 1000 + DOUBLE_TAP_MS)).toBe(false);
  });

  it("isn't two taps too slow or too far apart", () => {
    const d = new DoubleTap();
    d.tap({ x: 10, y: 10 }, 0);
    expect(d.tap({ x: 10, y: 10 }, DOUBLE_TAP_MS + 1)).toBe(false);
    expect(d.tap({ x: 80, y: 10 }, DOUBLE_TAP_MS + 50)).toBe(false);
  });
});

describe("merging handlers", () => {
  it("runs both handlers of an event, in order, and keeps the others", () => {
    const calls: string[] = [];
    const merged = mergeHandlers({ onPointerUp: () => void calls.push("a"), onContextMenu: () => void calls.push("menu") }, { onPointerUp: () => void calls.push("b") });
    merged.onPointerUp();
    merged.onContextMenu();
    expect(calls).toEqual(["a", "b", "menu"]);
  });
});
