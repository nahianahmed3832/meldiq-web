import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const NEAR_BOTTOM = 120;
type Anchor = { id: string | null; offset: number; atBottom: boolean };

/** Ordinary entries start at latest; anchors live only for the active reading window. */
export function useReadingPosition({
  entries,
  ready = true,
  detached,
  onReading,
}: {
  entries: { id: string; mine: boolean }[];
  ready?: boolean;
  detached?: boolean;
  onReading?: (atLatest: boolean) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<Anchor>({ id: null, offset: 0, atBottom: true });
  const initialized = useRef(false);
  const jumping = useRef(false);
  const size = useRef({ height: 0, viewport: 0 });
  const previous = useRef<{ id: string; mine: boolean }[]>([]);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const callbacks = useRef({ onReading });
  useLayoutEffect(() => {
    callbacks.current = { onReading };
  });

  useEffect(() => {
    if (initialized.current) callbacks.current.onReading?.(anchor.current.atBottom && !detached);
  }, [onReading, detached]);

  const capture = useCallback(() => {
    const el = scroller.current;
    if (!el || !ready || !initialized.current) return false;
    size.current = { height: el.scrollHeight, viewport: el.clientHeight };
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    const top = el.getBoundingClientRect().top;
    const first = Array.from(el.querySelectorAll<HTMLElement>("[id^='msg-']")).find((child) => child.getBoundingClientRect().bottom > top);
    anchor.current = { id: first?.id.slice(4) ?? null, offset: first ? first.getBoundingClientRect().top - top : 0, atBottom };
    setAway(!atBottom);
    if (atBottom) {
      setUnseen(0);
      // Safari versions without scrollend still finish following when the actual bottom is reached.
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 1) jumping.current = false;
    }
    callbacks.current.onReading?.(atBottom && !detached);
    return true;
  }, [detached, ready]);
  const restore = useCallback((a: Anchor) => {
    const el = scroller.current;
    if (!el) return;
    if (a.atBottom) el.scrollTop = el.scrollHeight;
    else {
      const child = Array.from(el.querySelectorAll<HTMLElement>("[id^='msg-']")).find((node) => node.id === `msg-${a.id}`);
      if (child) el.scrollTop += child.getBoundingClientRect().top - el.getBoundingClientRect().top - a.offset;
    }
  }, []);

  // Layout runs after the newest batch reaches this actual DOM container, before it is painted.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (!ready) {
      initialized.current = false;
      return;
    }
    if (!initialized.current) {
      el.scrollTop = el.scrollHeight;
      initialized.current = true;
    } else {
      const known = new Set(previous.current.map((entry) => entry.id));
      const lastIndex = entries.findIndex((entry) => entry.id === previous.current.at(-1)?.id);
      const additions = lastIndex >= 0 ? entries.slice(lastIndex + 1).filter((entry) => !known.has(entry.id)) : [];
      if (!detached && !jumping.current && anchor.current.atBottom) el.scrollTop = el.scrollHeight;
      else {
        if (!jumping.current) restore(anchor.current);
        if (additions.length) setUnseen((n) => n + additions.filter((entry) => !entry.mine).length);
      }
    }
    previous.current = entries;
    capture();
  }, [entries, detached, restore, capture, ready]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!initialized.current) return;
      if (jumping.current) {
        if (size.current.height !== el.scrollHeight || size.current.viewport !== el.clientHeight) {
          size.current = { height: el.scrollHeight, viewport: el.clientHeight };
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
        return;
      }
      restore(anchor.current);
      capture();
    });
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child, { box: "border-box" });
    return () => observer.disconnect();
  }, [entries, restore, capture]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const finish = (event: Event) => {
      if (!jumping.current) return;
      // A completed old target may be short of an image that expanded during the animation.
      if (event.type === "scrollend" && el.scrollHeight - el.scrollTop - el.clientHeight > 1) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        return;
      }
      jumping.current = false;
      capture();
    };
    // Native scrollend also handles interrupted smooth scrolling; input cancels following immediately.
    for (const event of ["scrollend", "wheel", "touchstart", "keydown"]) el.addEventListener(event, finish);
    return () => {
      for (const event of ["scrollend", "wheel", "touchstart", "keydown"]) el.removeEventListener(event, finish);
    };
  }, [capture]);

  const latest = useCallback(() => {
    const el = scroller.current;
    if (!el || !ready) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jumping.current = smooth && el.scrollHeight - el.scrollTop - el.clientHeight > 1;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    capture();
  }, [capture, ready]);
  const onScroll = useCallback(() => {
    const el = scroller.current;
    // Layout can emit scroll before ResizeObserver runs (notably lazy images after a reload).
    // Do not mistake that movement for the reader choosing a new position.
    if (el && initialized.current && (size.current.height !== el.scrollHeight || size.current.viewport !== el.clientHeight)) {
      if (jumping.current) {
        size.current = { height: el.scrollHeight, viewport: el.clientHeight };
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else restore(anchor.current);
    }
    return capture();
  }, [capture, restore]);
  return { scroller, onScroll, away, unseen, latest };
}
