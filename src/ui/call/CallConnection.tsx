import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Signal } from "lucide-react";
import { useId, useState } from "react";
import type { CallUiState } from "../../call/types";
/** Hover, keyboard focus or a tap reveals real media-server latency, never a made-up “ping”. */
export function CallConnection({ call }: { call: CallUiState }) {
  useLocaleRender();
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const connected = call.phase === "connected";
  const latency = connected ? call.latencyMs : null;
  const weak = call.media === "stalled" || (latency !== null && latency >= 300);
  const label = !connected
    ? uiText("calls.interface.connecting_to_call_0635ee8")
    : weak
      ? uiText("calls.interface.connection_needs_attention_4f1fc01")
      : uiText("calls.interface.call_connected_27ff2ae");
  const ping =
    latency === null
      ? connected
        ? uiText("calls.interface.measuring_latency_d0a93ae")
        : uiText("calls.interface.waiting_for_connection_28ee760")
      : uiText("calls.interface.value0_ms_33f3d58", { value0: latency });
  return (
    <span className={`call-connection${pinned ? " pinned" : ""}${weak ? " weak" : ""}`}>
      <button
        className="call-signal icon-btn"
        aria-label={uiText("calls.interface.call_connection_value0_e4d5ac5", { value0: ping })}
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
        <small>
          <Localized k="calls.interface.round_trip_latency_to_the_call_server_ce8d2a1" />
        </small>
        {call.path && <small>{call.path}</small>}
      </span>
    </span>
  );
}
