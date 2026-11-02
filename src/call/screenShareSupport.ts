/** Feature detection, rather than device names: mobile browsers can add screen capture independently. */
export function screenShareSupport(): { ok: true; reason: null } | { ok: false; reason: string } {
  if (typeof window === "undefined" || typeof navigator === "undefined") return { ok: false, reason: "Screen sharing is available during a call in a supported browser." };
  if (!window.isSecureContext) return { ok: false, reason: "Screen sharing needs a secure connection. Open Meldiq over HTTPS and try again." };
  if (typeof navigator.mediaDevices?.getDisplayMedia !== "function")
    return {
      ok: false,
      reason: "This browser doesn't support sharing your screen. Share from a supported desktop browser. You can still watch screens shared by other people here.",
    };
  return { ok: true, reason: null };
}

export class ScreenShareUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ScreenShareUnavailable";
  }
}
