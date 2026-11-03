import { text as uiText } from "../i18n";
/**
 * Whether this browser can take part in Orbit calls: end-to-end encrypted media needs encoded-frame access
 * (RTCRtpScriptTransform in Firefox and Safari, encoded streams in Chromium), module workers and getUserMedia in a secure
 * context. Checked without loading LiveKit.
 */
export function callSupport(): {
  ok: boolean;
  missing: string | null;
} {
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") return { ok: false, missing: "WebRTC" };
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return { ok: false, missing: uiText("workspace.interface.a_secure_connection_https_2dd44a3") };
  if (typeof Worker === "undefined") return { ok: false, missing: uiText("calls.interface.web_workers_f2cb7be") };
  const scriptTransform = "RTCRtpScriptTransform" in window;
  const encodedStreams = typeof RTCRtpSender !== "undefined" && "createEncodedStreams" in RTCRtpSender.prototype;
  if (!scriptTransform && !encodedStreams) return { ok: false, missing: uiText("calls.interface.media_frame_encryption_rtcrtpscripttransform_a65b419") };
  return { ok: true, missing: null };
}
