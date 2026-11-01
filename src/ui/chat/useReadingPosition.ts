import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { readingPosition, rememberReading, type ReadingPosition } from "../../application/readingPosition";

const NEAR_BOTTOM = 120;
type Anchor = Pick<ReadingPosition, "id" | "offset" | "atBottom">;

/** Keeps the same visible message through prepends, concurrent arrivals and late media/font resizing. */
export function useReadingPosition({
  scope,
  entries,
  ready = true,
  detached,
  unreadId,
  onRestore,
  onReading,
}: {
  scope: string;
  entries: { id: string; mine: boolean }[];
  ready?: boolean;
  detached?: boolean;
  unreadId?: string;
  onRestore?: (id: string) => Promise<void>;
  onReading?: (atLatest: boolean) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const initial = useRef(readingPosition(scope));
  const anchor = useRef<Anchor>({ id: null, offset: 0, atBottom: true });
  const initialized = useRef(false);
  const unreadApplied = useRef(false);
  const restoring = useRef<"idle" | "pending" | "done">("idle");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const previous = useRef<{ id: string; mine: boolean }[]>([]);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [attempt, retry] = useState(0);
  const callbacks = useRef({ onRestore, onReading });
  useLayoutEffect(() => {
    callbacks.current = { onRestore, onReading };
  });

  useEffect(() => {
    if (initialized.current) callbacks.current.onReading?.(anchor.current.atBottom && !detached);
  }, [onReading, detached]);

  const target = useCallback((id: string) => Array.from(scroller.current?.querySelectorAll<HTMLElement>("[id^='msg-']") ?? []).find((el) => el.id === `msg-${id}`), []);
  const capture = useCallback(() => {
    const el = scroller.current;
    if (!el || !ready) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    const top = el.getBoundingClientRect().top;
    const first = Array.from(el.querySelectorAll<HTMLElement>("[id^='msg-']")).find((child) => child.getBoundingClientRect().bottom > top);
    anchor.current = { id: first?.id.slice(4) ?? null, offset: first ? first.getBoundingClientRect().top - top : 0, atBottom };
    setAway(!atBottom);
    if (atBottom) setUnseen(0);
    if (initialized.current) {
      rememberReading(scope, anchor.current);
      callbacks.current.onReading?.(atBottom && !detached);
    }
  }, [scope, detached, ready]);
  const restore = useCallback(
    (a: Anchor) => {
      const el = scroller.current;
      if (!el) return false;
      const child = a.id ? target(a.id) : null;
      if (a.atBottom) el.scrollTop = el.scrollHeight;
      else if (child) el.scrollTop += child.getBoundingClientRect().top - el.getBoundingClientRect().top - a.offset;
      else return false;
      return true;
    },
    [target],
  );

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !entries.length || !ready) return;
    if (!initialized.current) {
      if (restoring.current === "done" && initial.current?.id && !target(initial.current.id)) initial.current = null;
      const saved = initial.current?.atBottom && unreadId ? null : initial.current;
      if (saved && !restore(saved) && callbacks.current.onRestore) {
        el.scrollTop = el.scrollHeight;
        return;
      }
      if (!saved) {
        const unread = unreadId ? target(unreadId) : null;
        if (unread) el.scrollTop += unread.getBoundingClientRect().top - el.getBoundingClientRect().top - 36;
        else el.scrollTop = el.scrollHeight;
      }
      initialized.current = true;
    } else if (unreadId && !unreadApplied.current && anchor.current.atBottom && (!initial.current || initial.current.atBottom)) {
      const unread = target(unreadId);
      if (unread) el.scrollTop += unread.getBoundingClientRect().top - el.getBoundingClientRect().top - 36;
    } else {
      const prior = previous.current;
      const known = new Set(prior.map((e) => e.id));
      const last = prior.at(-1)?.id;
      const lastIndex = entries.findIndex((e) => e.id === last);
      const additions = lastIndex >= 0 ? entries.slice(lastIndex + 1).filter((e) => !known.has(e.id)) : [];
      if (!detached && (anchor.current.atBottom || additions.some((e) => e.mine))) el.scrollTop = el.scrollHeight;
      else {
        restore(anchor.current);
        if (additions.length) setUnseen((n) => n + additions.filter((e) => !e.mine).length);
      }
    }
    if (unreadId) unreadApplied.current = true;
    previous.current = entries;
    capture();
  }, [entries, detached, unreadId, target, restore, capture, attempt, ready]);

  // If a saved anchor is outside the newest page, request its own contiguous history window once.
  useEffect(() => {
    const saved = initial.current;
    if (!ready || initialized.current || restoring.current !== "idle" || !saved?.id || target(saved.id) || !callbacks.current.onRestore || !entries.length) return;
    restoring.current = "pending";
    void callbacks.current
      .onRestore(saved.id)
      .catch(() => {
        if (mounted.current) initial.current = null;
      })
      .finally(() => {
        if (mounted.current) {
          restoring.current = "done";
          retry((n) => n + 1);
        }
      });
  }, [scope, target, entries.length, ready]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!initialized.current) return;
      restore(anchor.current);
      capture();
    });
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child, { box: "border-box" });
    return () => observer.disconnect();
  }, [entries, restore, capture]);

  const latest = useCallback(() => {
    const el = scroller.current;
    initialized.current = true;
    initial.current = null;
    anchor.current = { id: null, offset: 0, atBottom: true };
    if (el) el.scrollTop = el.scrollHeight;
    capture();
  }, [capture]);
  return { scroller, onScroll: capture, away, unseen, latest };
}
