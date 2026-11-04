import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { syncPlusReminderPreference } from "../../application/plusSupport";
import { BugReportsCard } from "./AccountExtrasCards";
import { NotificationOverview } from "./NotificationOverview";
import { VibesCard } from "./AppearanceExtras";
import { fileLimit, MAX_FILES_PER_MESSAGE } from "../../sync/attachments";
import { APP_VERSION } from "../../application/env";
import { serverHost } from "../../application/config";
import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { LIST_PREVIEWS, MESSAGE_LAYOUTS, type Palette, PALETTES, type Prefs, QUICK_REACTIONS, setPrefs, THEMES, TIME_FORMATS, usePrefs, volumeOf } from "../../application/prefs";
import { bytes } from "../format";
import { Toggle } from "../components/Toggle";
import { BackgroundNotifications } from "./BackgroundNotifications";
import { type ChimeState, chimeState, playChime, unlockChime } from "../../application/messageChime";
import { type StringKey, useT } from "../../i18n";
import { InstallSetting } from "./InstallButton";
const THEME_KEY = { system: "ap_system", light: "ap_light", dark: "ap_dark", black: "ap_black" } as const satisfies Record<Prefs["theme"], StringKey>;
const PALETTE_KEY = { meldiq: "ap_meldiq", midnight: "ap_midnight", charcoal: "ap_charcoal", indigo: "ap_indigo", plum: "ap_plum", amber: "ap_amber" } as const satisfies Record<Palette, StringKey>;
export function NotificationsPage() {
  useLocaleRender();
  const engine = useEngine();
  const [reminderLoading, setReminderLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void syncPlusReminderPreference(engine)
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReminderLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [engine]);
  const prefs = usePrefs();
  const t = useT();
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(supported ? Notification.permission : "unsupported");
  const enable = async (on: boolean) => {
    if (!on) return setPrefs({ notifications: false, notifyChoice: "off" });
    if (!supported) return;
    // Asked only here, on the person's own click, never at sign-in.
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermission(p);
    setPrefs({ notifications: p === "granted", notifyChoice: p === "granted" ? "on" : "unset" });
  };
  return (
    <>
      <h1>{t("settings_notifications")}</h1>
      <NotificationOverview />
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.support_meldiq_reminders_afc5eec" />
            </strong>
            <small>
              <Localized k="settings.interface.occasional_in_app_reminders_about_optional_plus_subscriptions_tha_3c7de7a" />
            </small>
          </div>
          <Toggle
            label={uiText("settings.interface.support_meldiq_reminders_afc5eec")}
            disabled={reminderLoading}
            checked={prefs.plusReminders}
            onChange={(plusReminders) => {
              setPrefs({ plusReminders });
              void engine.api
                .call("PUT", "/v2/billing/promotions/preference", { body: { optOut: !plusReminders } })
                .catch(() => engine.notice("error", uiText("settings.interface.your_reminder_preference_could_not_be_saved_across_devices_please_d8ace7d")));
            }}
          />
        </div>
      </div>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_desktop")}</strong>
            <small>{permission === "unsupported" ? t("nt_desktop_unsupported") : permission === "denied" ? t("nt_desktop_blocked") : t("nt_desktop_sub")}</small>
          </div>
          <Toggle label={t("nt_desktop")} checked={prefs.notifications && permission === "granted"} onChange={(v) => void enable(v)} />
        </div>
        <BackgroundNotifications permission={permission} />
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_text")}</strong>
            <small>{t("nt_text_sub")}</small>
          </div>
          <Toggle label={t("nt_text")} checked={prefs.notificationText} onChange={(v) => setPrefs({ notificationText: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_groups")}</strong>
            <small>{t("nt_groups_sub")}</small>
          </div>
          <Toggle label={t("nt_groups")} checked={prefs.groupNotifications} onChange={(v) => setPrefs({ groupNotifications: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_sound")}</strong>
            <small>{t("nt_sound_sub")}</small>
          </div>
          <Toggle label={t("nt_sound")} checked={prefs.messageSound} onChange={(v) => setPrefs({ messageSound: v })} />
        </div>
        <InAppSoundSettings />
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_ring")}</strong>
            <small>{t("nt_ring_sub")}</small>
          </div>
          <Toggle label={t("nt_ring")} checked={prefs.callRingtone} onChange={(v) => setPrefs({ callRingtone: v })} />
        </div>
      </div>
    </>
  );
}
/** The chime in this tab (application/messageChime.ts): on or off, its volume, and a test that also unlocks sound. */
function InAppSoundSettings() {
  useLocaleRender();
  const prefs = usePrefs();
  const t = useT();
  const [state, setState] = useState<ChimeState>(chimeState());
  const [result, setResult] = useState<"played" | "blocked" | null>(null);
  const test = async () => {
    const now = await unlockChime();
    setState(now);
    setResult(now === "ready" && (await playChime(Math.max(prefs.soundVolume, 1))) ? "played" : "blocked");
  };
  return (
    <>
      <div className="setting">
        <div className="lines">
          <strong>{t("nt_in_app")}</strong>
          <small>{state === "unsupported" ? t("nt_in_app_unsupported") : state === "locked" && prefs.inAppSound ? t("nt_in_app_locked") : t("nt_in_app_sub")}</small>
        </div>
        <Toggle label={t("nt_in_app")} checked={prefs.inAppSound} disabled={state === "unsupported"} onChange={(v) => setPrefs({ inAppSound: v })} />
      </div>
      {prefs.inAppSound && state !== "unsupported" && (
        <div className="setting">
          <div className="lines">
            <strong id="nt-volume-label">{t("nt_volume")}</strong>
            <small>{t("nt_volume_value", { n: prefs.soundVolume })}</small>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={prefs.soundVolume}
              aria-labelledby="nt-volume-label"
              onChange={(e) => setPrefs({ soundVolume: volumeOf(Number(e.currentTarget.value)) })}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => void test()}>
              {t("nt_test_sound")}
            </button>
          </div>
          {result && (
            <small className={result === "played" ? "faint" : "field-error"} role="status" style={{ flexBasis: "100%" }}>
              {result === "played"
                ? uiText("settings.interface.played_if_you_heard_nothing_check_this_site_isn_t_muted_in_the_br_c35c0f3")
                : uiText("settings.interface.the_browser_blocked_sound_allow_sound_for_this_site_in_the_browse_8dce822")}
            </small>
          )}
        </div>
      )}
    </>
  );
}
export function AppearancePage() {
  useLocaleRender();
  const prefs = usePrefs();
  const t = useT();
  return (
    <>
      <h1>{t("settings_appearance")}</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_theme")}</strong>
            <small>{t("ap_theme_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_theme")}>
            {THEMES.map((th) => (
              <button key={th} aria-pressed={prefs.theme === th} onClick={() => setPrefs({ theme: th, themeChosen: true })}>
                {t(THEME_KEY[th])}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_colour")}</strong>
            <small>{t("ap_colour_sub")}</small>
          </div>
          <div className="palette-picker" role="radiogroup" aria-label={t("ap_colour")}>
            {PALETTES.map((p) => (
              <button key={p} role="radio" aria-checked={prefs.palette === p} className="palette-swatch" data-swatch={p} onClick={() => setPrefs({ palette: p, paletteChosen: true })}>
                <span className="swatch" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {t(PALETTE_KEY[p])}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_layout")}</strong>
            <small>{t("ap_layout_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_layout")}>
            {MESSAGE_LAYOUTS.map((l) => (
              <button key={l} aria-pressed={prefs.messageLayout === l} onClick={() => setPrefs({ messageLayout: l })}>
                {l === "stream" ? t("ap_stream") : t("ap_bubbles")}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_time")}</strong>
            <small>{t("ap_time_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_time")}>
            {TIME_FORMATS.map((f) => (
              <button key={f} aria-pressed={prefs.timeFormat === f} onClick={() => setPrefs({ timeFormat: f })}>
                {f === "auto" ? t("ap_auto") : f === "12" ? t("ap_12h") : t("ap_24h")}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_previews")}</strong>
            <small>{t("ap_previews_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_previews")}>
            {LIST_PREVIEWS.map((v) => (
              <button key={v} aria-pressed={prefs.listPreview === v} onClick={() => setPrefs({ listPreview: v })}>
                {v === "all" ? t("ap_all") : v === "unread" ? t("ap_unread_only") : t("ap_none")}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_autophoto")}</strong>
            <small>{t("ap_autophoto_sub")}</small>
          </div>
          <Toggle label={t("ap_autophoto")} checked={prefs.autoLoadPhotos} onChange={(v) => setPrefs({ autoLoadPhotos: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.photo_uploads_8e74c58" />
            </strong>
            <small>
              <Localized k="settings.interface.photos_are_optimized_automatically_animations_and_transparency_ar_57d42ba" />
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_swipe")}</strong>
            <small>{t("ap_swipe_sub")}</small>
          </div>
          <Toggle label={t("ap_swipe")} checked={prefs.swipeToReply} onChange={(v) => setPrefs({ swipeToReply: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_doubletap")}</strong>
            <small>{t("ap_doubletap_sub")}</small>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {prefs.doubleTapReact && (
              <div className="segmented" role="group" aria-label={t("ap_doubletap_emoji")}>
                {QUICK_REACTIONS.map((e) => (
                  <button key={e} aria-pressed={prefs.quickReaction === e} onClick={() => setPrefs({ quickReaction: e })} aria-label={t("ap_react_with", { emoji: e })}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            <Toggle label={t("ap_doubletap")} checked={prefs.doubleTapReact} onChange={(v) => setPrefs({ doubleTapReact: v })} />
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_media")}</strong>
            <small>{t("ap_media_sub")}</small>
          </div>
          <Toggle label={t("ap_media")} checked={prefs.mediaCards} onChange={(v) => setPrefs({ mediaCards: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_youtube")}</strong>
            <small>{t("ap_youtube_sub")}</small>
          </div>
          <Toggle label={t("ap_youtube")} checked={prefs.youtubeInApp} onChange={(v) => setPrefs({ youtubeInApp: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("ap_enter")}</strong>
            <small>{t("ap_enter_sub")}</small>
          </div>
          <Toggle label={t("ap_enter")} checked={prefs.enterToSend} onChange={(v) => setPrefs({ enterToSend: v })} />
        </div>
      </div>
      <VibesCard />
    </>
  );
}
export function AboutPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const server = useOrbit((s) => s.server);
  const me = useOrbit((s) => s.me);
  return (
    <>
      <h1>{l10n("settings.settings_about")}</h1>
      <p className="faint" style={{ margin: "0 0 12px" }}>
        <Localized k="settings.interface.meldiq_web_by_griipbuddy_version_82f9bb9" slots={[APP_VERSION]} />
      </p>
      <div className="card">
        <InstallSetting />
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="auth.interface.service_status_cce5eda" />
            </strong>
            <small>
              <Localized k="settings.interface.live_service_health_incidents_and_planned_maintenance_d946362" />
            </small>
          </div>
          <a href="https://status.meldiq.app" target="_blank" rel="noopener noreferrer">
            <Localized k="settings.interface.view_status_34820d5" />
          </a>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.server_aef7de2" />
            </strong>
            <small>
              {serverHost()}
              {server ? uiText("settings.interface.value0_value1_client_api_value2_a31980c", { value0: server.instanceName ?? "Meldiq", value1: server.version, value2: server.api }) : ""}
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.this_browser_101f4d9" />
            </strong>
            <small>{me?.deviceName}</small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{l10n("files.files")}</strong>
            <small>
              <Localized k="settings.interface.up_to_per_file_files_per_message_files_are_kept_7_days_on_the_ser_1158527" slots={[bytes(fileLimit(server)), MAX_FILES_PER_MESSAGE]} />
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.calls_b73a5e2" />
            </strong>
            <small>
              {server?.calling
                ? uiText("settings.interface.voice_and_video_calls_work_in_this_browser_and_in_meldiq_on_your_da83cef")
                : uiText("settings.interface.this_server_has_no_calling_configured_2986115")}
            </small>
          </div>
        </div>
      </div>
      <BugReportsCard />
      <p className="faint" style={{ fontSize: 12.5 }}>
        <Localized
          k="settings.interface.meldiq_web_0_1_0_plus_jakarta_sans_is_used_under_the_sil_open_fon_7a2c148"
          slots={[
            <a href="/fonts/OFL.txt">
              <Localized k="settings.interface.license_cc1d3b0" />
            </a>,
          ]}
        />
      </p>
    </>
  );
}
