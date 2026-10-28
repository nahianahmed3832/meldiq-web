import { Maximize2, MonitorOff, MonitorUp, PhoneOff, Signal, UserPlus, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { ShareDialog } from "./ShareViews";
import { canShareScreen, INVITE_EVENT } from "./callShared";
import { useNow } from "./useNow";

/**
 * The call you're in, at the foot of the channel list (2026-10-28, after the reference the owner sent): "Voice
 * Connected" or "Video Connected" in green with how long, where (the channel and its community), then the camera,
 * the screen and hanging up; a click on it brings the call back to the middle. Shown while a call is connecting or on,
 * so the call never hides the channels.
 */
export function ConnectedCallPanel() {
  const engine = useEngine();
  const call = useOrbit((s) => s.call);
  const place = useOrbit((s) => {
    const c = call.conversationId ? s.conversations[call.conversationId] : null;
    const org = c?.orgId ? s.orgs.find((o) => o.id === c.orgId) : null;
    return { orgId: org?.id ?? null, community: org?.name ?? null };
  });
  const [sharing, setSharing] = useState(false);
  const live = call.phase === "connecting" || call.phase === "connected" || call.phase === "reconnecting" || call.phase === "outgoing";
  const now = useNow(live);
  if (!live) return null;
  const video = call.cameraOn || call.participants.some((p) => p.cameraOn);
  const since = call.connectedAt ? Math.max(0, Math.floor((now - call.connectedAt) / 1000)) : null;
  const time = since === null ? null : `${Math.floor(since / 60)}:${String(since % 60).padStart(2, "0")}`;
  const connecting = call.phase !== "connected";
  const media = !connecting && call.verification !== null;
  return (
    <section className="call-panel" aria-label="Your call">
      <div className="call-panel-top">
        <button className="call-panel-where" onClick={() => engine.calls.setMinimized(false)} aria-label={`Show the call: ${call.title}`}>
          <Signal size={16} aria-hidden="true" className={connecting ? "connecting" : undefined} />
          <span className="lines">
            <strong>{connecting ? "Connecting…" : video ? "Video Connected" : "Voice Connected"}</strong>
            <small className="ellipsis">
              {call.title}
              {place.community ? ` / ${place.community}` : ""}
              {time ? ` · ${time}` : ""}
            </small>
          </span>
        </button>
        <button className="icon-btn" onClick={() => engine.calls.setMinimized(false)} aria-label="Show the call" title="Show the call">
          <Maximize2 size={16} />
        </button>
        <button className="icon-btn call-panel-end" onClick={() => engine.calls.hangup()} aria-label="Disconnect" title="Disconnect">
          <PhoneOff size={17} />
        </button>
      </div>
      <div className="call-panel-buttons">
        <button
          className={`call-panel-btn${call.cameraOn ? " on" : ""}`}
          onClick={() => void engine.calls.toggleCamera()}
          aria-pressed={call.cameraOn}
          disabled={!media}
          title={call.cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          {call.cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
          <span className="sr-only">{call.cameraOn ? "Turn camera off" : "Turn camera on"}</span>
        </button>
        {canShareScreen() && (
          <button
            className={`call-panel-btn${call.screenSharing ? " on" : ""}`}
            onClick={() => (call.screenSharing ? void engine.calls.toggleScreenShare() : setSharing(true))}
            aria-pressed={call.screenSharing}
            disabled={!media}
            title={call.screenSharing ? "Stop sharing" : "Share your screen"}
          >
            {call.screenSharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
            <span className="sr-only">{call.screenSharing ? "Stop sharing" : "Share your screen"}</span>
          </button>
        )}
        {place.orgId && (
          <button className="call-panel-btn" onClick={() => window.dispatchEvent(new CustomEvent(INVITE_EVENT, { detail: place.orgId }))} title="Invite people">
            <UserPlus size={18} />
            <span className="sr-only">Invite people</span>
          </button>
        )}
      </div>
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </section>
  );
}
