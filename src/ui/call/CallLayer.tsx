import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { GripVertical, Maximize2, Phone, PhoneOff, Video } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { CallTargetAvatar } from "./CallAvatar";
import { CallStage } from "./CallStage";
import { callStatus } from "./callText";
import { clampToViewport, loadPosition, nudge, type Point, savePosition } from "./miniPosition";
import { useNow } from "./useNow";
import { holdUpdates } from "../../application/updates";
import { visibleViewport } from "../../application/viewport";
/** Whatever this browser's call needs on screen: the ringing card, the call stage, or the minimised bar. */
export function CallLayer() {
  useLocaleRender();
  const engine = useEngine();
  const phase = useOrbit((s) => s.call.phase);
  const minimized = useOrbit((s) => s.call.minimized);
  // A new release waits for the call to end before the tab reloads by itself (src/application/updates.ts).
  const inCall = phase !== "idle";
  useEffect(() => (inCall ? holdUpdates() : undefined), [inCall]);
  // Closing the tab mid-call tells the server at once, so the other side isn't left waiting for a reconnect.
  useEffect(() => {
    const leave = () => engine.calls.leaveOnUnload();
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [engine]);
  if (phase === "idle") return null;
  if (phase === "incoming") return <IncomingCall />;
  return minimized ? <MiniCall /> : <CallStage />;
}
function IncomingCall() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const label = uiText("calls.interface.value0_from_value1_385f939", {
    value0: call.video ? uiText("notifications.background.incomingVideo") : uiText("notifications.background.incomingVoice"),
    value1: call.title,
  });
  return (
    <section className="call-incoming" role="alertdialog" aria-label={label} aria-describedby="call-incoming-status">
      <div className="who">
        <CallTargetAvatar call={call} size={48} />
        <div className="grow">
          <h2 className="ellipsis">{call.title}</h2>
          <p id="call-incoming-status">{callStatus(call, Date.now())}</p>
        </div>
      </div>
      {call.error ? (
        <p className="note" role="note">
          {call.error}
        </p>
      ) : (
        <div className="actions">
          <figure>
            <button className="call-btn end" onClick={() => engine.calls.decline()} aria-label={l10n("calls.decline")}>
              <PhoneOff size={22} />
            </button>
            <figcaption>{l10n("calls.decline")}</figcaption>
          </figure>
          {call.video && (
            <figure>
              <button className="call-btn accept" onClick={() => void engine.calls.accept(false)} aria-label={uiText("calls.interface.answer_without_video_369b7c9")}>
                <Phone size={22} />
              </button>
              <figcaption>
                <Localized k="calls.interface.voice_only_ac49b46" />
              </figcaption>
            </figure>
          )}
          <figure>
            <button
              className="call-btn accept"
              onClick={() => void engine.calls.accept(call.video)}
              aria-label={call.video ? uiText("calls.interface.answer_with_video_1d458a1") : uiText("calls.interface.answer_b2a3aa6")}
            >
              {call.video ? <Video size={22} /> : <Phone size={22} />}
            </button>
            <figcaption>
              <Localized k="calls.interface.answer_b2a3aa6" />
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
/**
 * The minimised call: a small window that can be dragged anywhere by its grip or its text (pointer or touch), or moved
 * with the arrow keys from the grip; it stays fully on screen and this browser remembers where it was left. It starts
 * at the top right, clear of the message box and its Send button (reported: it covered them and couldn't be moved).
 */
function MiniCall() {
  useLocaleRender();
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const now = useNow(call.phase === "connected");
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{
    id: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [pos, setPos] = useState<Point | null>(loadPosition);
  const fit = useCallback((p: Point): Point => {
    const box = ref.current?.getBoundingClientRect();
    const v = visibleViewport();
    const clamped = clampToViewport({ x: p.x - v.left, y: p.y - v.top }, { width: box?.width ?? 0, height: box?.height ?? 0 }, { width: v.width, height: v.height });
    return { x: clamped.x + v.left, y: clamped.y + v.top };
  }, []);
  // A remembered place from a larger window, or a window made smaller: pulled back on screen.
  useEffect(() => {
    const refit = () => setPos((p) => (p ? fit(p) : p));
    refit();
    window.addEventListener("resize", refit);
    window.visualViewport?.addEventListener("resize", refit);
    window.visualViewport?.addEventListener("scroll", refit);
    return () => {
      window.removeEventListener("resize", refit);
      window.visualViewport?.removeEventListener("resize", refit);
      window.visualViewport?.removeEventListener("scroll", refit);
    };
  }, [fit]);
  const start = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    drag.current = { id: e.pointerId, dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) setPos(fit({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setPos((p) => {
      if (p) savePosition(p);
      return p;
    });
  };
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const next = nudge(pos ?? { x: box.left, y: box.top }, e.key, e.shiftKey);
    if (!next) return;
    e.preventDefault();
    const p = fit(next);
    setPos(p);
    savePosition(p);
  };
  const handlers = { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  return (
    <section
      ref={ref}
      className={`call-mini${pos ? " placed" : ""}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      aria-label={uiText("calls.interface.call_with_value0_5a389c7", { value0: call.title })}
    >
      <span className="call-mini-grip" role="button" tabIndex={0} aria-label={uiText("calls.interface.move_the_call_window_arrow_keys_fa894a1")} onKeyDown={keys} {...handlers}>
        <GripVertical size={16} />
      </span>
      <div className="text" {...handlers}>
        <strong className="ellipsis">{call.title}</strong>
        <span>{callStatus(call, now)}</span>
      </div>
      <button className="call-btn" onClick={() => engine.calls.setMinimized(false)} aria-label={uiText("calls.interface.show_the_call_b1c171a")}>
        <Maximize2 size={18} />
      </button>
      <button className="call-btn end" onClick={() => engine.calls.hangup()} aria-label={uiText("calls.hangUp")} disabled={call.phase === "ended"}>
        <PhoneOff size={18} />
      </button>
    </section>
  );
}
