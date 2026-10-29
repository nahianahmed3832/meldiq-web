/**
 * Release builds swallow the keys that open the browser's developer tools and View Source (the owner, 2026-10-29).
 * A light deterrent only: the browser's own menu still opens them, and nothing here protects data. Encryption and the
 * server's checks do that. Development builds keep every key.
 */

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/** Inspect (I), console (J) and the element picker (C), as browsers bind them with Shift (Windows) or Option (Mac). */
const TOOL_KEYS = new Set(["KeyI", "KeyJ", "KeyC"]);

/** Whether [e] would open developer tools or the page's source. */
export function opensInspector(e: KeyLike): boolean {
  if (e.key === "F12" || e.code === "F12") return true;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  if (TOOL_KEYS.has(e.code) && (e.shiftKey || (e.metaKey && e.altKey))) return true;
  // View Source: Ctrl+U on Windows and Linux, ⌘⌥U on a Mac.
  return e.code === "KeyU" && !e.shiftKey && (e.ctrlKey || e.altKey);
}

/** Starts the guard once, in release builds. */
export function guardInspectorKeys(): void {
  if (process.env.NODE_ENV !== "production" || typeof window === "undefined") return;
  window.addEventListener(
    "keydown",
    (e) => {
      if (!opensInspector(e)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
}
