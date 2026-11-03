import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ChevronDown, Maximize, MonitorUp, Play, Radio, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { useEngine, useOrbit } from "../../application/orbit";
import { screenShareSupport } from "../../call/screenShareSupport";
import { frameShape } from "../../call/rules";
import { clampShareQuality, SHARE_QUALITIES, SHARE_QUALITY_ORDER, type ShareQuality } from "../../call/shareQuality";
import { navigate } from "../../application/router";
import type { CallShareView } from "../../call/shares";
import type { CallUiState } from "../../call/types";
import { Avatar } from "../components/Avatar";
import { Dialog, Menu, useMenu } from "../components/Overlay";
import { Toggle } from "../components/Toggle";
interface ScreenViewProps {
  share: CallShareView;
  stats: CallUiState["watchStats"];
  onShape: (shape: "portrait" | "landscape" | null) => void;
}
/**
 * The share being watched, always whole (contain, never cropped like a camera tile), at its own proportions; it can go
 * full screen. Its shape follows the frames, so a phone turned mid-share re-lays the call. Below it, what arrives here.
 */
export function ScreenView({ share, stats, onShape }: ScreenViewProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const figure = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const epoch = useOrbit((s) => s.call.mediaEpoch);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el || !share.ready) return;
    const resized = () => onShape(frameShape(el.videoWidth, el.videoHeight));
    el.addEventListener("resize", resized);
    el.addEventListener("loadedmetadata", resized);
    const detach = engine.calls.attachShare(share.key, el);
    let active = true;
    const playing = () => setPlaybackBlocked(false);
    el.addEventListener("playing", playing);
    void el.play().catch(() => {
      if (active) setPlaybackBlocked(true);
    });
    return () => {
      active = false;
      el.removeEventListener("playing", playing);
      el.removeEventListener("resize", resized);
      el.removeEventListener("loadedmetadata", resized);
      detach();
      onShape(null);
    };
  }, [engine, share.key, share.ready, epoch, onShape]);
  const fullScreen = () => {
    const el = figure.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };
  return (
    <figure ref={figure} className="call-screen" aria-label={uiText("calls.interface.value0_s_screen_b2891fb", { value0: share.name })} style={{ margin: 0 }} data-share-key={share.key}>
      <video ref={video} autoPlay playsInline muted aria-hidden="true" />
      {!share.ready && (
        <p className="call-screen-wait">
          <Localized k="calls.interface.waiting_for_s_screen_96c871b" slots={[share.name]} />
        </p>
      )}
      <span className="live-badge" aria-hidden="true">
        {l10n("calls.live_sharing_short")}
      </span>
      <figcaption className="who">
        <Localized
          k="calls.interface.is_sharing_their_screen_ddf55db"
          slots={[
            <MonitorUp size={13} aria-hidden="true" />,
            share.name,
            stats && (
              <span className="call-screen-stats" data-testid="watch-stats">
                <Localized k="calls.interface.fps_9cca34f" slots={[stats.width, stats.height, stats.fps]} />
              </span>
            ),
          ]}
        />
      </figcaption>
      <div className="call-screen-actions">
        {share.ready && playbackBlocked && (
          <button className="btn btn-primary btn-sm" onClick={() => void video.current?.play().catch(() => setPlaybackBlocked(true))}>
            <Localized k="calls.interface.play_shared_screen_5f17c20" slots={[<Play size={17} aria-hidden="true" />]} />
          </button>
        )}
        <button
          className="icon-btn"
          onClick={() => engine.calls.watchShare(null)}
          aria-label={uiText("calls.interface.stop_watching_and_show_the_people_cc25f69")}
          title={uiText("calls.interface.show_the_people_32e64cc")}
        >
          <Users size={17} />
        </button>
        {typeof document !== "undefined" && document.fullscreenEnabled && (
          <button className="icon-btn" onClick={fullScreen} aria-label={uiText("calls.interface.show_the_shared_screen_full_screen_c87305a")} title={uiText("calls.interface.full_screen_674fe2a")}>
            <Maximize size={17} />
          </button>
        )}
      </div>
    </figure>
  );
}
/**
 * Every screen shared in the call (like Discord's streams): who, live, and Watch or Watching. Picking one changes only
 * what this browser shows and receives; a new share never takes over the one being watched.
 */
export function StreamTray({ call }: { call: CallUiState }) {
  useLocaleRender();
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  if (!call.shares.length) return null;
  return (
    <section className="call-streams" aria-label={uiText("calls.interface.screens_being_shared_bde2b46")}>
      <ul>
        {call.shares.map((s) => {
          const watching = call.watching === s.key;
          return (
            <li key={s.key} className={`call-stream${watching ? " watching" : ""}`} data-share-key={s.key}>
              <Avatar name={s.name} colorIndex={users[s.userId]?.avatarColor ?? 0} size={22} decorative />
              <span className="ellipsis grow">{s.isLocal ? uiText("calls.interface.your_screen_5701154") : s.name}</span>
              <span className="live-badge">
                <Localized k="calls.interface.live_d20cec7" slots={[<Radio size={11} aria-hidden="true" />]} />
              </span>
              {!s.isLocal && (
                <button
                  className={`btn btn-sm ${watching ? "btn-secondary" : "btn-primary"}`}
                  aria-pressed={watching}
                  aria-label={watching ? uiText("calls.interface.watching_value0_s_screen_a886fdb", { value0: s.name }) : uiText("calls.interface.watch_value0_s_screen_aff1e5c", { value0: s.name })}
                  onClick={() => engine.calls.watchShare(watching ? null : s.key)}
                >
                  {watching ? uiText("calls.interface.watching_fbc5940") : uiText("calls.interface.watch_a71e757")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
/** "Sharing · High · 1920×1080 · 60 fps": what this browser sends now; it opens the quality choice. */
export function SharePill({ call }: { call: CallUiState }) {
  useLocaleRender();
  const engine = useEngine();
  const menu = useMenu();
  if (!call.screenSharing || !call.shareQuality) return null;
  const q = SHARE_QUALITIES[call.shareQuality];
  const sent = call.shareStats?.sent;
  const choose = (quality: ShareQuality) => {
    setPrefs({ shareQuality: quality });
    void engine.calls.setShareQuality(quality);
  };
  return (
    <>
      <button className="call-pill quiet" onClick={(e) => menu.open(e.currentTarget)} aria-haspopup="menu" data-testid="share-pill">
        <Localized
          k="calls.interface.sharing_ad8683a"
          slots={[
            q.label,
            sent ? uiText("calls.interface.value0_value1_value2_fps_774d206", { value0: sent.width, value1: sent.height, value2: sent.fps }) : "",
            call.shareAudio ? uiText("calls.interface.with_sound_aa5e00f") : "",
            <ChevronDown size={13} aria-hidden="true" />,
          ]}
        />
      </button>
      {menu.anchor && (
        <Menu
          anchor={menu.anchor}
          label={uiText("calls.interface.screen_share_quality_a5cfda1")}
          onClose={menu.close}
          entries={[
            {
              get heading() {
                return uiText("calls.interface.quality_1b2c08a");
              },
            },
            ...call.shareQualities.map((k) => ({
              label: `${SHARE_QUALITIES[k].label} · ${SHARE_QUALITIES[k].height}p${SHARE_QUALITIES[k].frameRate}`,
              checked: k === call.shareQuality,
              onSelect: () => choose(k),
            })),
          ]}
        />
      )}
    </>
  );
}
/**
 * Share your screen: the warning, then Standard (720p30) or High (1080p60), and the shared tab's or screen's sound where
 * the browser offers it. The last choice is the default next time; then the browser asks which screen, window or tab.
 */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const prefs = usePrefs();
  // Only the qualities this person may share at here (Meldiq Plus: their plan and the community's Sparks).
  const allowed = useOrbit((s) => s.call.shareQualities);
  const [quality, setQuality] = useState<ShareQuality>(() => clampShareQuality(prefs.shareQuality, allowed));
  const more = allowed.length < SHARE_QUALITY_ORDER.length && allowed[allowed.length - 1] !== "max60";
  const [audio, setAudio] = useState(prefs.shareAudio);
  const support = screenShareSupport();
  const share = () => {
    if (!screenShareSupport().ok) return;
    setPrefs({ shareQuality: quality, shareAudio: audio });
    onClose();
    void engine.calls.toggleScreenShare({ quality, audio });
  };
  if (!support.ok)
    return (
      <Dialog title={uiText("calls.ariaShare")} onClose={onClose}>
        <div className="dialog-body">
          <p role="status">{support.reason}</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={onClose}>
              <Localized k="calls.interface.got_it_5ad3dbd" />
            </button>
          </div>
        </div>
      </Dialog>
    );
  return (
    <Dialog title={uiText("calls.ariaShare")} onClose={onClose}>
      <div className="dialog-body">
        <div className="banner warn">
          <Localized k="calls.interface.everyone_in_the_call_sees_what_you_share_including_notifications_6cda4e2" />
        </div>
        <div role="radiogroup" aria-label={uiText("calls.interface.quality_1b2c08a")} style={{ display: "grid", gap: 2 }}>
          {allowed.map((k) => (
            <button key={k} role="radio" aria-checked={quality === k} className="list-row" onClick={() => setQuality(k)}>
              <span className="lines">
                <span style={{ fontWeight: 600 }}>{SHARE_QUALITIES[k].label}</span>
                <small>{SHARE_QUALITIES[k].hint}</small>
              </span>
            </button>
          ))}
        </div>
        {more && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            <Localized k="calls.interface.higher_quality_comes_with_meldiq_plus_or_when_this_community_has_1105004" />
            <button
              className="char-limit-link"
              onClick={() => {
                onClose();
                navigate({ section: "settings", settingsPage: "mojo" });
              }}
            >
              <Localized k="calls.interface.see_meldiq_plus_408c6d5" />
            </button>
          </p>
        )}
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="calls.interface.include_sound_f7fe8d6" />
            </strong>
            <small>
              <Localized k="calls.interface.the_shared_tab_s_or_screen_s_sound_as_its_own_track_where_this_br_feb6b44" />
            </small>
          </span>
          <Toggle checked={audio} onChange={setAudio} label={uiText("calls.interface.include_sound_f7fe8d6")} />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" onClick={share}>
            <Localized k="calls.interface.share_cadec86" slots={[<MonitorUp size={15} />]} />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
