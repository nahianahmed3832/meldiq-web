/**
 * Where the minimised call sits (reported: it covered the composer's send button and couldn't be moved). People drag it
 * anywhere; it always stays fully on screen, and this browser remembers where they left it.
 */
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}

/** Distance kept from the window's edges. */
export const EDGE = 8;
/** Arrow keys move it this far (Shift: further). */
export const KEY_STEP = 16;
export const KEY_STEP_LARGE = 64;
const KEY = "meldiq.miniCall.position";

/** [p] (the window's top-left corner) moved just enough that the whole window is on screen. */
export function clampToViewport(p: Point, size: Size, viewport: Size): Point {
  const maxX = Math.max(EDGE, viewport.width - size.width - EDGE);
  const maxY = Math.max(EDGE, viewport.height - size.height - EDGE);
  return { x: Math.round(Math.min(Math.max(p.x, EDGE), maxX)), y: Math.round(Math.min(Math.max(p.y, EDGE), maxY)) };
}

/** Where an arrow key moves it from [p], or null for any other key. */
export function nudge(p: Point, key: string, large: boolean): Point | null {
  const d = large ? KEY_STEP_LARGE : KEY_STEP;
  if (key === "ArrowLeft") return { x: p.x - d, y: p.y };
  if (key === "ArrowRight") return { x: p.x + d, y: p.y };
  if (key === "ArrowUp") return { x: p.x, y: p.y - d };
  if (key === "ArrowDown") return { x: p.x, y: p.y + d };
  return null;
}

export function loadPosition(): Point | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    if (v && typeof v === "object" && Number.isFinite((v as Point).x) && Number.isFinite((v as Point).y)) return { x: (v as Point).x, y: (v as Point).y };
  } catch {
    /* nothing kept */
  }
  return null;
}

export function savePosition(p: Point): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* kept for this page only */
  }
}
