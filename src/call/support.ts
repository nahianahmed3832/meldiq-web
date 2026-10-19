/**
 * Whether this browser can take part in Orbit calls: end-to-end encrypted media needs encoded-frame access
 * (RTCRtpScriptTransform in Firefox and Safari, encoded streams in Chromium), module workers and getUserMedia in a secure
 * context. Checked without loading LiveKit.
 */
export function callSupport(): { ok: boolean; missing: string | null } {
  if (typeof window === "undefined" || typeof RTCPeerConnection === "undefined") return { ok: false, missing: "WebRTC" };
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return { ok: false, missing: "a secure connection (HTTPS)" };
  if (typeof Worker === "undefined") return { ok: false, missing: "web workers" };
  const scriptTransform = "RTCRtpScriptTransform" in window;
  const encodedStreams = typeof RTCRtpSender !== "undefined" && "createEncodedStreams" in RTCRtpSender.prototype;
  if (!scriptTransform && !encodedStreams) return { ok: false, missing: "media frame encryption (RTCRtpScriptTransform)" };
  return { ok: true, missing: null };
}
