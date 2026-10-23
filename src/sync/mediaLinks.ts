/**
 * Music and video links (android MediaLinks, server docs/MEDIA.md): recognised from the address alone, so a card can say
 * what the link is ("YouTube video", "Spotify playlist") and open it on the provider's own site, without the browser
 * fetching anything (no tracking pixel for recipients) and without an embedded player.
 */
export type MediaProvider = "YouTube" | "YouTube Music" | "Spotify" | "SoundCloud" | "Vimeo";
export type MediaKind = "video" | "short" | "track" | "album" | "playlist" | "artist" | "episode" | "show" | "live";

export interface MediaLink {
  provider: MediaProvider;
  kind: MediaKind;
  url: string;
  /** A YouTube video, Short or live stream, which plays inside Meldiq when chosen (android, 2026-10-23). */
  videoId?: string;
}

/**
 * The privacy-enhanced YouTube player for [videoId] (youtube-nocookie.com: no cookies until playback). Only built for
 * ids of the 11-character pattern, so nothing else can be loaded through it (android MediaLinks.embedUrl).
 */
export function embedUrl(videoId: string): string | null {
  return YOUTUBE_ID.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0` : null;
}

export const KIND_LABEL: Record<MediaKind, string> = {
  video: "Video",
  short: "Short",
  track: "Track",
  album: "Album",
  playlist: "Playlist",
  artist: "Artist",
  episode: "Podcast episode",
  show: "Podcast",
  live: "Live stream",
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_KINDS: Record<string, MediaKind> = { track: "track", album: "album", playlist: "playlist", artist: "artist", episode: "episode", show: "show" };
const SOUNDCLOUD_NOT_TRACKS = new Set(["sets", "tracks", "likes", "followers", "following"]);
/** The same links the message text makes tappable (RichText), https only. */
const LINK = /https:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** The first music or video link in [text], or null. */
export function findMediaLink(text: string): MediaLink | null {
  for (const m of text.matchAll(LINK)) {
    const found = detectMediaLink(m[0]);
    if (found) return found;
  }
  return null;
}

export function detectMediaLink(url: string): MediaLink | null {
  if (!url.startsWith("https://")) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "");
  const path = u.pathname.split("/").filter(Boolean);
  const q = u.searchParams;
  const link = (provider: MediaProvider, kind: MediaKind): MediaLink => ({ provider, kind, url });
  switch (host) {
    case "youtube.com":
      return youtube(path, q, "YouTube", link);
    case "music.youtube.com":
      return youtube(path, q, "YouTube Music", link);
    case "youtu.be":
      return YOUTUBE_ID.test(path[0] ?? "") ? { ...link("YouTube", "video"), videoId: path[0] } : null;
    case "open.spotify.com": {
      // Spotify adds a locale segment to some links: open.spotify.com/intl-de/track/…
      const p = path[0]?.startsWith("intl-") ? path.slice(1) : path;
      const kind = SPOTIFY_KINDS[p[0] ?? ""];
      return kind && SPOTIFY_ID.test(p[1] ?? "") ? link("Spotify", kind) : null;
    }
    case "soundcloud.com":
      if (path.length === 2 && !SOUNDCLOUD_NOT_TRACKS.has(path[1])) return link("SoundCloud", "track");
      if (path.length === 3 && path[1] === "sets") return link("SoundCloud", "playlist");
      return null;
    case "vimeo.com":
      return /^\d{4,12}$/.test(path[0] ?? "") ? link("Vimeo", "video") : null;
    default:
      return null;
  }
}

function youtube(path: string[], q: URLSearchParams, provider: MediaProvider, link: (p: MediaProvider, k: MediaKind) => MediaLink): MediaLink | null {
  const v = q.get("v");
  // YouTube Music opens in its own app: only YouTube's videos, Shorts and live streams play inside Meldiq.
  const playable = (id: string) => (provider === "YouTube" ? { videoId: id } : {});
  if (path[0] === "watch" && v && YOUTUBE_ID.test(v)) return { ...link(provider, provider === "YouTube Music" ? "track" : "video"), ...playable(v) };
  if (path[0] === "playlist" && q.get("list")) return link(provider, "playlist");
  if (path[0] === "shorts" && YOUTUBE_ID.test(path[1] ?? "")) return { ...link(provider, "short"), ...playable(path[1]) };
  if (path[0] === "live" && YOUTUBE_ID.test(path[1] ?? "")) return { ...link(provider, "live"), ...playable(path[1]) };
  return null;
}
