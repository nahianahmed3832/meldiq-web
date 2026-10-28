import { VibesCard } from "./AppearanceExtras";
import { fileLimit, MAX_FILES_PER_MESSAGE } from "../../sync/attachments";
import { APP_VERSION } from "../../application/env";
import { serverHost } from "../../application/config";
import { useState } from "react";
import { useOrbit } from "../../application/orbit";
import {
  LIST_PREVIEWS,
  MESSAGE_LAYOUTS,
  type Palette,
  PALETTES,
  type Prefs,
  QUICK_REACTIONS,
  setPrefs,
  TEXT_SIZES,
  type TextSize,
  THEMES,
  TIME_FORMATS,
  UPLOAD_QUALITIES,
  usePrefs,
  volumeOf,
} from "../../application/prefs";
import { bytes } from "../format";
import { Toggle } from "../components/Toggle";
import { IntroPages } from "../auth/IntroPages";
import { BackgroundNotifications } from "./BackgroundNotifications";
import { type ChimeState, chimeState, playChime, unlockChime } from "../../application/messageChime";
import { type StringKey, useT } from "../../i18n";
import { InstallSetting } from "./InstallButton";
import { LanguagePicker } from "../components/LanguagePicker";

const THEME_KEY = { system: "ap_system", light: "ap_light", dark: "ap_dark", black: "ap_black" } as const satisfies Record<Prefs["theme"], StringKey>;
const PALETTE_KEY = { meldiq: "ap_meldiq", midnight: "ap_midnight", charcoal: "ap_charcoal", indigo: "ap_indigo", plum: "ap_plum", amber: "ap_amber" } as const satisfies Record<Palette, StringKey>;
const SIZE_KEY = { small: "ap_small", default: "ap_default", large: "ap_large" } as const satisfies Record<TextSize, StringKey>;
const QUALITY_KEY = { standard: "ap_standard", hd: "ap_hd", original: "ap_original" } as const satisfies Record<"standard" | "hd" | "original", StringKey>;

export function NotificationsPage() {
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
      <h1 style={{ fontSize: 17, marginTop: 8 }}>{t("nt_conversations")}</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_receipts")}</strong>
            <small>{t("nt_receipts_sub")}</small>
          </div>
          <Toggle label={t("nt_receipts")} checked={prefs.readReceipts} onChange={(v) => setPrefs({ readReceipts: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>{t("nt_typing")}</strong>
            <small>{t("nt_typing_sub")}</small>
          </div>
          <Toggle label={t("nt_typing")} checked={prefs.typing} onChange={(v) => setPrefs({ typing: v })} />
        </div>
      </div>
    </>
  );
}

/** The chime in this tab (application/messageChime.ts): on or off, its volume, and a test that also unlocks sound. */
function InAppSoundSettings() {
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
                ? "Played. If you heard nothing, check this site isn't muted in the browser tab and the computer's volume."
                : "The browser blocked sound. Allow sound for this site in the browser's site settings, then try again."}
            </small>
          )}
        </div>
      )}
    </>
  );
}

export function AppearancePage() {
  const prefs = usePrefs();
  const t = useT();
  return (
    <>
      <h1>{t("settings_appearance")}</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>{t("lang_label")}</strong>
            <small>{t("lang_note")}</small>
          </div>
          <LanguagePicker />
        </div>
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
            <strong>{t("ap_text_size")}</strong>
            <small>{t("ap_text_size_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_text_size")}>
            {TEXT_SIZES.map((ts) => (
              <button key={ts} aria-pressed={prefs.textSize === ts} onClick={() => setPrefs({ textSize: ts })}>
                {t(SIZE_KEY[ts])}
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
            <strong>{t("ap_animoji")}</strong>
            <small>{t("ap_animoji_sub")}</small>
          </div>
          <Toggle label={t("ap_animoji")} checked={prefs.animatedEmoji} onChange={(v) => setPrefs({ animatedEmoji: v })} />
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
            <strong>{t("ap_quality")}</strong>
            <small>{t("ap_quality_sub")}</small>
          </div>
          <div className="segmented" role="group" aria-label={t("ap_quality")}>
            {UPLOAD_QUALITIES.map((q) => (
              <button key={q} aria-pressed={prefs.uploadQuality === q} onClick={() => setPrefs({ uploadQuality: q })}>
                {t(QUALITY_KEY[q])}
              </button>
            ))}
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
            <strong>{t("ap_links")}</strong>
            <small>{t("ap_links_sub")}</small>
          </div>
          <Toggle label={t("ap_links")} checked={prefs.askBeforeLinks} onChange={(v) => setPrefs({ askBeforeLinks: v })} />
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
  const server = useOrbit((s) => s.server);
  const me = useOrbit((s) => s.me);
  const [intro, setIntro] = useState(false);
  return (
    <>
      <h1>About</h1>
      {intro && <IntroPages onDone={() => setIntro(false)} />}
      <p className="faint" style={{ margin: "0 0 12px" }}>
        Meldiq Web by GriipBuddy · version {APP_VERSION}
      </p>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Introduction</strong>
            <small>The short tour of what Meldiq does, shown before you first signed in.</small>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setIntro(true)}>
            Show
          </button>
        </div>
        <InstallSetting />
        <div className="setting">
          <div className="lines">
            <strong>Server</strong>
            <small>
              {serverHost()}
              {server ? ` · ${server.instanceName ?? "Meldiq"} ${server.version} · client API ${server.api}` : ""}
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>This browser</strong>
            <small>{me?.deviceName}</small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Files</strong>
            <small>
              Up to {bytes(fileLimit(server))} per file, {MAX_FILES_PER_MESSAGE} files per message. Files are kept 7 days on the server unless saved with history.
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Calls</strong>
            <small>
              {server?.calling
                ? "Voice and video calls work in this browser and in Meldiq on your phone. Call media is end-to-end encrypted with a new key for every call; the browser asks before it uses your microphone or camera."
                : "This server has no calling configured."}
            </small>
          </div>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12.5 }}>
        Meldiq Web 0.1.0 · Plus Jakarta Sans is used under the SIL Open Font License (<a href="/fonts/OFL.txt">license</a>).
      </p>
    </>
  );
}
