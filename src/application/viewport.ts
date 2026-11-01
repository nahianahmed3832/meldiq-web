/**
 * The app's height follows what's visible (2026-10-22, iPhone keyboards). iOS Safari doesn't shrink the page when the
 * keyboard opens: it slides the page up under it, so the composer at the bottom of a 100dvh frame went behind the keyboard
 * and the header off the top. The visual viewport is what stays visible; the frame is sized and placed to it, through
 * --app-height and --app-top (src/styles/layout.css). Android Chrome resizes the page itself (interactive-widget in
 * index.html); the values then simply follow.
 */
export const PHONE_LAYOUT = "(max-width: 640px), (max-width: 960px) and (max-height: 500px) and (pointer: coarse)";

export function followVisualViewport(win: Window = window): () => void {
  const vv = win.visualViewport;
  const root = win.document.documentElement;
  if (!vv) return () => undefined;
  let frame = 0;
  const update = () => {
    frame = 0;
    // Pinch zoom (scale > 1) is the person looking closer: leave the frame alone then.
    if (vv.scale > 1.01) return;
    root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
    root.style.setProperty("--app-top", `${Math.round(vv.offsetTop)}px`);
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(update);
  };
  update();
  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  win.addEventListener("resize", schedule);
  win.addEventListener("pageshow", schedule);
  return () => {
    vv.removeEventListener("resize", schedule);
    vv.removeEventListener("scroll", schedule);
    win.removeEventListener("resize", schedule);
    win.removeEventListener("pageshow", schedule);
    if (frame) win.cancelAnimationFrame(frame);
    root.style.removeProperty("--app-height");
    root.style.removeProperty("--app-top");
  };
}

/** Coordinates for fixed popovers. Safari's keyboard can pan as well as shrink the visible viewport. */
export function visibleViewport(win: Window = window) {
  const vv = win.visualViewport;
  // Keep the browser's zoom behavior: don't reposition the content someone is magnifying.
  const useVisual = vv && vv.scale <= 1.01;
  const top = useVisual ? vv.offsetTop : 0;
  const left = useVisual ? vv.offsetLeft : 0;
  const width = useVisual ? vv.width : win.innerWidth;
  const height = useVisual ? vv.height : win.innerHeight;
  return { top, left, width, height, right: left + width, bottom: top + height };
}
