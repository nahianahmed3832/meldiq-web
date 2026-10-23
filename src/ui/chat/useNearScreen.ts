import { useEffect, useRef, useState } from "react";

/** How far outside the visible part of the list a photo starts loading, so it's ready by the time it's scrolled to. */
const AHEAD = "800px 0px";

/**
 * Whether an element has come near the visible part of its scrolling list (the message list, or the page): photos
 * download only then, as on Discord, instead of every photo in the loaded history at once. Stays true once reached.
 * Without IntersectionObserver it's true at once.
 */
export function useNearScreen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (near || !el) return;
    // The list that scrolls, so the margin reaches ahead inside it (the window would clip it instead).
    const root = el.closest(".messages, .scroll");
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { root, rootMargin: AHEAD });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}
