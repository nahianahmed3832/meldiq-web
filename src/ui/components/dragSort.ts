import { type RefObject, useEffect, useRef } from "react";

/**
 * Drag to rearrange (2026-10-28: communities on the rail and channels in the list, as the owner's reference does):
 * a mouse drags after moving a few pixels; a finger holds still for a moment first (a long press), so a swipe still
 * scrolls the list. Items are the elements with `data-drag` (their id) inside [ref]; `data-drag-kind` and
 * `data-drag-group` say what they are and where they sit, and `data-drag-into` lets something be dropped onto them.
 * While dragging, the item carries `.drag-source` and the one under the pointer `.drag-before`, `.drag-after` or
 * `.drag-into`; the list scrolls near its edges. The click that ends a drag is swallowed. Keyboard users keep the
 * Move up / Move down menu items.
 */
export interface DragItem {
  id: string;
  kind: string;
  group: string | null;
}
export type DropAt = "before" | "after" | "into";
export type DropHandler = (drag: DragItem, target: DragItem, at: DropAt) => void;

const MOUSE_START_PX = 6;
const TOUCH_HOLD_MS = 380;
const TOUCH_SLOP_PX = 10;
const EDGE_PX = 40;
const CLASSES = ["drag-before", "drag-after", "drag-into"];

const itemOf = (el: Element): DragItem => ({
  id: (el as HTMLElement).dataset.drag ?? "",
  kind: (el as HTMLElement).dataset.dragKind ?? "",
  group: (el as HTMLElement).dataset.dragGroup ?? null,
});

export function useDragSort(ref: RefObject<HTMLElement | null>, onDrop: DropHandler, enabled = true): void {
  const drop = useRef(onDrop);
  drop.current = onDrop;
  useEffect(() => {
    const box = ref.current;
    if (!box || !enabled) return;
    let source: HTMLElement | null = null;
    let start: { x: number; y: number; id: number; touch: boolean } | null = null;
    let dragging = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let over: { el: HTMLElement; at: DropAt } | null = null;
    let ghost: HTMLElement | null = null;
    let swallow = false;
    let scroller: ReturnType<typeof setInterval> | undefined;
    let lastY = 0;
    let beganAt: { x: number; y: number } | null = null;

    const clearOver = () => {
      over?.el.classList.remove(...CLASSES);
      over = null;
    };
    const finish = () => {
      clearTimeout(hold);
      clearInterval(scroller);
      if (dragging) {
        source?.classList.remove("drag-source");
        box.classList.remove("drag-active");
        ghost?.remove();
      }
      clearOver();
      source = null;
      start = null;
      dragging = false;
      ghost = null;
      beganAt = null;
    };
    const begin = (x: number, y: number) => {
      if (!source) return;
      dragging = true;
      swallow = true;
      beganAt = { x, y };
      source.classList.add("drag-source");
      box.classList.add("drag-active");
      ghost = source.cloneNode(true) as HTMLElement;
      ghost.classList.add("drag-ghost");
      ghost.removeAttribute("id");
      const r = source.getBoundingClientRect();
      Object.assign(ghost.style, { width: `${r.width}px`, height: `${r.height}px` });
      document.body.append(ghost);
      place(x, y);
      (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(8);
      // The list that scrolls: the box itself, or the scrolling list it sits in.
      const list = box.classList.contains("scroll") || box.classList.contains("rail") ? box : (box.closest<HTMLElement>(".scroll") ?? box);
      scroller = setInterval(() => {
        const b = list.getBoundingClientRect();
        if (lastY < b.top + EDGE_PX) list.scrollTop -= 12;
        else if (lastY > b.bottom - EDGE_PX) list.scrollTop += 12;
      }, 16);
    };
    const place = (x: number, y: number) => {
      lastY = y;
      if (ghost) ghost.style.transform = `translate(${x - (ghost.offsetWidth || 0) / 2}px, ${y - (ghost.offsetHeight || 0) / 2}px)`;
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drag]");
      if (!hit || hit === source || !box.contains(hit)) return clearOver();
      const r = hit.getBoundingClientRect();
      const t = (y - r.top) / r.height;
      // data-drag-into: "true" (anything but a folder) or the kinds that may be dropped onto it.
      const into = hit.dataset.dragInto;
      const kind = source?.dataset.dragKind ?? "";
      const canInto = !!into && (into === "true" ? kind !== "folder" : into.split(" ").includes(kind));
      const at: DropAt = canInto && t > 0.3 && t < 0.7 ? "into" : t < 0.5 ? "before" : "after";
      if (over?.el === hit && over.at === at) return;
      clearOver();
      over = { el: hit, at };
      hit.classList.add(`drag-${at}`);
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || start) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-drag]");
      if (!el || !box.contains(el) || (e.target as HTMLElement).closest("[data-no-drag]")) return;
      source = el;
      const touch = e.pointerType !== "mouse";
      start = { x: e.clientX, y: e.clientY, id: e.pointerId, touch };
      if (touch) hold = setTimeout(() => start && begin(start.x, start.y), TOUCH_HOLD_MS);
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (!dragging) {
        if (start.touch) {
          // Moving before the hold ends is a scroll: let it be.
          if (moved > TOUCH_SLOP_PX) finish();
          return;
        }
        if (moved < MOUSE_START_PX) return;
        begin(e.clientX, e.clientY);
      }
      place(e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const held = dragging && start.touch && beganAt && Math.hypot(e.clientX - beganAt.x, e.clientY - beganAt.y) < TOUCH_SLOP_PX ? source : null;
      if (dragging && source && over) drop.current(itemOf(source), itemOf(over.el), over.at);
      finish();
      // Only the click that ends this drag is swallowed (it comes in the same task); never a later one.
      setTimeout(() => (swallow = false), 0);
      // A finger held and lifted without moving: the item's menu, as a long press opens it elsewhere.
      if (held) held.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
    };
    // A finger dragging must not scroll the list underneath (only once the drag has begun).
    const touchMove = (e: TouchEvent) => {
      if (dragging) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const contextMenu = (e: MouseEvent) => {
      // The long press that starts a touch drag mustn't also open the item's menu.
      if (dragging) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragging) {
        over = null;
        finish();
      }
    };
    box.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", finish);
    box.addEventListener("touchmove", touchMove, { passive: false });
    box.addEventListener("click", click, true);
    box.addEventListener("contextmenu", contextMenu, true);
    window.addEventListener("keydown", key);
    return () => {
      finish();
      box.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", finish);
      box.removeEventListener("touchmove", touchMove);
      box.removeEventListener("click", click, true);
      box.removeEventListener("contextmenu", contextMenu, true);
      window.removeEventListener("keydown", key);
    };
  }, [ref, enabled]);
}
