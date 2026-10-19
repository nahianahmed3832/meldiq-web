import { ExternalLink, Library, ListMusic, Music, Play, Podcast, Radio, User } from "lucide-react";
import type { ReactNode } from "react";
import type { LinkPreview } from "../../protocol/payload";
import { KIND_LABEL, type MediaKind, type MediaLink } from "../../sync/mediaLinks";
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
 * a preview, and one action that opens the provider's site. No embedded player and nothing fetched here.
 */
export function MediaLinkCard({ link, preview }: { link: MediaLink; preview: LinkPreview | null }) {
  const provider = link.provider;
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
        <small>Plays in the {provider} app or website</small>
      </span>
      <ExternalLink size={16} aria-hidden="true" className="media-card-open" />
    </SafeLink>
  );
}
