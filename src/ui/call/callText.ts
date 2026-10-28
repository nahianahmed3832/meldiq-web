import type { CallUiState } from "../../call/types";

/** What the call screen says about where the call is (android CallOverlay status lines). */
export function callStatus(s: CallUiState, now: number): string {
  switch (s.phase) {
    case "incoming":
      return s.isGroup ? (s.subtitle ?? "Incoming call") : s.video ? "Incoming video call" : "Incoming voice call";
    case "outgoing":
      if (s.askingPermission) return permissionPrompt(s.video);
      return s.alerted ? "Ringing…" : "Calling…";
    case "connecting":
      if (s.askingPermission) return permissionPrompt(s.cameraOn);
      if (s.waitingForKey) return "Getting the call's encryption key…";
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "connected":
      if (s.media === "stalled") return "Reconnecting media…";
      return s.connectedAt ? duration(now - s.connectedAt) : "Connected";
    case "ended":
      return s.error ?? endedText(s.endReason);
    default:
      return "";
  }
}

function permissionPrompt(video: boolean): string {
  return `Allow ${video ? "your microphone and camera" : "your microphone"} in the browser's prompt…`;
}

export function endedText(reason: string | null): string {
  switch (reason) {
    case "declined":
      return "Declined";
    case "busy":
      return "Busy on another call";
    case "missed":
      return "No answer";
    case "lost":
      return "The connection was lost";
    case "answered elsewhere":
      return "Answered on another device";
    case "removed":
      return "You're no longer in this call";
    case "joined_elsewhere":
      return "You joined this call on another device";
    case "disconnected":
      return "Disconnected";
    default:
      return "Call ended";
  }
}

/** m:ss, or h:mm:ss after an hour. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export const SECURITY_LABEL = {
  encrypted: "Encrypted call",
  verifying: "Checking encryption…",
  problem: "Encryption problem",
} as const;
