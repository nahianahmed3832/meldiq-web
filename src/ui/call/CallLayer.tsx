import { Maximize2, Phone, PhoneOff, Video } from "lucide-react";
import { useEffect } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { Avatar } from "../components/Avatar";
import { CallStage } from "./CallStage";
import { callStatus } from "./callText";
import { useNow } from "./useNow";

/** Whatever this browser's call needs on screen: the ringing card, the call stage, or the minimised bar. */
export function CallLayer() {
  const engine = useEngine();
  const phase = useOrbit((s) => s.call.phase);
  const minimized = useOrbit((s) => s.call.minimized);

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

function MiniCall() {
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const now = useNow(call.phase === "connected");
  return (
    <section className="call-mini" aria-label={`Call with ${call.title}`}>
      <div className="text">
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
