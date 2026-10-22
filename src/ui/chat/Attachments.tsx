import { ChevronLeft, ChevronRight, Download, FileText, Film, Image as ImageIcon, Mic, Pause, Play, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEngine } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import type { AttachmentRef } from "../../protocol/payload";
import { isInlineImage, openAttachment, safeMime, saveAttachment } from "../../sync/attachments";
import { clock, isVoice, shownDuration } from "../../sync/voice";
import { bytes } from "../format";
import { albumOverflow, albumRows } from "./album";

/**
 * Decrypts on demand. Images show inline; voice messages play in place (android VoiceViews); audio and video play inline
 * once opened (a click, so nothing large downloads unasked); anything else is a file card that downloads.
 */
export function Attachments({ refs }: { refs: AttachmentRef[] }) {
  if (!refs.length) return null;
  // Several photos sent together are an album (android AlbumGrid); everything else is listed under it.
  const images = refs.filter((r) => !isVoice(r) && isInlineImage(r));
  const album = images.length >= 2 ? images : [];
  const rest = album.length ? refs.filter((r) => !album.includes(r)) : refs;
  return (
    <div className="attachments">
      {album.length > 0 && <AlbumGrid items={album} />}
      {rest.map((r) =>
        isVoice(r) ? (
          <VoiceAttachment key={r.id} r={r} />
        ) : isInlineImage(r) ? (
          <ImageAttachment key={r.id} r={r} />
        ) : isPlayable(r) ? (
          <MediaAttachment key={r.id} r={r} />
        ) : (
          <FileAttachment key={r.id} r={r} />
        ),
      )}
    </div>
  );
}

const isPlayable = (r: AttachmentRef): boolean => /^(audio|video)\//.test(safeMime(r.mime));

/** A voice message: play/pause, a seek bar and its length; the first play downloads and decrypts it. */
function VoiceAttachment({ r }: { r: AttachmentRef }) {
  const [wanted, setWanted] = useState(false);
  const { url, error, loading } = useBlobUrl(r, wanted);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = shownDuration(r.durationMs);
  useEffect(() => {
    if (url && wanted) void audio.current?.play().catch(() => setPlaying(false));
  }, [url, wanted]);
  if (error) return <FileAttachment r={r} error={error} />;
  const seconds = Math.round(total / 1000);
  return (
    <div className="voice-msg" role="group" aria-label={`Voice message, ${seconds} seconds`}>
      <button
        className="voice-play"
        aria-label={playing ? "Pause voice message" : `Play voice message, ${seconds} seconds`}
        onClick={() => {
          if (!url) return setWanted(true);
          if (playing) audio.current?.pause();
          else void audio.current?.play();
        }}
        disabled={loading && wanted}
      >
        {loading && wanted ? <span className="spinner" aria-hidden="true" /> : playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <input
        type="range"
        className="voice-seek"
        min={0}
        max={Math.max(1, total)}
        value={pos}
        aria-label="Position"
        aria-valuetext={`${Math.round(pos / 1000)} seconds of ${seconds} seconds`}
        disabled={!url}
        onChange={(e) => {
          const v = Number(e.target.value);
          setPos(v);
          if (audio.current) audio.current.currentTime = v / 1000;
        }}
      />
      <span className="voice-len">{playing || pos > 0 ? `${clock(pos)} / ${clock(total)}` : clock(total)}</span>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setPos(0);
          }}
          onTimeUpdate={(e) => setPos(Math.round(e.currentTarget.currentTime * 1000))}
        />
      )}
    </div>
  );
}

/** Audio and video files: a card until opened, then the browser's player (decrypted in memory, never a page). */
export function MediaAttachment({ r }: { r: AttachmentRef }) {
  const [open, setOpen] = useState(false);
  const { url, error, loading } = useBlobUrl(r, open);
  if (error) return <FileAttachment r={r} error={error} />;
  const video = safeMime(r.mime).startsWith("video/");
  if (!open || loading || !url) {
    return (
      <button className="att-file" onClick={() => setOpen(true)} aria-label={`Play ${r.name}, ${bytes(r.size)}`} disabled={open}>
        <span className="file-icon">{video ? <Film size={18} /> : <Play size={18} />}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
            {r.name}
          </span>
          <small>{open ? "Decrypting…" : `${bytes(r.size)} · end-to-end encrypted · play here`}</small>
        </span>
      </button>
    );
  }
  return video ? <video className="att-video" src={url} controls autoPlay playsInline aria-label={r.name} /> : <audio className="att-audio" src={url} controls autoPlay aria-label={r.name} />;
}

function useBlobUrl(r: AttachmentRef, enabled: boolean): { url: string | null; error: string | null; loading: boolean } {
  const engine = useEngine();
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>({ url: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    let url: string | null = null;
    let alive = true;
    setState({ url: null, error: null, loading: true });
    openAttachment(engine, r)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ url, error: null, loading: false });
      })
      .catch((e: unknown) => alive && setState({ url: null, error: e instanceof Error ? e.message : "Couldn't open this file.", loading: false }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [engine, r, enabled]);
  return state;
}

export function ImageAttachment({ r }: { r: AttachmentRef }) {
  // Download photos automatically off (android Settings › Chats): each photo waits for a click.
  const { autoLoadPhotos } = usePrefs();
  const [asked, setAsked] = useState(false);
  const { url, error, loading } = useBlobUrl(r, autoLoadPhotos || asked);
  const [open, setOpen] = useState(false);
  if (error) return <FileAttachment r={r} error={error} />;
  if (!autoLoadPhotos && !asked)
    return (
      <button className="att-file" onClick={() => setAsked(true)} aria-label={`Load photo ${r.name}, ${bytes(r.size)}`}>
        <span className="file-icon">
          <ImageIcon size={18} />
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
            Photo
          </span>
          <small>{bytes(r.size)} · end-to-end encrypted · click to load</small>
        </span>
      </button>
    );
  if (loading || !url) return <div className="att-image att-pending skeleton" aria-label={`Loading ${r.name}`} />;
  return (
    <>
      <button className="att-image" onClick={() => setOpen(true)} aria-label={`Open image ${r.name}`}>
        <img src={url} alt={r.name} loading="lazy" />
      </button>
      {open && <Lightbox url={url} name={r.name} onClose={() => setOpen(false)} />}
    </>
  );
}

interface Steps {
  position: string;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}

function Lightbox({ url, name, onClose, steps }: { url: string | null; name: string; onClose: () => void; steps?: Steps }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") steps?.onPrev?.();
      else if (e.key === "ArrowRight") steps?.onNext?.();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose, steps]);
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bar">
        {steps && (
          <>
            <button className="icon-btn" onClick={() => steps.onPrev?.()} disabled={!steps.onPrev} aria-label="Previous photo">
              <ChevronLeft size={18} />
            </button>
            <span className="lightbox-pos">{steps.position}</span>
            <button className="icon-btn" onClick={() => steps.onNext?.()} disabled={!steps.onNext} aria-label="Next photo">
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {url && (
          <a className="icon-btn" href={url} download={name} aria-label="Download">
            <Download size={18} />
          </a>
        )}
        <button className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
          <X size={18} />
        </button>
      </div>
      {url ? <img src={url} alt={name} /> : <span className="spinner" aria-label={`Decrypting ${name}`} />}
    </div>,
    document.body,
  );
}

/** Several photos sent together: up to four tiles, the last saying how many more; each opens a viewer that steps through all. */
function AlbumGrid({ items }: { items: AttachmentRef[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const more = albumOverflow(items.length);
  return (
    <div className="album" role="group" aria-label={`${items.length} photos`}>
      {albumRows(items.length).map((row, i) => (
        <div key={i} className="album-row">
          {row.map((at) => (
            <AlbumTile key={items[at].id} r={items[at]} more={at === 3 ? more : 0} onOpen={() => setOpen(at)} />
          ))}
        </div>
      ))}
      {open !== null && <AlbumViewer items={items} at={open} onMove={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AlbumTile({ r, more, onOpen }: { r: AttachmentRef; more: number; onOpen: () => void }) {
  const { autoLoadPhotos } = usePrefs();
  const { url, error } = useBlobUrl(r, autoLoadPhotos);
  return (
    <button className="album-tile" onClick={onOpen} aria-label={more ? `Open photos, ${more} more` : `Open image ${r.name}`}>
      {url ? (
        <img src={url} alt="" loading="lazy" />
      ) : error ? (
        <TriangleAlert size={18} />
      ) : autoLoadPhotos ? (
        <span className="skeleton" aria-hidden="true" />
      ) : (
        <ImageIcon size={20} aria-hidden="true" />
      )}
      {more > 0 && <span className="album-more">+{more}</span>}
    </button>
  );
}

function AlbumViewer({ items, at, onMove, onClose }: { items: AttachmentRef[]; at: number; onMove: (i: number) => void; onClose: () => void }) {
  const r = items[at];
  const { url } = useBlobUrl(r, true);
  const steps: Steps = { position: `${at + 1} of ${items.length}`, onPrev: at > 0 ? () => onMove(at - 1) : null, onNext: at < items.length - 1 ? () => onMove(at + 1) : null };
  return <Lightbox url={url} name={r.name} onClose={onClose} steps={steps} />;
}

export function FileAttachment({ r, error: initialError }: { r: AttachmentRef; error?: string }) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveAttachment(engine, r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // the save dialog was closed
      setError(e instanceof Error ? e.message : "Couldn't download this file.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="att-file" onClick={() => void download()} disabled={busy} aria-label={`Download ${r.name}, ${bytes(r.size)}`}>
      <span className="file-icon">{error ? <TriangleAlert size={18} /> : r.voice ? <Mic size={18} /> : <FileText size={18} />}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
          {r.voice ? "Voice message" : r.name}
        </span>
        <small className={error ? "" : undefined} style={error ? { color: "var(--danger)" } : undefined}>
          {error ?? (busy ? "Decrypting…" : `${bytes(r.size)} · end-to-end encrypted`)}
        </small>
      </span>
      {!error && <Download size={16} className="faint" />}
    </button>
  );
}
