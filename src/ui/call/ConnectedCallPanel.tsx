import { formatDuration } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Maximize2, MonitorOff, MonitorUp, PhoneOff, UserPlus, Video, VideoOff } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { CallConnection } from "./CallConnection";
import { ShareDialog } from "./ShareViews";
import { screenShareSupport, INVITE_EVENT } from "./callShared";
import { useNow } from "./useNow";
/**
 * The call you're in, at the foot of the channel list (2026-10-28, after the reference the owner sent): "Voice
 * Connected" or "Video Connected" in green with how long, where (the channel and its community), then the camera,
 * the screen and hanging up; a click on it brings the call back to the middle. Shown while a call is connecting or on,
 * so the call never hides the channels.
 */
export function ConnectedCallPanel() {
  useLocaleRender();
  const l10n = useLocalization();
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
  const time = since === null ? null : formatDuration(since * 1000);
  const connecting = call.phase !== "connected";
  const media = !connecting && call.verification !== null;
  return (
    <section className="call-panel" aria-label={uiText("calls.interface.your_call_198ec66")}>
      <div className="call-panel-top">
        <CallConnection call={call} />
        <button className="call-panel-where" onClick={() => engine.calls.setMinimized(false)} aria-label={uiText("calls.interface.show_the_call_value0_df6e659", { value0: call.title })}>
          <span className="lines">
            <strong>{connecting ? l10n("calls.connecting") : video ? uiText("calls.interface.video_connected_a09564d") : uiText("calls.interface.voice_connected_f710f6c")}</strong>
            <small className="ellipsis">
              {call.title}
              {place.community ? uiText("calls.interface.value0_6e2228f", { value0: place.community }) : ""}
              {time ? uiText("calls.interface.value0_9402340", { value0: time }) : ""}
            </small>
          </span>
        </button>
        <button
          className="icon-btn"
          onClick={() => engine.calls.setMinimized(false)}
          aria-label={uiText("calls.interface.show_the_call_b1c171a")}
          title={uiText("calls.interface.show_the_call_b1c171a")}
        >
          <Maximize2 size={16} />
        </button>
        <button
          className="icon-btn call-panel-end"
          onClick={() => engine.calls.hangup()}
          aria-label={uiText("calls.interface.disconnect_acfc5be")}
          title={uiText("calls.interface.disconnect_acfc5be")}
        >
          <PhoneOff size={17} />
        </button>
      </div>
      <div className="call-panel-buttons">
        <button
          className={`call-panel-btn${call.cameraOn ? " on" : ""}`}
          onClick={() => void engine.calls.toggleCamera()}
          aria-pressed={call.cameraOn}
          disabled={!media}
          title={call.cameraOn ? uiText("calls.cameraOff") : uiText("calls.cameraOn")}
        >
          {call.cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
          <span className="sr-only">{call.cameraOn ? uiText("calls.cameraOff") : uiText("calls.cameraOn")}</span>
        </button>
        <button
          className={`call-panel-btn${call.screenSharing ? " on" : ""}`}
          onClick={() => (call.screenSharing ? void engine.calls.toggleScreenShare() : setSharing(true))}
          aria-pressed={call.screenSharing}
          disabled={!media}
          title={call.screenSharing ? uiText("calls.stopSharing") : screenShareSupport().ok ? uiText("calls.ariaShare") : uiText("calls.interface.screen_sharing_availability_750e755")}
        >
          {call.screenSharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
          <span className="sr-only">{call.screenSharing ? uiText("calls.stopSharing") : uiText("calls.ariaShare")}</span>
        </button>
        {place.orgId && (
          <button className="call-panel-btn" onClick={() => window.dispatchEvent(new CustomEvent(INVITE_EVENT, { detail: place.orgId }))} title={uiText("calls.interface.invite_people_27bf0f2")}>
            <UserPlus size={18} />
            <span className="sr-only">
              <Localized k="calls.interface.invite_people_27bf0f2" />
            </span>
          </button>
        )}
      </div>
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </section>
  );
}
