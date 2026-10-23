import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useRef, useState } from "react";

/**
 * Message gestures (android Settings › Chats › Gestures, 2026-10-23): swipe a message to the left on a touch screen to
 * reply, and double-tap it (or double-click beside its text with a mouse) to react with the chosen emoji (again takes
 * it back). Both
 * can be turned off in Settings › Appearance. Pure classes, so the rules are tested without a browser.
 */
export const SWIPE_REPLY_PX = 64;
/** How far the message follows the finger. */
export const SWIPE_MAX_PX = 96;
/** Movement before the direction is decided: mostly up or down is a scroll and the swipe is off. */
export const DIRECTION_PX = 10;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 24;

export interface Point {
  pointerType: string;
  x: number;
  y: number;
}

const touchLike = (p: Point) => p.pointerType === "touch" || p.pointerType === "pen";

export class SwipeReply {
  private start: { x: number; y: number } | null = null;
  private horizontal = false;
  private offset = 0;

  down(p: Point): void {
    this.start = touchLike(p) ? { x: p.x, y: p.y } : null;
    this.horizontal = false;
    this.offset = 0;
  }

  /** How far the message is pulled to the left now (0 or negative). */
  move(p: Point): number {
    if (!this.start) return 0;
    const dx = p.x - this.start.x;
    const dy = p.y - this.start.y;
    if (!this.horizontal) {
      if (Math.hypot(dx, dy) < DIRECTION_PX) return 0;
      if (Math.abs(dy) >= Math.abs(dx) || dx > 0) {
        this.start = null; // a scroll, or a swipe the other way
        return 0;
      }
      this.horizontal = true;
    }
    this.offset = Math.max(-SWIPE_MAX_PX, Math.min(0, dx));
    return this.offset;
  }

  /** Whether the message was moved: a tap that follows isn't a tap. */
  get moved(): boolean {
    return this.horizontal;
  }

  /** The finger lifted: true when it was pulled far enough to reply. */
  up(): boolean {
    const reply = this.horizontal && this.offset <= -SWIPE_REPLY_PX;
    this.cancel();
    return reply;
  }

  cancel(): void {
    this.start = null;
    this.horizontal = false;
    this.offset = 0;
  }
}

export class DoubleTap {
  private last: { x: number; y: number; at: number } | null = null;

  /** A tap at [p]: true when it's the second of a double tap (and then starts over). */
  tap(p: { x: number; y: number }, now: number): boolean {
    const l = this.last;
    if (l && now - l.at <= DOUBLE_TAP_MS && Math.hypot(p.x - l.x, p.y - l.y) <= DOUBLE_TAP_PX) {
      this.last = null;
      return true;
    }
    this.last = { x: p.x, y: p.y, at: now };
    return false;
  }

  reset(): void {
    this.last = null;
  }
}

/** Taps on these keep their own meaning (open a link, a photo, a reaction, a menu). */
const OWN_MEANING = "a, button, img, video, audio, input, textarea, select, [role=button], [contenteditable=true]";

/** The message's own text: a double-click there selects a word to copy, as everywhere else. */
const MESSAGE_TEXT = ".msg-text";

/**
 * The handlers and the swipe offset for a message. [onReply] / [onReact] are null when that gesture is off or not
 * allowed here (the message can't be replied to or reacted to).
 */
export function useMessageGestures(onReply: (() => void) | null, onReact: (() => void) | null) {
  const swipe = useRef(new SwipeReply());
  const taps = useRef(new DoubleTap());
  const lastTouch = useRef(Number.NEGATIVE_INFINITY);
  const [offset, setOffset] = useState(0);
  const at = (e: ReactPointerEvent) => ({ pointerType: e.pointerType, x: e.clientX, y: e.clientY });
  const handlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (onReply) swipe.current.down(at(e));
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (!onReply) return;
      const next = swipe.current.move(at(e));
      if (next !== offset) setOffset(next);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const moved = swipe.current.moved;
      if (onReply && swipe.current.up()) {
        (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(8);
        onReply();
      }
      setOffset(0);
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      lastTouch.current = performance.now();
      if (moved || !onReact || (e.target as HTMLElement).closest(OWN_MEANING)) return taps.current.reset();
      if (taps.current.tap({ x: e.clientX, y: e.clientY }, performance.now())) onReact();
    },
    onPointerCancel: () => {
      swipe.current.cancel();
      taps.current.reset();
      setOffset(0);
    },
    onDoubleClick: (e: ReactMouseEvent<HTMLElement>) => {
      // A mouse double-click beside the text (on it, it selects a word); a double tap was handled above, and some
      // browsers send dblclick for it too.
      if (!onReact || performance.now() - lastTouch.current < 600) return;
      const target = e.target as HTMLElement;
      if (target.closest(OWN_MEANING) || target.closest(MESSAGE_TEXT)) return;
      globalThis.getSelection?.()?.removeAllRanges(); // what the double-click selected beside the text isn't wanted
      onReact();
    },
  };
  return { handlers, offset };
}

type Handlers = Partial<Record<string, ((e: never) => void) | undefined>>;

/** Both sets of event handlers on one element: each event runs [a]'s handler, then [b]'s. */
export function mergeHandlers<A extends Handlers, B extends Handlers>(a: A, b: B): A & B {
  const out: Handlers = { ...a, ...b };
  for (const k of Object.keys(a)) {
    const fa = a[k];
    const fb = b[k];
    if (fa && fb) out[k] = (e: never) => (fa(e), fb(e));
  }
  return out as A & B;
}
