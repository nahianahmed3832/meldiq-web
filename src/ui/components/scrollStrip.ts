import { type RefObject, useEffect } from "react";

/**
 * The rail of communities (brief v4 §14), on desktop and on the phone's Home tab beside the channels (as in the Android
 * app). Native scrolling (wheel, trackpad, touch) is left entirely to the browser; this only adds:
 *
 * - edge cues while there's more to scroll (classes can-scroll-start / can-scroll-end, drawn by sticky overlays in CSS,
 *   never a mask on the scrolling element: a mask on a scroller costs Safari its fast scrolling);
 * - the selected item kept in view when it changes, by scrolling this strip only (scrollIntoView would also move the
 *   page and any scrolling ancestor);
 * - arrow keys move between items (Home and End too), as in a toolbar.
 */
const ITEMS = "a, button";
/** Room left above or below the selected item when it's brought into view, so the edge cue doesn't cover it. */
const EDGE_ROOM_PX = 28;

export function useScrollStrip(ref: RefObject<HTMLElement | null>, selectedKey: string | null): void {
  // Edge cues, updated as it scrolls or resizes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.classList.toggle("can-scroll-start", el.scrollTop > 2);
      el.classList.toggle("can-scroll-end", el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [ref]);

  // The selected item in view (no jump when it's already visible).
  useEffect(() => {
    const el = ref.current;
    const sel = el?.querySelector<HTMLElement>('[aria-current="true"], [aria-current="page"]');
    if (el && sel) revealIn(el, sel);
  }, [ref, selectedKey]);

  // Arrow keys between items.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
      const items = [...el.querySelectorAll<HTMLElement>(ITEMS)].filter((x) => x.offsetParent !== null);
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      const to = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
      items[to].focus({ preventScroll: true });
      revealIn(el, items[to]);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [ref]);
}

/** Scrolls [strip] (and nothing else) just enough to show [item]. */
export function revealIn(strip: HTMLElement, item: HTMLElement): void {
  const s = strip.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  if (r.top < s.top + EDGE_ROOM_PX) strip.scrollTop -= s.top + EDGE_ROOM_PX - r.top;
  else if (r.bottom > s.bottom - EDGE_ROOM_PX) strip.scrollTop += r.bottom - (s.bottom - EDGE_ROOM_PX);
}
