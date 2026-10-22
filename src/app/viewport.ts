/**
 * The app's height follows what's visible (2026-10-22, iPhone keyboards). iOS Safari doesn't shrink the page when the
 * keyboard opens: it slides the page up under it, so the composer at the bottom of a 100dvh frame went behind the keyboard
 * and the header off the top. The visual viewport is what stays visible; the frame is sized and placed to it, through
 * --app-height and --app-top (src/styles/layout.css). Android Chrome resizes the page itself (interactive-widget in
 * index.html); the values then simply follow.
 */
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
  return () => {
    vv.removeEventListener("resize", schedule);
    vv.removeEventListener("scroll", schedule);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
