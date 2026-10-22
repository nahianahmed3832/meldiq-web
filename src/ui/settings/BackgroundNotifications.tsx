import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import { iosNeedsHomeScreen, type PushState, pushState } from "../../application/pushRules";
import { pushAvailable, pushRegistered, pushSupported, PushError, registerPush, systemNotify, unregisterPush } from "../../application/webPush";
import { config } from "../../application/config";

/** What each state says (docs/MELDIQ_WEB_PUSH.md). */
const TEXT: Record<PushState, string> = {
  unsupported: "This browser can't receive notifications while Meldiq is closed. You'll still get them while it's open in a tab.",
  insecure: "Background notifications need Meldiq on a secure (https) address.",
  "not-offered": "This server doesn't send background notifications yet. You'll get them while Meldiq is open in a tab.",
  "not-configured": "Background notifications aren't set up for this site yet. You'll get them while Meldiq is open in a tab.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
  "needs-permission": "Turn on Desktop notifications above first.",
  off: "Turn on Desktop notifications above to get them while Meldiq is closed too.",
  registering: "Turning on…",
  failed: "Background notifications couldn't be turned on.",
  "needs-registration": "Get notified of messages and calls even when no Meldiq tab is open.",
  on: "On: this browser is notified of messages and calls even when Meldiq is closed. Message text is shown only inside Meldiq.",
};

/**
 * Settings › Notifications › When Meldiq is closed: background notifications through Firebase (the Android app's
 * project), with every state spelled out, a button to (re)register, one to turn them off, and a test notification.
 */
export function BackgroundNotifications({ permission }: { permission: NotificationPermission | "unsupported" }) {
  const engine = useEngine();
  const prefs = usePrefs();
  useOrbit((s) => s.server?.features.length ?? 0); // re-render when the server's features arrive
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(() => pushRegistered(engine.device.deviceId));
  const state = pushState({
    supported: pushSupported(),
    secure: typeof window !== "undefined" && window.isSecureContext,
    serverOffers: engine.state.get().server?.features.includes("push-fcm") ?? false,
    configured: !!config().firebase,
    permission: permission === "unsupported" ? "denied" : permission,
    enabled: prefs.notifications,
    registered,
    busy,
    error,
  });
  const act = (fn: () => Promise<void>, nowRegistered: boolean) => {
    setBusy(true);
    setError(null);
    fn()
      .then(() => setRegistered(nowRegistered))
      .catch((e: unknown) => setError(e instanceof PushError ? e.message : "Couldn't reach the server. Try again."))
      .finally(() => setBusy(false));
  };
  const homeScreen = state === "unsupported" && iosNeedsHomeScreen(navigator.userAgent, matchMedia("(display-mode: standalone)").matches, navigator.maxTouchPoints);
  const canRegister = pushAvailable(engine) && (state === "needs-registration" || state === "failed" || state === "on");
  return (
    <div className="setting" style={{ alignItems: "flex-start" }}>
      <div className="lines">
        <strong>When Meldiq is closed</strong>
        <small role="status">
          {homeScreen
            ? "On iPhone and iPad (iOS 16.4 or later): add Meldiq to your Home Screen (Share › Add to Home Screen), open it from there, then turn this on. In Safari itself, notifications come while Meldiq is open."
            : TEXT[state]}
        </small>
        {error && (
          <small className="danger-text" role="alert">
            {error}
          </small>
        )}
        <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {canRegister && state !== "on" && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => registerPush(engine, { force: true }), true)}>
              {state === "failed" ? "Try again" : "Turn on"}
            </button>
          )}
          {state === "on" && (
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => unregisterPush(engine), false)}>
              Turn off on this browser
            </button>
          )}
          {permission === "granted" && prefs.notifications && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => systemNotify({ title: "Meldiq", body: "Notifications work on this browser.", tag: "meldiq-test", href: "/settings/notifications" })}
            >
              Send a test notification
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
