import { type RefObject, useEffect } from "react";

/**
 * A scrolling strip of communities (continuation brief v3 §9): the desktop rail (vertical) or the phone's strip
 * (horizontal). Native scrolling and swiping stay as they are; this adds what makes a long strip easy to use:
 *
 * - fades at the edges while there's more to scroll (classes can-scroll-start / can-scroll-end);
 * - the selected item kept in view when it changes;
 * - arrow keys move between items (Home and End too), as in a toolbar;
 * - on the horizontal strip, a mouse can drag it sideways and its wheel scrolls it sideways; a drag never opens what
 *   it started on (the click after a drag is swallowed), a tap still does.
 */
const ITEMS = "a, button";
const DRAG_PX = 6;

export function useScrollStrip(ref: RefObject<HTMLElement | null>, orientation: "vertical" | "horizontal", selectedKey: string | null): void {
  // Edge cues, updated as it scrolls or resizes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const [pos, size, view] = orientation === "vertical" ? [el.scrollTop, el.scrollHeight, el.clientHeight] : [el.scrollLeft, el.scrollWidth, el.clientWidth];
      el.classList.toggle("can-scroll-start", pos > 2);
      el.classList.toggle("can-scroll-end", pos + view < size - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [ref, orientation]);

  // The selected item in view (nearest edge: no jump when it's already visible).
  useEffect(() => {
    const sel = ref.current?.querySelector<HTMLElement>('[aria-current="true"], [aria-current="page"]');
    sel?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [ref, selectedKey]);

  // Arrow keys between items.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const [prev, next] = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    const onKey = (e: KeyboardEvent) => {
      if (![prev, next, "Home", "End"].includes(e.key)) return;
      const items = [...el.querySelectorAll<HTMLElement>(ITEMS)].filter((x) => x.offsetParent !== null);
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      const to = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, i + (e.key === next ? 1 : -1)));
      items[to].focus();
      items[to].scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref, orientation]);

  // Horizontal strip: mouse drag and wheel scroll it sideways (touch already swipes natively).
  useEffect(() => {
    const el = ref.current;
    if (!el || orientation !== "horizontal") return;
    let start: { x: number; left: number } | null = null;
    let dragged = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      start = { x: e.clientX, left: el.scrollLeft };
      dragged = false;
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      if (!dragged && Math.abs(dx) < DRAG_PX) return;
      dragged = true;
      el.scrollLeft = start.left - dx;
    };
    const up = () => {
      start = null;
    };
    const click = (e: MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("click", click, true);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("wheel", wheel);
    };
  }, [ref, orientation]);
}
