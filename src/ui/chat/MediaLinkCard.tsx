import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { ExternalLink, Library, ListMusic, Music, Play, Podcast, Radio, User, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { usePrefs } from "../../application/prefs";
import type { LinkPreview } from "../../protocol/payload";
import { embedUrl, KIND_LABEL, type MediaKind, type MediaLink } from "../../sync/mediaLinks";
import { SafeLink } from "./SafeLink";
const KIND_ICON: Record<MediaKind, ReactNode> = {
  video: <Play size={24} />,
  short: <Play size={24} />,
  live: <Radio size={24} />,
  track: <Music size={24} />,
  album: <Library size={24} />,
  playlist: <ListMusic size={24} />,
  artist: <User size={24} />,
  episode: <Podcast size={24} />,
  show: <Podcast size={24} />,
};
/**
 * A music or video link as a card (android MediaCards): the provider, what it is, the title when the sender's phone made
 * a preview, and one action that opens the provider's site; nothing is fetched until then. A YouTube video, Short or
 * live stream plays inside Meldiq instead (android, 2026-10-23; Settings › Appearance › Play YouTube in Meldiq), in
 * YouTube's privacy-enhanced player, loaded only when Play is chosen.
 */
export function MediaLinkCard({ link, preview }: { link: MediaLink; preview: LinkPreview | null }) {
  useLocaleRender();
  const { youtubeInApp } = usePrefs();
  const [playing, setPlaying] = useState(false);
  const embed = youtubeInApp && link.videoId ? embedUrl(link.videoId) : null;
  if (embed && playing) return <YouTubePlayer embed={embed} url={link.url} title={preview?.title ?? null} onClose={() => setPlaying(false)} />;
  if (embed) return <MediaCardBody link={link} preview={preview} onPlay={() => setPlaying(true)} />;
  return <MediaCardBody link={link} preview={preview} onPlay={null} />;
}
function MediaCardBody({ link, preview, onPlay }: { link: MediaLink; preview: LinkPreview | null; onPlay: (() => void) | null }) {
  useLocaleRender();
  const provider = link.provider;
  if (onPlay)
    return (
      <button
        className="media-card"
        onClick={onPlay}
        aria-label={uiText("messaging.interface.play_value0_here_3e0f1bf", { value0: preview?.title ?? `${provider} ${KIND_LABEL[link.kind].toLowerCase()}` })}
      >
        <span className={`media-card-art media-${provider.replace(/\s+/g, "-").toLowerCase()}`} aria-hidden="true">
          {KIND_ICON[link.kind]}
        </span>
        <span className="media-card-text">
          <small>
            {provider} · {KIND_LABEL[link.kind]}
          </small>
          {preview?.title && <strong>{preview.title}</strong>}
          <small>
            <Localized k="messaging.interface.plays_here_in_youtube_s_privacy_enhanced_player_967d319" />
          </small>
        </span>
        <Play size={16} aria-hidden="true" className="media-card-open" />
      </button>
    );
  return (
    <SafeLink className="media-card" href={link.url}>
      <span className={`media-card-art media-${provider.replace(/\s+/g, "-").toLowerCase()}`} aria-hidden="true">
        {KIND_ICON[link.kind]}
      </span>
      <span className="media-card-text">
        <small>
          {provider} · {KIND_LABEL[link.kind]}
        </small>
        {preview?.title && <strong>{preview.title}</strong>}
        <small>
          <Localized k="messaging.interface.plays_in_the_app_or_website_95caefd" slots={[provider]} />
        </small>
      </span>
      <ExternalLink size={16} aria-hidden="true" className="media-card-open" />
    </SafeLink>
  );
}
/**
 * The player (16:9) in a frame from youtube-nocookie.com, the one page this site lets it embed (frame-src in the
 * security headers). The frame is its own site: it can't read Meldiq or the conversation.
 */
function YouTubePlayer({ embed, url, title, onClose }: { embed: string; url: string; title: string | null; onClose: () => void }) {
  useLocaleRender();
  return (
    <div className="yt-player">
      <iframe
        src={embed}
        title={title ?? uiText("messaging.interface.youtube_video_4d78938")}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
      <div className="yt-player-bar">
        <SafeLink className="btn btn-ghost btn-sm" href={url}>
          <Localized k="messaging.interface.open_on_youtube_f7951ab" slots={[<ExternalLink size={14} />]} />
        </SafeLink>
        <button className="icon-btn" onClick={onClose} aria-label={uiText("messaging.interface.close_the_player_830abb8")}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
