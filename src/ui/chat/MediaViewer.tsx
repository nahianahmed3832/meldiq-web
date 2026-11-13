import { formatUiNumber } from "../../i18n/format";
import { formatDuration } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ChevronLeft, ChevronRight, ExternalLink, Film, ImageDown, Maximize, MoreHorizontal, Pause, Play, Volume2, VolumeX, X, Share2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEngine } from "../../application/orbit";
import type { AttachmentRef } from "../../protocol/payload";
import { isInlineImage, safeMime, saveAttachment } from "../../sync/attachments";
import { dayLabel, clock as timeOfDay } from "../format";
import { Menu, useFocusTrap, useMenu } from "../components/Overlay";
import { useBlobUrl } from "./blobUrl";
import { attachmentName } from "../../sync/attachmentPolicy";
import { copyImage } from "./contextTarget";
import { ZoomableImage } from "./ZoomableImage";
import { usePrefs } from "../../application/prefs";
import { Icon } from "../icons/Icon";
import { useVideoDownload } from "./useVideoDownload";
/**
 * The media viewer (2026-10-28, after the reference the owner sent): photos and videos of a message, full screen. Who
 * sent it and when at the top left; Download, open in a new tab and More at the top right; arrows and a strip of the
 * message's other photos and videos when there are several; a video plays with Meldiq's own controls (play, time,
 * seek, volume, full screen). The text and quick reactions stay under it.
 */
/**
 * The message a photo belongs to, for the viewer (android, 2026-10-23): who sent it, when, its text under the picture,
 * and reacting without leaving ([onReact] null where the person can't react).
 */
export interface ViewerInfo {
  sender: string;
  at: number;
  text: string;
  quick: readonly string[];
  /** The emoji this person already reacted with. */
  reacted: readonly string[];
  onReact: ((emoji: string) => void) | null;
}
export const ViewerInfoContext = createContext<ViewerInfo | null>(null);
/** Opens the viewer at an attachment of the message being drawn (null outside a message: each opens on its own). */
export const OpenViewerContext = createContext<((r: AttachmentRef) => void) | null>(null);
export const isVideo = (r: AttachmentRef): boolean => safeMime(r.mime).startsWith("video/");
/** What the viewer shows: photos and videos (voice and other files have their own players and cards). */
export const isViewable = (r: AttachmentRef): boolean => isInlineImage(r) || isVideo(r);
/** Events the viewer handles itself: React would otherwise bubble them through the portal to the message behind it,
 * whose long press and menu then opened under the photo (reported 2026-10-28). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
export function MediaViewer({ items, at, onMove, onClose }: { items: AttachmentRef[]; at: number; onMove: (i: number) => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const r = items[at];
  const info = useContext(ViewerInfoContext);
  const engine = useEngine();
  const menu = useMenu();
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, true, true);
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  const { url, error, retry, progress } = useBlobUrl(r, true, true);
  const video = isVideo(r);
  const downloaded = useVideoDownload(video ? r.id : null);
  const download = () => {
    void saveAttachment(engine, r).catch((e: unknown) => {
      if (!(e instanceof DOMException && e.name === "AbortError")) engine.notice("error", uiText("messaging.interface.couldn_t_save_this_file_try_again_d658776"));
    });
  };
  const { url: poster } = useBlobUrl(r.thumbnail ?? r, video && !!r.thumbnail && !error);
  const loadingLabel =
    progress?.phase === "decrypting" ? uiText("messaging.interface.decrypting_value0_b77ff2c", { value0: r.name }) : uiText("messaging.interface.loading_value0_e87d0f1", { value0: r.name });
  const prev = at > 0 ? () => onMove(at - 1) : null;
  const next = at < items.length - 1 ? () => onMove(at + 1) : null;
  const count = items.length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement)?.closest("input,textarea,select,[role=menu]")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && at > 0) onMove(at - 1);
      else if (e.key === "ArrowRight" && at < count - 1) onMove(at + 1);
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose, onMove, at, count]);
  const what = video ? uiText("workspace.interface.video_0cab1c9") : uiText("messaging.media.photo");
  const moreEntries = url
    ? [
        {
          label: uiText("messaging.interface.download_value0_0f5a93c", { value0: what }),
          icon: <Icon name="files.download" size={16} />,
          onSelect: download,
        },
        ...(video
          ? []
          : [
              {
                get label() {
                  return uiText("messaging.interface.copy_image_3cb27ae");
                },
                icon: <ImageDown size={16} />,
                onSelect: () =>
                  void copyImage(url).then((ok) =>
                    engine.notice("info", ok ? uiText("messaging.interface.image_copied_7169679") : uiText("messaging.interface.this_browser_can_t_copy_images_download_it_instead_60ae8c2")),
                  ),
              },
            ]),
        ...(typeof navigator.share === "function"
          ? [
              {
                get label() {
                  return uiText("messaging.interface.share_original_48de27e");
                },
                icon: <Share2 size={16} />,
                onSelect: () => {
                  void (async () => {
                    const blob = await (await fetch(url)).blob();
                    const file = new File([blob], attachmentName(r.name), { type: blob.type });
                    if (!navigator.canShare?.({ files: [file] })) throw new Error(uiText("messaging.interface.this_browser_cannot_share_this_file_download_the_original_instead_f8bcb09"));
                    await navigator.share({ files: [file], title: attachmentName(r.name) });
                  })().catch((e: unknown) => {
                    if (!(e instanceof DOMException && e.name === "AbortError"))
                      engine.notice("error", e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_share_this_file_8af1321"));
                  });
                },
              },
            ]
          : []),
        {
          get label() {
            return uiText("messaging.interface.open_in_a_new_tab_306ef19");
          },
          icon: <ExternalLink size={16} />,
          onSelect: () => void window.open(url, "_blank", "noopener"),
        },
      ]
    : [];
  return createPortal(
    <div
      ref={dialog}
      className="lightbox media-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={r.name}
      onClick={(e) => {
        stop(e);
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={stop}
      onPointerUp={stop}
      onPointerMove={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        stop(e);
        e.preventDefault();
        if (url) menu.openAt(e.currentTarget, e);
      }}
    >
      {info && (
        <div className="viewer-who">
          <strong>{info.sender}</strong>
          <small>
            {dayLabel(info.at)} {timeOfDay(info.at)}
          </small>
        </div>
      )}
      <div className="viewer-actions" role="toolbar" aria-label={uiText("messaging.interface.value0_actions_d814e85", { value0: what })}>
        <div className="viewer-group">
          {!downloaded && (
            <button
              className="icon-btn"
              disabled={!url}
              onClick={download}
              aria-label={uiText("messaging.interface.download_value0_0f5a93c", { value0: what })}
              title={l10n("common.actions.download")}
            >
              <Icon name="files.download" size={18} />
            </button>
          )}
          <button
            className="icon-btn"
            disabled={!url}
            onClick={() => url && window.open(url, "_blank", "noopener")}
            aria-label={uiText("messaging.interface.open_in_a_new_tab_306ef19")}
            title={uiText("messaging.interface.open_in_a_new_tab_306ef19")}
          >
            <ExternalLink size={18} />
          </button>
          <button
            className="icon-btn"
            disabled={!url}
            onClick={(e) => menu.open(e.currentTarget)}
            aria-label={uiText("messaging.interface.more_d47d7cb")}
            title={uiText("messaging.interface.more_d47d7cb")}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        <button className="icon-btn viewer-close" onClick={onClose} aria-label={l10n("common.actions.close")} data-autofocus>
          <X size={18} />
        </button>
      </div>
      {count > 1 && (
        <button className="icon-btn viewer-arrow left" onClick={prev ?? undefined} disabled={!prev} aria-label={uiText("messaging.interface.previous_image_f0a859a")}>
          <ChevronLeft size={22} />
        </button>
      )}
      {count > 1 && (
        <button className="icon-btn viewer-arrow right" onClick={next ?? undefined} disabled={!next} aria-label={uiText("messaging.interface.next_image_a4903f7")}>
          <ChevronRight size={22} />
        </button>
      )}
      <div className="viewer-stage">
        {error ? (
          <div className="viewer-error" role="alert">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={retry}>
              {l10n("common.actions.retry")}
            </button>
          </div>
        ) : !url ? (
          <div className="viewer-loading">
            {poster && <img src={poster} alt="" />}
            <div className="viewer-loading-status">
              <span role="status">{loadingLabel}</span>
              <progress max={progress?.total || 1} value={progress?.done} aria-label={loadingLabel} />
            </div>
          </div>
        ) : video ? (
          <VideoPlayer key={url} url={url} name={r.name} poster={poster ?? undefined} />
        ) : (
          <ZoomableImage key={url} url={url} name={r.name} retry={retry} />
        )}
      </div>
      <div className="viewer-foot">
        <span className="viewer-position" aria-live="polite">
          {formatUiNumber(at + 1)} / {formatUiNumber(count)} <span aria-hidden="true">·</span> {r.name}
        </span>
        {info && <ViewerCaption info={info} />}
        {items.length > 1 && (
          <div className="viewer-strip" role="group" aria-label={uiText("messaging.interface.value0_photos_and_videos_59e3559", { value0: items.length })}>
            {items.slice(Math.max(0, at - 3), Math.min(count, at + 4)).map((it, offset) => {
              const i = Math.max(0, at - 3) + offset;
              return <StripThumb key={it.id} r={it} current={i === at} onPick={() => onMove(i)} />;
            })}
          </div>
        )}
      </div>
      {menu.anchor && url && <Menu anchor={menu.anchor} point={menu.point} align="end" label={r.name} onClose={menu.close} entries={moreEntries} />}
    </div>,
    document.body,
  );
}
function StripThumb({ r, current, onPick }: { r: AttachmentRef; current: boolean; onPick: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const image = isInlineImage(r);
  const { autoLoadPhotos } = usePrefs();
  const { url } = useBlobUrl(r.thumbnail ?? r, (current || autoLoadPhotos) && (!!r.thumbnail || (image && r.size <= 10 * 1024 * 1024)));
  return (
    <button
      className="viewer-thumb"
      aria-current={current}
      onClick={onPick}
      aria-label={uiText("billing.interface.value0_value1_6a77681", { value0: image ? uiText("messaging.interface.photo_d84eeba") : l10n("files.video"), value1: r.name })}
    >
      {url ? <img src={url} alt="" /> : <Film size={18} aria-hidden="true" />}
    </button>
  );
}
function ViewerCaption({ info }: { info: ViewerInfo }) {
  useLocaleRender();
  if (!info.text && !info.onReact) return null;
  return (
    <div className="lightbox-caption">
      {info.text && <p className="clamp-3">{info.text}</p>}
      {info.onReact && (
        <div className="lightbox-react" role="group" aria-label={uiText("messaging.interface.react_01fad99")}>
          {info.quick.map((e) => (
            <button
              key={e}
              className="icon-btn quick-emoji"
              aria-pressed={info.reacted.includes(e)}
              aria-label={uiText("messaging.interface.react_value0_e09da0a", { value0: e })}
              onClick={() => info.onReact?.(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const mmss = (s: number) => formatDuration((Number.isFinite(s) ? s : 0) * 1000);
/** A video with Meldiq's controls: play/pause (or a click on the picture, or Space), time, seek, mute and volume, full screen. */
export function VideoPlayer({ url, name, poster }: { url: string; name: string; poster?: string }) {
  useLocaleRender();
  const l10n = useLocalization();
  const box = useRef<HTMLDivElement>(null);
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackError, setPlaybackError] = useState(false);
  const toggle = useCallback(() => {
    const el = v.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === " " && !(e.target as HTMLElement)?.closest?.("input, textarea, button")) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [toggle]);
  return (
    <div className="video-player" ref={box}>
      <video
        ref={v}
        src={url}
        poster={poster}
        autoPlay
        playsInline
        aria-label={name}
        onError={() => setPlaybackError(true)}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
      />
      {playbackError && (
        <p className="viewer-error" role="alert">
          <Localized k="messaging.interface.this_browser_cannot_play_this_video_s_codec_download_the_original_a46c399" />
        </p>
      )}
      <div className="video-controls">
        <button className="icon-btn" onClick={toggle} aria-label={playing ? uiText("messaging.interface.pause_858e4ba") : uiText("messaging.interface.play_436e610")}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="video-time">
          {mmss(time)} / {mmss(length)}
        </span>
        <input
          type="range"
          className="video-seek"
          min={0}
          max={length || 0}
          step={0.1}
          value={Math.min(time, length || 0)}
          aria-label={uiText("messaging.interface.position_6d031af")}
          aria-valuetext={uiText("workspace.interface.value0_of_value1_ca6c5e5", { value0: mmss(time), value1: mmss(length) })}
          onChange={(e) => {
            if (v.current) v.current.currentTime = Number(e.target.value);
          }}
          style={{ ["--done" as string]: `${length ? (time / length) * 100 : 0}%` }}
        />
        <button className="icon-btn" onClick={() => v.current && (v.current.muted = !v.current.muted)} aria-label={muted ? l10n("notifications.bell_unmute") : l10n("notifications.bell_mute")}>
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          className="video-volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label={l10n("settings.nt_volume")}
          onChange={(e) => {
            if (!v.current) return;
            v.current.volume = Number(e.target.value);
            v.current.muted = Number(e.target.value) === 0;
          }}
        />
        <button
          className="icon-btn"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else if (box.current?.requestFullscreen)
              void box.current.requestFullscreen().catch(() =>
                (
                  v.current as HTMLVideoElement & {
                    webkitEnterFullscreen?: () => void;
                  }
                )?.webkitEnterFullscreen?.(),
              );
            else
              (
                v.current as HTMLVideoElement & {
                  webkitEnterFullscreen?: () => void;
                }
              )?.webkitEnterFullscreen?.();
          }}
          aria-label={uiText("calls.interface.full_screen_674fe2a")}
        >
          <Maximize size={17} />
        </button>
      </div>
    </div>
  );
}
