import { text as uiText } from "../i18n";
/** Feature detection, rather than device names: mobile browsers can add screen capture independently. */
export function screenShareSupport():
  | {
      ok: true;
      reason: null;
    }
  | {
      ok: false;
      reason: string;
    } {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return { ok: false, reason: uiText("calls.interface.screen_sharing_is_available_during_a_call_in_a_supported_browser_a24bd90") };
  if (!window.isSecureContext) return { ok: false, reason: uiText("calls.interface.screen_sharing_needs_a_secure_connection_open_meldiq_over_https_a_9178776") };
  if (typeof navigator.mediaDevices?.getDisplayMedia !== "function")
    return {
      ok: false,
      reason: uiText("calls.interface.this_browser_doesn_t_support_sharing_your_screen_share_from_a_sup_04ce97d"),
    };
  return { ok: true, reason: null };
}
export class ScreenShareUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ScreenShareUnavailable";
  }
}
