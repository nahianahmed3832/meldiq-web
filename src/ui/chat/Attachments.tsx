import { Download, FileText, Film, Image as ImageIcon, Mic, Pause, Play, TriangleAlert } from "lucide-react";
import { useContext, useEffect, useId, useState } from "react";
import { useEngine } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import { useVoicePlayback, voicePlayback } from "../../application/voicePlayback";
import type { AttachmentRef } from "../../protocol/payload";
import { isInlineImage, safeMime, saveAttachment } from "../../sync/attachments";
import { clock, isVoice, shownDuration } from "../../sync/voice";
import { bytes } from "../format";
import { albumOverflow, albumRows } from "./album";
import { useNearScreen } from "./useNearScreen";
import { useBlobUrl } from "./blobUrl";
import { isVideo, isViewable, MediaViewer, OpenViewerContext, type ViewerInfo, ViewerInfoContext } from "./MediaViewer";

export type { ViewerInfo };

/**
 * Decrypts on demand. Images show inline once scrolled near; voice messages play in place (android VoiceViews); audio and video play inline
 * once opened (a click, so nothing large downloads unasked); anything else is a file card that downloads.
 */
export function Attachments({ refs, viewer }: { refs: AttachmentRef[]; viewer?: ViewerInfo }) {
  // The message's photos and videos, stepped through in one viewer (MediaViewer.tsx).
  const media = refs.filter((r) => !isVoice(r) && isViewable(r));
  const [viewing, setViewing] = useState<number | null>(null);
  if (!refs.length) return null;
  // Several photos sent together are an album (android AlbumGrid); everything else is listed under it.
  const images = refs.filter((r) => !isVoice(r) && isInlineImage(r));
  const album = images.length >= 2 ? images : [];
  const rest = album.length ? refs.filter((r) => !album.includes(r)) : refs;
  const open = (r: AttachmentRef) =>
    setViewing(
      Math.max(
        0,
        media.findIndex((m) => m.id === r.id),
      ),
    );
  return (
    <ViewerInfoContext.Provider value={viewer ?? null}>
      <OpenViewerContext.Provider value={open}>
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
        {viewing !== null && media[viewing] && <MediaViewer items={media} at={viewing} onMove={setViewing} onClose={() => setViewing(null)} />}
      </OpenViewerContext.Provider>
    </ViewerInfoContext.Provider>
  );
}

/** Opens [r] in the message's viewer, or in a viewer of its own where it's shown outside a message (galleries). */
function useViewer(r: AttachmentRef): { open: () => void; own: React.ReactNode } {
  const shared = useContext(OpenViewerContext);
  const [alone, setAlone] = useState(false);
  return {
    open: () => (shared ? shared(r) : setAlone(true)),
    own: alone ? <MediaViewer items={[r]} at={0} onMove={() => undefined} onClose={() => setAlone(false)} /> : null,
  };
}

const isPlayable = (r: AttachmentRef): boolean => /^(audio|video)\//.test(safeMime(r.mime));

/**
 * A voice message: play/pause, a seek bar, its length and speed; the first play downloads and decrypts it. It plays
 * through the page's one voice player (application/voicePlayback.ts), so starting it pauses any other at once.
 */
function VoiceAttachment({ r }: { r: AttachmentRef }) {
  // Each drawing of a message is its own clip: the same message in a panel and in the conversation has two players.
  const key = `${r.id}${useId()}`;
  const playback = useVoicePlayback();
  const [wanted, setWanted] = useState(false);
  const { url, error, loading } = useBlobUrl(r, wanted);
  useEffect(() => {
    if (url) voicePlayback.provide(key, url);
  }, [key, url]);
  // Leaving the conversation or closing the panel stops it.
  useEffect(() => () => voicePlayback.release(key), [key]);
  const total = shownDuration(r.durationMs);
  if (error) return <FileAttachment r={r} error={error} />;
  const mine = playback.key === key;
  const playing = mine && playback.status === "playing";
  const busy = mine && playback.status === "loading" && (loading || !url);
  const pos = mine ? playback.positionMs : voicePlayback.positionOf(key);
  const seconds = Math.round(total / 1000);
  return (
    <div className={`voice-msg${playing ? " playing" : ""}`} role="group" aria-label={`Voice message, ${seconds} seconds`} data-voice-state={mine ? playback.status : "idle"}>
      <button
        className="voice-play"
        aria-label={playing || busy ? "Pause voice message" : `Play voice message, ${seconds} seconds`}
        aria-pressed={playing}
        onClick={() => {
          if (!url) setWanted(true);
          voicePlayback.toggle(key, url);
        }}
      >
        {busy ? <span className="spinner" aria-hidden="true" /> : playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <input
        type="range"
        className="voice-seek"
        min={0}
        max={Math.max(1, total)}
        value={Math.min(pos, Math.max(1, total))}
        aria-label="Position"
        aria-valuetext={`${Math.round(pos / 1000)} seconds of ${seconds} seconds`}
        disabled={!url}
        onChange={(e) => voicePlayback.seek(key, Number(e.target.value))}
      />
      <span className="voice-len">{playing || pos > 0 ? `${clock(pos)} / ${clock(total)}` : clock(total)}</span>
      {mine && playback.status !== "idle" && (
        <button className="voice-rate" onClick={() => voicePlayback.cycleRate()} aria-label={`Playback speed ${playback.rate} times. Change speed`}>
          {playback.rate}×
        </button>
      )}
      {mine && playback.failed && (
        <span className="voice-failed" role="alert">
          {playback.failed}
        </span>
      )}
    </div>
  );
}

/**
 * A video: a tile with a play button that opens the viewer, where it decrypts and plays with Meldiq's controls; audio
 * files: a card until opened, then a player in place (decrypted in memory, never a page).
 */
export function MediaAttachment({ r }: { r: AttachmentRef }) {
  const viewer = useViewer(r);
  const [open, setOpen] = useState(false);
  const { url, error, loading } = useBlobUrl(r, open && !isVideo(r));
  if (error) return <FileAttachment r={r} error={error} />;
  if (isVideo(r))
    return (
      <>
        <button className="att-video-tile" onClick={viewer.open} aria-label={`Play video ${r.name}, ${bytes(r.size)}`}>
          <span className="att-video-play" aria-hidden="true">
            <Play size={22} />
          </span>
          <span className="att-video-name">
            <Film size={14} aria-hidden="true" /> <span className="ellipsis">{r.name}</span>
            <small>{bytes(r.size)}</small>
          </span>
        </button>
        {viewer.own}
      </>
    );
  if (!open || loading || !url) {
    return (
      <button className="att-file" onClick={() => setOpen(true)} aria-label={`Play ${r.name}, ${bytes(r.size)}`} disabled={open}>
        <span className="file-icon">
          <Play size={18} />
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
            {r.name}
          </span>
          <small>{open ? "Loading…" : `${bytes(r.size)} · play here`}</small>
        </span>
      </button>
    );
  }
  return <audio className="att-audio" src={url} controls autoPlay aria-label={r.name} />;
}

export function ImageAttachment({ r }: { r: AttachmentRef }) {
  // Download photos automatically off (android Settings › Chats): each photo waits for a click.
  const { autoLoadPhotos } = usePrefs();
  const [asked, setAsked] = useState(false);
  // Loaded when scrolled near, not with the whole history (and then kept in this browser: src/store/mediaCache.ts).
  const [spot, near] = useNearScreen<HTMLDivElement>();
  const { url, error, loading } = useBlobUrl(r, (autoLoadPhotos && near) || asked);
  const viewer = useViewer(r);
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
          <small>{bytes(r.size)} · click to load</small>
        </span>
      </button>
    );
  if (loading || !url) return <div ref={spot} className="att-image att-pending skeleton" aria-label={`Loading ${r.name}`} />;
  return (
    <>
      <button className="att-image" onClick={viewer.open} aria-label={`Open image ${r.name}`}>
        <img src={url} alt={r.name} loading="lazy" />
      </button>
      {viewer.own}
    </>
  );
}

/** Several photos sent together: up to four tiles, the last saying how many more; each opens a viewer that steps through all. */
function AlbumGrid({ items }: { items: AttachmentRef[] }) {
  const shared = useContext(OpenViewerContext);
  const [open, setOpen] = useState<number | null>(null);
  const more = albumOverflow(items.length);
  return (
    <div className="album" role="group" aria-label={`${items.length} photos`}>
      {albumRows(items.length).map((row, i) => (
        <div key={i} className="album-row">
          {row.map((at) => (
            <AlbumTile key={items[at].id} r={items[at]} more={at === 3 ? more : 0} onOpen={() => (shared ? shared(items[at]) : setOpen(at))} />
          ))}
        </div>
      ))}
      {open !== null && <MediaViewer items={items} at={open} onMove={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AlbumTile({ r, more, onOpen }: { r: AttachmentRef; more: number; onOpen: () => void }) {
  const { autoLoadPhotos } = usePrefs();
  const [spot, near] = useNearScreen<HTMLButtonElement>();
  const { url, error } = useBlobUrl(r, autoLoadPhotos && near);
  return (
    <button ref={spot} className="album-tile" onClick={onOpen} aria-label={more ? `Open photos, ${more} more` : `Open image ${r.name}`}>
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
          {error ?? (busy ? "Loading…" : bytes(r.size))}
        </small>
      </span>
      {!error && <Download size={16} className="faint" />}
    </button>
  );
}

/** Under the picture: who sent it and when, the message's text, and quick reactions. */
