import { Signal } from "lucide-react";
import { useId, useState } from "react";
import type { CallUiState } from "../../call/types";

/** Hover, keyboard focus or a tap reveals real media-server latency, never a made-up “ping”. */
export function CallConnection({ call }: { call: CallUiState }) {
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const connected = call.phase === "connected";
  const latency = connected ? call.latencyMs : null;
  const weak = call.media === "stalled" || (latency !== null && latency >= 300);
  const label = !connected ? "Connecting to call" : weak ? "Connection needs attention" : "Call connected";
  const ping = latency === null ? (connected ? "Measuring latency…" : "Waiting for connection…") : `${latency} ms`;
  return (
    <span className={`call-connection${pinned ? " pinned" : ""}${weak ? " weak" : ""}`}>
      <button
        className="call-signal icon-btn"
        aria-label={`Call connection: ${ping}`}
        aria-describedby={id}
        onClick={() => setPinned((p) => !p)}
        onBlur={() => setPinned(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setPinned(false);
            e.currentTarget.blur();
          }
        }}
      >
        <Signal size={17} aria-hidden="true" className={!connected ? "connecting" : undefined} />
      </button>
      <span className="call-connection-detail" role="tooltip" id={id}>
        <strong>{label}</strong>
        <span className="call-ping">{ping}</span>
        <small>Round-trip latency to the call server</small>
        {call.path && <small>{call.path}</small>}
      </span>
    </span>
  );
}
