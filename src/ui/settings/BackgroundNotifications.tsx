import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import { iosNeedsHomeScreen, type PushState, pushState } from "../../application/pushRules";
import { pushAvailable, pushRegistered, pushSupported, PushError, registerPush, systemNotify, unregisterPush } from "../../application/webPush";
import { config } from "../../application/config";
/** What each state says (docs/MELDIQ_WEB_PUSH.md). */
const TEXT: Record<PushState, string> = {
  get unsupported() {
    return uiText("settings.interface.this_browser_can_t_receive_notifications_while_meldiq_is_closed_y_55e5d45");
  },
  get insecure() {
    return uiText("settings.interface.background_notifications_need_meldiq_on_a_secure_https_address_dd793fa");
  },
  get "not-offered"() {
    return uiText("settings.interface.this_server_doesn_t_send_background_notifications_yet_you_ll_get_199be76");
  },
  get "not-configured"() {
    return uiText("settings.interface.background_notifications_aren_t_set_up_for_this_site_yet_you_ll_g_79a536f");
  },
  get denied() {
    return uiText("settings.interface.notifications_are_blocked_for_this_site_allow_them_in_your_browse_fbb9477");
  },
  get "needs-permission"() {
    return uiText("settings.interface.turn_on_desktop_notifications_above_first_0dce978");
  },
  get off() {
    return uiText("settings.interface.turn_on_desktop_notifications_above_to_get_them_while_meldiq_is_c_89d1497");
  },
  get registering() {
    return uiText("settings.interface.turning_on_63fd4df");
  },
  get failed() {
    return uiText("workspace.interface.background_notifications_couldn_t_be_turned_on_a849bc5");
  },
  get "needs-registration"() {
    return uiText("settings.interface.get_notified_of_messages_and_calls_even_when_no_meldiq_tab_is_ope_7076ae5");
  },
  get on() {
    return uiText("settings.interface.on_this_browser_is_notified_of_messages_and_calls_even_when_meldi_2804606");
  },
};
/**
 * Settings › Notifications › When Meldiq is closed: background notifications through Firebase (the Android app's
 * project), with every state spelled out, a button to (re)register, one to turn them off, and a test notification.
 */
export function BackgroundNotifications({ permission }: { permission: NotificationPermission | "unsupported" }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      .catch((e: unknown) => setError(e instanceof PushError ? e.message : uiText("settings.interface.couldn_t_reach_the_server_try_again_4fd19de")))
      .finally(() => setBusy(false));
  };
  const homeScreen = state === "unsupported" && iosNeedsHomeScreen(navigator.userAgent, matchMedia("(display-mode: standalone)").matches, navigator.maxTouchPoints);
  const canRegister = pushAvailable(engine) && (state === "needs-registration" || state === "failed" || state === "on");
  return (
    <div className="setting" style={{ alignItems: "flex-start" }}>
      <div className="lines">
        <strong>
          <Localized k="settings.interface.when_meldiq_is_closed_dfaa9ed" />
        </strong>
        <small role="status">{homeScreen ? uiText("settings.interface.on_iphone_and_ipad_ios_16_4_or_later_add_meldiq_to_your_home_scre_e6153b7") : TEXT[state]}</small>
        {error && (
          <small className="danger-text" role="alert">
            {error}
          </small>
        )}
        <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {canRegister && state !== "on" && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => registerPush(engine, { force: true }), true)}>
              {state === "failed" ? l10n("common.actions.retry") : uiText("settings.interface.turn_on_5a1f096")}
            </button>
          )}
          {state === "on" && (
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(() => unregisterPush(engine), false)}>
              <Localized k="settings.interface.turn_off_on_this_browser_1ba2e9b" />
            </button>
          )}
          {permission === "granted" && prefs.notifications && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => systemNotify({ title: "Meldiq", body: uiText("settings.interface.notifications_work_on_this_browser_33e834e"), tag: "meldiq-test", href: "/settings/notifications" })}
            >
              <Localized k="settings.interface.send_a_test_notification_ae6de6b" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
