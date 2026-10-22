import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";

/**
 * Long press on touch screens (2026-10-22): holding a message opens its menu (quick reactions, reply, more), the way the
 * Android app and Discord do. A tap stays a tap, so tapping a reaction just toggles it. Moving the finger (scrolling) or
 * the browser cancelling the touch never opens anything. Pure, so the gesture rules are tested without a browser.
 */
export const LONG_PRESS_MS = 450;
/** A finger drifts a little while held still; more than this is a scroll. */
export const MOVE_TOLERANCE_PX = 10;
/** The click a browser sends for the lifted finger comes right after it; later clicks (in the menu) are real ones. */
export const SWALLOW_WITHIN_MS = 400;

export interface PointerLike {
  pointerType: string;
  x: number;
  y: number;
}

export class LongPress {
  private start: { x: number; y: number; at: number } | null = null;
  private fired = false;
  private releasedAt: number | null = null;

  down(p: PointerLike, now: number): void {
    this.fired = false;
    this.start = p.pointerType === "touch" || p.pointerType === "pen" ? { x: p.x, y: p.y, at: now } : null;
  }

  move(p: PointerLike): void {
    if (this.start && Math.hypot(p.x - this.start.x, p.y - this.start.y) > MOVE_TOLERANCE_PX) this.start = null;
  }

  cancel(): void {
    this.start = null;
  }

  /** Whether the press has been held long enough now; true once, then the press is spent. */
  due(now: number): boolean {
    if (!this.start || this.fired || now - this.start.at < LONG_PRESS_MS) return false;
    this.fired = true;
    this.start = null;
    return true;
  }

  /** The finger lifted: "fired" if the menu opened (the click that follows at once is swallowed), else "tap". */
  up(now: number): "fired" | "tap" {
    this.start = null;
    this.releasedAt = this.fired ? now : null;
    return this.fired ? "fired" : "tap";
  }

  /** True once, right after a long press: that press's own click mustn't also follow a link or toggle a reaction. */
  swallowClick(now: number): boolean {
    const swallow = this.releasedAt !== null && now - this.releasedAt < SWALLOW_WITHIN_MS;
    this.releasedAt = null;
    return swallow;
  }
}

/** The handlers for an element that opens [onPress] on a long press (touch) or a right-click (mouse, not on links or media). */
export function useLongPress(onPress: (el: HTMLElement) => void, enabled: boolean) {
  const lp = useRef(new LongPress());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!enabled) return {};
  const at = (e: ReactPointerEvent) => ({ pointerType: e.pointerType, x: e.clientX, y: e.clientY });
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      lp.current.down(at(e), performance.now());
      clearTimeout(timer.current);
      const el = e.currentTarget;
      timer.current = setTimeout(() => {
        if (!lp.current.due(performance.now())) return;
        (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(8);
        onPress(el);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: ReactPointerEvent) => lp.current.move(at(e)),
    onPointerUp: () => {
      lp.current.up(performance.now());
      clearTimeout(timer.current);
    },
    onPointerCancel: () => {
      lp.current.cancel();
      clearTimeout(timer.current);
    },
    onClickCapture: (e: ReactMouseEvent) => {
      if (!lp.current.swallowClick(performance.now())) return;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
      // Android Chrome's own long-press menu, or a right-click: the message's menu instead (links and media keep theirs).
      if ((e.target as HTMLElement).closest("a, img, video, audio, input, textarea")) return;
      e.preventDefault();
      onPress(e.currentTarget);
    },
  };
}
