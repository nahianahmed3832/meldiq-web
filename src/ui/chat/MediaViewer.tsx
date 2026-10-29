import { ChevronLeft, ChevronRight, Download, ExternalLink, Film, ImageDown, Maximize, MoreHorizontal, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEngine } from "../../application/orbit";
import type { AttachmentRef } from "../../protocol/payload";
import { isInlineImage, safeMime } from "../../sync/attachments";
import { dayLabel, clock as timeOfDay } from "../format";
import { Menu, useMenu } from "../components/Overlay";
import { useBlobUrl } from "./blobUrl";
import { copyImage, downloadUrl } from "./contextTarget";

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
  const r = items[at];
  const info = useContext(ViewerInfoContext);
  const engine = useEngine();
  const menu = useMenu();
  const { url, error } = useBlobUrl(r, true);
  const video = isVideo(r);
  const prev = at > 0 ? () => onMove(at - 1) : null;
  const next = at < items.length - 1 ? () => onMove(at + 1) : null;
  const count = items.length;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && at > 0) onMove(at - 1);
      else if (e.key === "ArrowRight" && at < count - 1) onMove(at + 1);
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose, onMove, at, count]);
  const what = video ? "video" : "photo";
  const moreEntries = url
    ? [
        { label: `Download ${what}`, icon: <Download size={16} />, onSelect: () => downloadUrl(url, r.name) },
        ...(video
          ? []
          : [
              {
                label: "Copy image",
                icon: <ImageDown size={16} />,
                onSelect: () => void copyImage(url).then((ok) => engine.notice("info", ok ? "Image copied." : "This browser can't copy images. Download it instead.")),
              },
            ]),
        { label: "Open in a new tab", icon: <ExternalLink size={16} />, onSelect: () => void window.open(url, "_blank", "noopener") },
      ]
    : [];
  return createPortal(
    <div
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
      <div className="viewer-actions" role="toolbar" aria-label={`${what} actions`}>
        <div className="viewer-group">
          <button className="icon-btn" disabled={!url} onClick={() => url && downloadUrl(url, r.name)} aria-label={`Download ${what}`} title="Download">
            <Download size={18} />
          </button>
          <button className="icon-btn" disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener")} aria-label="Open in a new tab" title="Open in a new tab">
            <ExternalLink size={18} />
          </button>
          <button className="icon-btn" disabled={!url} onClick={(e) => menu.open(e.currentTarget)} aria-label="More" title="More" aria-haspopup="menu">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <button className="icon-btn viewer-close" onClick={onClose} aria-label="Close" autoFocus>
          <X size={18} />
        </button>
      </div>
      {prev && (
        <button className="icon-btn viewer-arrow left" onClick={prev} aria-label={`Previous (${at} of ${items.length})`}>
          <ChevronLeft size={22} />
        </button>
      )}
      {next && (
        <button className="icon-btn viewer-arrow right" onClick={next} aria-label={`Next (${at + 2} of ${items.length})`}>
          <ChevronRight size={22} />
        </button>
      )}
      <div className="viewer-stage">
        {error ? (
          <p className="viewer-error">{error}</p>
        ) : !url ? (
          <span className="spinner" aria-label={`Decrypting ${r.name}`} />
        ) : video ? (
          <VideoPlayer key={url} url={url} name={r.name} />
        ) : (
          <img src={url} alt={r.name} />
        )}
      </div>
      <div className="viewer-foot">
        {info && <ViewerCaption info={info} />}
        {items.length > 1 && (
          <div className="viewer-strip" role="group" aria-label={`${items.length} photos and videos`}>
            {items.map((it, i) => (
              <StripThumb key={it.id} r={it} current={i === at} onPick={() => onMove(i)} />
            ))}
          </div>
        )}
      </div>
      {menu.anchor && url && <Menu anchor={menu.anchor} point={menu.point} align="end" label={r.name} onClose={menu.close} entries={moreEntries} />}
    </div>,
    document.body,
  );
}

function StripThumb({ r, current, onPick }: { r: AttachmentRef; current: boolean; onPick: () => void }) {
  const image = isInlineImage(r);
  const { url } = useBlobUrl(r, image);
  return (
    <button className="viewer-thumb" aria-current={current} onClick={onPick} aria-label={`${image ? "Photo" : "Video"}: ${r.name}`}>
      {image && url ? <img src={url} alt="" /> : <Film size={18} aria-hidden="true" />}
    </button>
  );
}

function ViewerCaption({ info }: { info: ViewerInfo }) {
  if (!info.text && !info.onReact) return null;
  return (
    <div className="lightbox-caption">
      {info.text && <p className="clamp-3">{info.text}</p>}
      {info.onReact && (
        <div className="lightbox-react" role="group" aria-label="React">
          {info.quick.map((e) => (
            <button key={e} className="icon-btn quick-emoji" aria-pressed={info.reacted.includes(e)} aria-label={`React ${e}`} onClick={() => info.onReact?.(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const mmss = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** A video with Meldiq's controls: play/pause (or a click on the picture, or Space), time, seek, mute and volume, full screen. */
export function VideoPlayer({ url, name }: { url: string; name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const v = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
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
        autoPlay
        playsInline
        aria-label={name}
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
      <div className="video-controls">
        <button className="icon-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
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
          aria-label="Position"
          aria-valuetext={`${mmss(time)} of ${mmss(length)}`}
          onChange={(e) => {
            if (v.current) v.current.currentTime = Number(e.target.value);
          }}
          style={{ ["--done" as string]: `${length ? (time / length) * 100 : 0}%` }}
        />
        <button className="icon-btn" onClick={() => v.current && (v.current.muted = !v.current.muted)} aria-label={muted ? "Unmute" : "Mute"}>
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          className="video-volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label="Volume"
          onChange={(e) => {
            if (!v.current) return;
            v.current.volume = Number(e.target.value);
            v.current.muted = Number(e.target.value) === 0;
          }}
        />
        <button
          className="icon-btn"
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void box.current?.requestFullscreen?.().catch(() => undefined))}
          aria-label="Full screen"
        >
          <Maximize size={17} />
        </button>
      </div>
    </div>
  );
}
