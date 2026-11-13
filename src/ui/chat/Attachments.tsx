import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { X, Image as ImageIcon, Pause, Play, TriangleAlert } from "lucide-react";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { usePrefs } from "../../application/prefs";
import { useVoicePlayback, voicePlayback } from "../../application/voicePlayback";
import type { StoredMessage } from "../../model/types";
import { galleryOf } from "./gallery";
import type { AttachmentRef } from "../../protocol/payload";
import { type DownloadProgress, isInlineImage, safeMime, saveAttachment } from "../../sync/attachments";
import { clock, isVoice, shownDuration } from "../../sync/voice";
import { attachmentName, riskyAttachment } from "../../sync/attachmentPolicy";
import { bytes } from "../format";
import { Icon } from "../icons/Icon";
import { ChatFileSelection } from "./ChatFileSelection";
import { saveKey } from "../../sync/bulkSave";
import { albumOverflow, albumRows } from "./album";
import { useNearScreen } from "./useNearScreen";
import { useBlobUrl } from "./blobUrl";
import { useVideoDownload } from "./useVideoDownload";
import { isVideo, isViewable, MediaViewer, OpenViewerContext, type ViewerInfo, ViewerInfoContext } from "./MediaViewer";
export type { ViewerInfo };
/**
 * Decrypts on demand. Images show inline once scrolled near; voice messages play in place (android VoiceViews); audio and video play inline
 * once opened (a click, so nothing large downloads unasked); anything else is a file card that downloads.
 */
export function Attachments({ refs, viewer, message }: { refs: AttachmentRef[]; viewer?: ViewerInfo; message?: StoredMessage }) {
  useLocaleRender();
  const engine = useEngine();
  const selection = useContext(ChatFileSelection);
  const [viewing, setViewing] = useState<string | null>(null);
  // Only subscribe to conversation history while open. Keep the selected attachment stable as new messages arrive.
  const messages = useOrbit((s) => (viewing && message ? s.messages[message.conversationId]?.items : undefined));
  const users = useOrbit((s) => (viewing ? s.users : undefined));
  const me = useOrbit((s) => (viewing ? s.me : undefined));
  const gallery = useMemo(
    () => galleryOf(messages?.some((m) => m.id === message?.id) ? messages : [...(messages ?? []), ...(message ? [message] : [])]).media.sort((a, b) => a.at - b.at),
    [messages, message],
  );
  const media = gallery.length ? gallery.map((i) => i.ref) : refs.filter((r) => !isVoice(r) && isViewable(r));
  const at = media.findIndex((r) => r.id === viewing);
  const source = messages?.find((m) => m.id === gallery[at]?.messageId);
  const info: ViewerInfo | null =
    source && source.id !== message?.id
      ? {
          sender: source.senderUserId === me?.userId ? me.displayName : (users?.[source.senderUserId]?.displayName ?? uiText("workspace.interface.member_7c968fb")),
          at: source.sortTs,
          text: source.text,
          quick: viewer?.quick ?? [],
          reacted: Object.entries(source.reactions)
            .filter(([, who]) => me && who.includes(me.userId))
            .map(([emoji]) => emoji),
          onReact: viewer?.onReact ? (emoji) => void engine.react(source, emoji) : null,
        }
      : (viewer ?? null);
  if (!refs.length) return null;
  if (selection?.selecting && message) {
    return (
      <div className="attachments chat-file-choices">
        {refs.map((r) => {
          const name = attachmentName(r.name);
          const key = saveKey(message.id, r.id);
          const checked = selection.selected.has(key);
          return (
            <label className="att-file chat-file-choice" key={r.id} data-attachment-id={r.id}>
              <input type="checkbox" checked={checked} onChange={() => selection.toggle(key)} aria-label={uiText("messaging.interface.select_value0_b4b262a", { value0: name })} />
              <span className="grow">
                <strong className="ellipsis">{name}</strong>
                <small>{bytes(r.size)}</small>
              </span>
            </label>
          );
        })}
      </div>
    );
  }
  // Several photos sent together are an album (android AlbumGrid); everything else is listed under it.
  const images = refs.filter((r) => !isVoice(r) && isInlineImage(r));
  const album = images.length >= 2 ? images : [];
  const rest = album.length ? refs.filter((r) => !album.includes(r)) : refs;
  const open = (r: AttachmentRef) => setViewing(r.id);
  return (
    <ViewerInfoContext.Provider value={info}>
      <OpenViewerContext.Provider value={open}>
        <div className="attachments">
          {album.length > 0 && <AlbumGrid items={album} />}
          {rest.map((r) => (
            <div key={r.id} data-attachment-id={r.id} className="chat-attachment">
              {isVoice(r) ? <VoiceAttachment r={r} /> : isInlineImage(r) ? <ImageAttachment r={r} /> : isPlayable(r) ? <MediaAttachment r={r} /> : <FileAttachment r={r} />}
              {!isVoice(r) && !isVideo(r) && (isInlineImage(r) || isPlayable(r)) && <InlineDownload r={r} />}
            </div>
          ))}
        </div>
        {viewing !== null && at >= 0 && <MediaViewer items={media} at={at} onMove={(i) => setViewing(media[i].id)} onClose={() => setViewing(null)} />}
      </OpenViewerContext.Provider>
    </ViewerInfoContext.Provider>
  );
}
/** Opens [r] in the message's viewer, or in a viewer of its own where it's shown outside a message (galleries). */
function useViewer(r: AttachmentRef): {
  open: () => void;
  own: React.ReactNode;
} {
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
  useLocaleRender();
  // Each drawing of a message is its own clip: the same message in a panel and in the conversation has two players.
  const key = `${r.id}${useId()}`;
  const playback = useVoicePlayback();
  const [wanted, setWanted] = useState(false);
  const { url, error, loading, retry } = useBlobUrl(r, wanted);
  useEffect(() => {
    if (url) voicePlayback.provide(key, url);
  }, [key, url]);
  // Leaving the conversation or closing the panel stops it.
  useEffect(() => () => voicePlayback.release(key), [key]);
  const total = shownDuration(r.durationMs);
  const mine = playback.key === key;
  const playing = mine && playback.status === "playing";
  const busy = !error && mine && playback.status === "loading" && (loading || !url);
  const pos = mine ? playback.positionMs : voicePlayback.positionOf(key);
  const seconds = Math.round(total / 1000);
  return (
    <div
      className={`voice-msg${playing ? " playing" : ""}`}
      role="group"
      aria-label={uiText("messaging.interface.voice_message_value0_seconds_68e9fc2", { value0: seconds })}
      data-voice-state={mine ? playback.status : "idle"}
    >
      <button
        className="voice-play"
        aria-label={playing || busy ? uiText("messaging.interface.pause_voice_message_bc36903") : uiText("messaging.interface.play_voice_message_value0_seconds_d8be711", { value0: seconds })}
        aria-pressed={playing}
        onClick={() => {
          if (error) {
            retry();
            voicePlayback.play(key, null);
            return;
          }
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
        aria-label={uiText("messaging.interface.position_6d031af")}
        aria-valuetext={uiText("messaging.interface.value0_seconds_of_value1_seconds_ccfa879", { value0: Math.round(pos / 1000), value1: seconds })}
        disabled={!url}
        onChange={(e) => voicePlayback.seek(key, Number(e.target.value))}
      />
      <span className="voice-len">{playing || pos > 0 ? uiText("messaging.interface.value0_value1_2a194ab", { value0: clock(pos), value1: clock(total) }) : clock(total)}</span>
      {mine && playback.status !== "idle" && (
        <button className="voice-rate" onClick={() => voicePlayback.cycleRate()} aria-label={uiText("messaging.interface.playback_speed_value0_times_change_speed_20b38a2", { value0: playback.rate })}>
          {formatUiNumber(playback.rate)}×
        </button>
      )}
      {(error || (mine && playback.failed)) && (
        <span className="voice-failed" role="alert">
          {error ?? playback.failed}
        </span>
      )}
    </div>
  );
}
function VideoAttachment({ r }: { r: AttachmentRef }) {
  useLocaleRender();
  const l10n = useLocalization();
  const viewer = useViewer(r);
  const downloaded = useVideoDownload(r.id);
  const transfer = useDownload(r);
  const [open, setOpen] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const inline = useRef<HTMLVideoElement>(null);
  const { url, error, loading, retry, progress } = useBlobUrl(r, open, true);
  const [stage, near] = useNearScreen<HTMLDivElement>();
  const { autoLoadPhotos } = usePrefs();
  const { url: poster } = useBlobUrl(r.thumbnail ?? r, !!r.thumbnail && autoLoadPhotos && near);
  const name = attachmentName(r.name);
  const titleId = useId();
  const size = bytes(r.size);
  const pct = progress?.total ? Math.min(100, Math.floor((progress.done * 100) / progress.total)) : null;
  const waiting = open && loading;
  const portrait = r.w && r.h && r.h > r.w;
  const ratio = r.w && r.h ? r.w / r.h : 16 / 10;
  return (
    <div className={portrait ? "att-video-card portrait" : "att-video-card"}>
      <div className="att-video-stage" ref={stage} style={{ aspectRatio: ratio, maxWidth: `min(100%, ${Math.round(360 * ratio)}px, ${54 * ratio}dvh)` }}>
        {url && !unsupported ? (
          <video
            ref={inline}
            className="att-inline-video"
            src={url}
            poster={poster ?? undefined}
            controls
            playsInline
            autoPlay
            preload="metadata"
            aria-label={uiText("messaging.interface.inline_video_value0_9f6acf0", { value0: name })}
            onError={() => setUnsupported(true)}
          />
        ) : (
          <button
            className="att-video-tile"
            disabled={waiting}
            onClick={() => {
              setUnsupported(false);
              if (error || unsupported) retry();
              setOpen(true);
            }}
            aria-label={uiText("messaging.interface.play_value0_inline_b4960a2", { value0: name })}
          >
            {poster && <img className="att-video-poster" src={poster} alt="" loading="lazy" />}
            <span className="att-video-play" aria-hidden="true">
              {waiting ? <span className="spinner" /> : <Play size={22} />}
            </span>
          </button>
        )}
      </div>
      <div className="att-video-footer">
        <div className="att-video-summary">
          <strong className="ellipsis" id={titleId} title={name} dir="auto">
            {name}
          </strong>
          <small className="att-video-size">{size}</small>
          <button
            className="att-video-view"
            onClick={() => {
              inline.current?.pause();
              viewer.open();
            }}
            aria-describedby={titleId}
          >
            {l10n("messaging.open_video_viewer")}
          </button>
        </div>
        {(!downloaded || transfer.busy) && <DownloadControl r={r} transfer={transfer} />}
      </div>
      {waiting && (
        <small className="att-video-status" role="status">
          {uiText("messaging.interface.loading_video_bbef69c")}
          {pct !== null && ` · ${formatUiNumber(pct)}%`}
        </small>
      )}
      {transfer.busy && (
        <progress className="att-video-status" max={100} value={transfer.pct} aria-label={uiText("messaging.interface.download_value0_value1_9f8bb49", { value0: name, value1: transfer.pct })} />
      )}
      {(error || unsupported || transfer.error) && (
        <small className="att-video-status" role="alert">
          {transfer.error ?? error ?? uiText("messaging.interface.this_browser_cannot_play_this_video_s_codec_download_the_original_a46c399")}
        </small>
      )}
      {viewer.own}
    </div>
  );
}

export function MediaAttachment({ r }: { r: AttachmentRef }) {
  return isVideo(r) ? <VideoAttachment key={r.id} r={r} /> : <AudioAttachment key={r.id} r={r} />;
}

function AudioAttachment({ r }: { r: AttachmentRef }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [open, setOpen] = useState(false);
  const { url, error, loading } = useBlobUrl(r, open);
  if (error) return <FileAttachment r={r} error={error} />;
  if (!open || loading || !url) {
    return (
      <button className="att-file" onClick={() => setOpen(true)} aria-label={uiText("messaging.interface.play_value0_value1_43d5a87", { value0: r.name, value1: bytes(r.size) })} disabled={open}>
        <span className="file-icon">
          <Play size={18} />
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
            {r.name}
          </span>
          <small>{open ? l10n("common.status.loading") : uiText("messaging.interface.value0_play_here_61252a4", { value0: bytes(r.size) })}</small>
        </span>
      </button>
    );
  }
  return <audio className="att-audio" src={url} controls autoPlay aria-label={r.name} />;
}
export function ImageAttachment({ r }: { r: AttachmentRef }) {
  useLocaleRender();
  // Download photos automatically off (android Settings › Chats): each photo waits for a click.
  const { autoLoadPhotos } = usePrefs();
  const [asked, setAsked] = useState(false);
  const [decodeFailed, setDecodeFailed] = useState(false);
  // Loaded when scrolled near, not with the whole history (and then kept in this browser: src/store/mediaCache.ts).
  const [spot, near] = useNearScreen<HTMLDivElement>();
  const automatic = autoLoadPhotos && (r.thumbnail !== undefined || r.size <= 10 * 1024 * 1024);
  const { url, error, loading } = useBlobUrl(r.thumbnail ?? r, (automatic && near) || asked);
  const viewer = useViewer(r);
  if (error || decodeFailed) return <FileAttachment r={r} error={error ?? "This browser cannot preview this image. Download the original."} />;
  if (!automatic && !asked)
    return (
      <button className="att-file" onClick={() => setAsked(true)} aria-label={uiText("messaging.interface.load_photo_value0_value1_3fc50a8", { value0: r.name, value1: bytes(r.size) })}>
        <span className="file-icon">
          <ImageIcon size={18} />
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
            <Localized k="messaging.interface.photo_d84eeba" />
          </span>
          <small>
            <Localized k="messaging.interface.click_to_load_b69a3c0" slots={[bytes(r.size)]} />
          </small>
        </span>
      </button>
    );
  if (loading || !url) return <div ref={spot} className="att-image att-pending skeleton" aria-label={uiText("messaging.interface.loading_value0_e87d0f1", { value0: r.name })} />;
  return (
    <>
      <button
        className="att-image"
        onClick={(e) => {
          e.currentTarget.focus();
          viewer.open();
        }}
        aria-label={uiText("messaging.interface.open_image_value0_10f084e", { value0: r.name })}
      >
        <img src={url} alt={r.name} loading="lazy" decoding="async" onError={() => setDecodeFailed(true)} />
      </button>
      {viewer.own}
    </>
  );
}
/** Several photos sent together: up to four tiles, the last saying how many more; each opens a viewer that steps through all. */
function AlbumGrid({ items }: { items: AttachmentRef[] }) {
  useLocaleRender();
  const shared = useContext(OpenViewerContext);
  const [open, setOpen] = useState<number | null>(null);
  const more = albumOverflow(items.length);
  return (
    <div className="album" role="group" aria-label={uiText("messaging.interface.value0_photos_5e6e914", { value0: items.length })}>
      {albumRows(items.length).map((row, i) => (
        <div key={i} className="album-row">
          {row.map((at) => (
            <div key={items[at].id} data-attachment-id={items[at].id} className="chat-attachment album-item">
              <AlbumTile r={items[at]} more={at === 3 ? more : 0} onOpen={() => (shared ? shared(items[at]) : setOpen(at))} />
              <InlineDownload r={items[at]} />
            </div>
          ))}
        </div>
      ))}
      {open !== null && <MediaViewer items={items} at={open} onMove={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
function AlbumTile({ r, more, onOpen }: { r: AttachmentRef; more: number; onOpen: () => void }) {
  useLocaleRender();
  const { autoLoadPhotos } = usePrefs();
  const [spot, near] = useNearScreen<HTMLButtonElement>();
  const { url, error } = useBlobUrl(r.thumbnail ?? r, autoLoadPhotos && near && (r.thumbnail !== undefined || r.size <= 10 * 1024 * 1024));
  return (
    <button
      ref={spot}
      className="album-tile"
      onClick={(e) => {
        e.currentTarget.focus();
        onOpen();
      }}
      aria-label={more ? uiText("messaging.interface.open_photos_value0_more_ab65ac5", { value0: more }) : uiText("messaging.interface.open_image_value0_10f084e", { value0: r.name })}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : error ? (
        <TriangleAlert size={18} />
      ) : autoLoadPhotos ? (
        <span className="skeleton" aria-hidden="true" />
      ) : (
        <ImageIcon size={20} aria-hidden="true" />
      )}
      {more > 0 && <span className="album-more">+{formatUiNumber(more)}</span>}
    </button>
  );
}
function useDownload(r: AttachmentRef) {
  const engine = useEngine();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const download = async () => {
    if (abort.current) return;
    const control = new AbortController();
    abort.current = control;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await saveAttachment(engine, r, { signal: control.signal, onProgress: setProgress });
    } catch (e) {
      if (control.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
      setError(e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_download_this_file_try_again_17f1753"));
    } finally {
      abort.current = null;
      setBusy(false);
    }
  };
  const pct = progress?.total ? Math.min(100, Math.floor((100 * progress.done) / progress.total)) : 0;
  return { busy, progress, pct, error, download, cancel: () => abort.current?.abort() };
}

function DownloadControl({ r, transfer }: { r: AttachmentRef; transfer: ReturnType<typeof useDownload> }) {
  const name = attachmentName(r.name);
  return (
    <button
      type="button"
      className="chat-file-download"
      title={transfer.busy ? undefined : uiText("common.actions.download")}
      aria-label={
        transfer.busy
          ? uiText("messaging.interface.cancel_downloading_value0_aa1d110", { value0: name })
          : uiText("messaging.interface.download_value0_value1_68feb19", { value0: name, value1: bytes(r.size) })
      }
      onClick={(e) => {
        e.stopPropagation();
        if (transfer.busy) transfer.cancel();
        else void transfer.download();
      }}
    >
      {transfer.busy ? <X size={20} aria-hidden="true" /> : <Icon name="files.download" size={20} />}
    </button>
  );
}

function InlineDownload({ r }: { r: AttachmentRef }) {
  const transfer = useDownload(r);
  return (
    <div className="chat-inline-download">
      <DownloadControl r={r} transfer={transfer} />
      {transfer.busy && <progress max={100} value={transfer.pct} aria-label={uiText("messaging.interface.download_value0_value1_9f8bb49", { value0: r.name, value1: transfer.pct })} />}
      {transfer.error && <small role="alert">{transfer.error}</small>}
    </div>
  );
}

export function FileAttachment({ r, error: initialError }: { r: AttachmentRef; error?: string }) {
  useLocaleRender();
  const transfer = useDownload(r);
  const { busy, progress, pct, download } = transfer;
  const error = transfer.error ?? initialError;
  const name = attachmentName(r.name);
  const extension = name.includes(".") ? name.split(".").pop()!.toUpperCase() : uiText("messaging.interface.file_b4915d3");
  return (
    <div className="att-file">
      <DownloadControl r={r} transfer={transfer} />
      <button className="file-download-name grow" onClick={() => void download()} disabled={busy}>
        <strong className="ellipsis">{r.voice ? uiText("messaging.interface.voice_message_f6933da") : name}</strong>
        <small role={error ? "alert" : undefined}>
          {error ??
            (busy
              ? progress
                ? uiText("messaging.interface.value0_value1_065e1ea", {
                    value0: progress.phase === "decrypting" ? uiText("messaging.interface.verifying_536244f") : uiText("messaging.interface.downloading_9b4592f"),
                    value1: pct,
                  })
                : uiText("messaging.interface.starting_download_22309b1")
              : uiText("messaging.interface.value0_value1_75414c2", { value0: extension, value1: bytes(r.size) }))}
        </small>
        {busy && <progress max={100} value={pct} aria-label={uiText("messaging.interface.download_value0_value1_9f8bb49", { value0: name, value1: pct })} />}
        {riskyAttachment(name) && (
          <small>
            <Localized k="messaging.interface.open_only_if_you_trust_the_sender_50b85c4" />
          </small>
        )}
      </button>
    </div>
  );
}
