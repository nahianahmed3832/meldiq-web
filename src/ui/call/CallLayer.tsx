import { GripVertical, Maximize2, Phone, PhoneOff, Video } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { Avatar } from "../components/Avatar";
import { CallStage } from "./CallStage";
import { callStatus } from "./callText";
import { clampToViewport, loadPosition, nudge, type Point, savePosition } from "./miniPosition";
import { useNow } from "./useNow";
import { holdUpdates } from "../../application/updates";

/** Whatever this browser's call needs on screen: the ringing card, the call stage, or the minimised bar. */
export function CallLayer() {
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
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const label = `${call.video ? "Incoming video call" : "Incoming voice call"} from ${call.title}`;
  return (
    <section className="call-incoming" role="alertdialog" aria-label={label} aria-describedby="call-incoming-status">
      <div className="who">
        <Avatar name={call.title} colorIndex={call.colorIndex} size={48} decorative />
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
            <button className="call-btn end" onClick={() => engine.calls.decline()} aria-label="Decline">
              <PhoneOff size={22} />
            </button>
            <figcaption>Decline</figcaption>
          </figure>
          {call.video && (
            <figure>
              <button className="call-btn accept" onClick={() => void engine.calls.accept(false)} aria-label="Answer without video">
                <Phone size={22} />
              </button>
              <figcaption>Voice only</figcaption>
            </figure>
          )}
          <figure>
            <button className="call-btn accept" onClick={() => void engine.calls.accept(call.video)} aria-label={call.video ? "Answer with video" : "Answer"}>
              {call.video ? <Video size={22} /> : <Phone size={22} />}
            </button>
            <figcaption>Answer</figcaption>
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
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const now = useNow(call.phase === "connected");
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<Point | null>(loadPosition);

  const fit = useCallback((p: Point): Point => {
    const box = ref.current?.getBoundingClientRect();
    return clampToViewport(p, { width: box?.width ?? 0, height: box?.height ?? 0 }, { width: window.innerWidth, height: window.innerHeight });
  }, []);
  // A remembered place from a larger window, or a window made smaller: pulled back on screen.
  useEffect(() => {
    const refit = () => setPos((p) => (p ? fit(p) : p));
    refit();
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
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
    <section ref={ref} className={`call-mini${pos ? " placed" : ""}`} style={pos ? { left: pos.x, top: pos.y } : undefined} aria-label={`Call with ${call.title}`}>
      <span className="call-mini-grip" role="button" tabIndex={0} aria-label="Move the call window (arrow keys)" onKeyDown={keys} {...handlers}>
        <GripVertical size={16} />
      </span>
      <div className="text" {...handlers}>
        <strong className="ellipsis">{call.title}</strong>
        <span>{callStatus(call, now)}</span>
      </div>
      <button className="call-btn" onClick={() => engine.calls.setMinimized(false)} aria-label="Show the call">
        <Maximize2 size={18} />
      </button>
      <button className="call-btn end" onClick={() => engine.calls.hangup()} aria-label="Hang up" disabled={call.phase === "ended"}>
        <PhoneOff size={18} />
      </button>
    </section>
  );
}
