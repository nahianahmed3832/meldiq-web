import { text as uiText } from "../../i18n";
import type { CallUiState } from "../../call/types";
import { formatDuration } from "../../i18n/format";
import { text } from "../../i18n";
/** What the call screen says about where the call is (android CallOverlay status lines). */
export function callStatus(s: CallUiState, now: number): string {
  switch (s.phase) {
    case "incoming":
      return s.isGroup ? (s.subtitle ?? text("calls.incoming")) : text(s.video ? "calls.incomingVideo" : "calls.incomingVoice");
    case "outgoing":
      if (s.askingPermission) return permissionPrompt(s.video);
      return s.alerted ? uiText("calls.interface.ringing_7398751") : text("calls.calling");
    case "connecting":
      if (s.askingPermission) return permissionPrompt(s.cameraOn);
      if (s.waitingForKey) return uiText("calls.interface.getting_the_call_s_encryption_key_88db815");
      return text("calls.connecting");
    case "reconnecting":
      return text("calls.reconnecting");
    case "connected":
      if (s.media === "stalled") return uiText("calls.interface.reconnecting_media_bf0034e");
      return s.connectedAt ? duration(now - s.connectedAt) : text("calls.connected");
    case "ended":
      return s.error ?? endedText(s.endReason);
    default:
      return "";
  }
}
function permissionPrompt(video: boolean): string {
  return uiText("calls.interface.allow_value0_in_the_browser_s_prompt_dd6b3ab", {
    value0: video ? uiText("workspace.interface.your_microphone_and_camera_039df3e") : uiText("workspace.interface.your_microphone_9573f0e"),
  });
}
export function endedText(reason: string | null): string {
  switch (reason) {
    case "declined":
      return uiText("calls.interface.declined_dce083a");
    case "busy":
      return uiText("calls.interface.busy_on_another_call_aa2fdc1");
    case "missed":
      return uiText("calls.interface.no_answer_7e49c68");
    case "lost":
      return uiText("calls.interface.the_connection_was_lost_9be4746");
    case "answered elsewhere":
      return uiText("calls.interface.answered_on_another_device_6f798ea");
    case "removed":
      return uiText("calls.interface.you_re_no_longer_in_this_call_412816b");
    case "joined_elsewhere":
      return uiText("calls.interface.you_joined_this_call_on_another_device_30b199c");
    case "disconnected":
      return uiText("calls.interface.disconnected_04dfac3");
    default:
      return text("calls.ended");
  }
}
/** m:ss, or h:mm:ss after an hour. */
export function duration(ms: number): string {
  return formatDuration(ms);
}
export const SECURITY_LABEL = {
  get encrypted() {
    return uiText("calls.interface.encrypted_call_0ce130c");
  },
  get verifying() {
    return uiText("calls.interface.checking_encryption_8767b45");
  },
  get problem() {
    return uiText("calls.interface.encryption_problem_77d205f");
  },
} as const;
