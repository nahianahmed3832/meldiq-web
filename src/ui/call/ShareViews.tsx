import { ChevronDown, Maximize, MonitorUp, Radio, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { useEngine, useOrbit } from "../../application/orbit";
import { frameShape } from "../../call/rules";
import { SHARE_QUALITIES, type ShareQuality } from "../../call/shareQuality";
import type { CallShareView } from "../../call/shares";
import type { CallUiState } from "../../call/types";
import { Avatar } from "../components/Avatar";
import { Dialog, Menu, useMenu } from "../components/Overlay";
import { Toggle } from "../components/Toggle";

const QUALITIES: readonly ShareQuality[] = ["standard", "high"];

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
  const engine = useEngine();
  const figure = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const epoch = useOrbit((s) => s.call.mediaEpoch);
  useEffect(() => {
    const el = video.current;
    if (!el || !share.ready) return;
    const resized = () => onShape(frameShape(el.videoWidth, el.videoHeight));
    el.addEventListener("resize", resized);
    el.addEventListener("loadedmetadata", resized);
    const detach = engine.calls.attachShare(share.key, el);
    return () => {
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
    <figure ref={figure} className="call-screen" aria-label={`${share.name}'s screen`} style={{ margin: 0 }} data-share-key={share.key}>
      <video ref={video} autoPlay playsInline muted aria-hidden="true" />
      {!share.ready && <p className="call-screen-wait">Waiting for {share.name}'s screen…</p>}
      <figcaption className="who">
        <MonitorUp size={13} aria-hidden="true" /> {share.name} is sharing their screen
        {stats && (
          <span className="call-screen-stats" data-testid="watch-stats">
            {" "}
            · {stats.width}×{stats.height} · {stats.fps} fps
          </span>
        )}
      </figcaption>
      <div className="call-screen-actions">
        <button className="icon-btn" onClick={() => engine.calls.watchShare(null)} aria-label="Stop watching and show the people" title="Show the people">
          <Users size={17} />
        </button>
        {typeof document !== "undefined" && document.fullscreenEnabled && (
          <button className="icon-btn" onClick={fullScreen} aria-label="Show the shared screen full screen" title="Full screen">
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
  const engine = useEngine();
  const users = useOrbit((s) => s.users);
  if (!call.shares.length) return null;
  return (
    <section className="call-streams" aria-label="Screens being shared">
      <ul>
        {call.shares.map((s) => {
          const watching = call.watching === s.key;
          return (
            <li key={s.key} className={`call-stream${watching ? " watching" : ""}`} data-share-key={s.key}>
              <Avatar name={s.name} colorIndex={users[s.userId]?.avatarColor ?? 0} size={22} decorative />
              <span className="ellipsis grow">{s.isLocal ? "Your screen" : s.name}</span>
              <span className="live-badge">
                <Radio size={11} aria-hidden="true" /> Live
              </span>
              {!s.isLocal && (
                <button
                  className={`btn btn-sm ${watching ? "btn-secondary" : "btn-primary"}`}
                  aria-pressed={watching}
                  aria-label={watching ? `Watching ${s.name}'s screen` : `Watch ${s.name}'s screen`}
                  onClick={() => engine.calls.watchShare(watching ? null : s.key)}
                >
                  {watching ? "Watching" : "Watch"}
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
        Sharing · {q.label}
        {sent ? ` · ${sent.width}×${sent.height} · ${sent.fps} fps` : ""}
        {call.shareAudio ? " · with sound" : ""}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {menu.anchor && (
        <Menu
          anchor={menu.anchor}
          label="Screen share quality"
          onClose={menu.close}
          entries={[
            { heading: "Quality" },
            ...QUALITIES.map((k) => ({
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
  const engine = useEngine();
  const prefs = usePrefs();
  const [quality, setQuality] = useState<ShareQuality>(prefs.shareQuality);
  const [audio, setAudio] = useState(prefs.shareAudio);
  const share = () => {
    setPrefs({ shareQuality: quality, shareAudio: audio });
    onClose();
    void engine.calls.toggleScreenShare({ quality, audio });
  };
  return (
    <Dialog title="Share your screen" onClose={onClose}>
      <div className="dialog-body">
        <div className="banner warn">Everyone in the call sees what you share, including notifications that appear on it.</div>
        <div role="radiogroup" aria-label="Quality" style={{ display: "grid", gap: 2 }}>
          {QUALITIES.map((k) => (
            <button key={k} role="radio" aria-checked={quality === k} className="list-row" onClick={() => setQuality(k)}>
              <span className="lines">
                <span style={{ fontWeight: 600 }}>{SHARE_QUALITIES[k].label}</span>
                <small>{SHARE_QUALITIES[k].hint}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="setting">
          <span className="lines">
            <strong>Include sound</strong>
            <small>The shared tab's or screen's sound, as its own track, where this browser offers it (Chrome and Edge). Muting yourself doesn't silence it: stop sharing to stop the sound.</small>
          </span>
          <Toggle checked={audio} onChange={setAudio} label="Include sound" />
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={share}>
            <MonitorUp size={15} /> Share
          </button>
        </div>
      </div>
    </Dialog>
  );
}
