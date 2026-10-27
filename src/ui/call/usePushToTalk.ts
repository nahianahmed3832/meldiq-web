import { useEffect } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";

/** Keys that can't be typed, so push to talk may use them even while a text field has the focus. */
const NON_TYPING = /^(F\d{1,2}|Control|Alt|Shift|Meta|CapsLock|Pause|ScrollLock|Insert|Home|End|PageUp|PageDown)/;

/**
 * Push to talk (Settings › Voice & Audio, 2026-10-28): while in a call with it on, the microphone is on only while the
 * chosen key is held. A typing key held in a text field types instead; switching away from the tab lets go.
 */
export function usePushToTalk(): void {
  const engine = useEngine();
  const { pushToTalk, pttKey } = usePrefs();
  const inCall = useOrbit((s) => s.call.phase !== "idle");
  useEffect(() => {
    if (!pushToTalk || !pttKey || !inCall) return;
    const typing = (e: KeyboardEvent) => !NON_TYPING.test(e.code) && !!(e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
    const down = (e: KeyboardEvent) => {
      if (e.code !== pttKey || e.repeat || typing(e)) return;
      void engine.calls.pushToTalk(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === pttKey) void engine.calls.pushToTalk(false);
    };
    const release = () => void engine.calls.pushToTalk(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [engine, pushToTalk, pttKey, inCall]);
}
