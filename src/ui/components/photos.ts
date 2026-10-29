import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import type { Engine } from "../../sync/engine";
import { cachedMedia, keepMedia } from "../../store/mediaCache";

/**
 * Profile and workspace photos. They need the session (members only), so they're fetched with the API client and shown
 * as object URLs, one per photo revision, kept for the page's life (a bounded number, oldest let go first); the bytes are
 * kept in this browser's media cache, so another visit doesn't download them again.
 */
const MAX_KEPT = 300;
const cache = new Map<string, Promise<string | null>>();

function load(engine: Engine, path: string, key: string, mime = "image/jpeg"): Promise<string | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  // Kept in this browser between visits, one entry per photo revision (a new photo has a new revision).
  const p = cachedMedia(`photo:${key}`)
    .then(async (kept) => {
      if (kept) return kept;
      const b = new Uint8Array(await engine.api.bytes(path));
      void keepMedia(`photo:${key}`, b);
      return b;
    })
    .then((b) => URL.createObjectURL(new Blob([new Uint8Array(b)], { type: mime })))
    .catch(() => null);
  cache.set(key, p);
  if (cache.size > MAX_KEPT) {
    const [oldest, url] = cache.entries().next().value as [string, Promise<string | null>];
    cache.delete(oldest);
    void url.then((u) => u && URL.revokeObjectURL(u));
  }
  return p;
}

const PHOTO_PATH = {
  user: (id: string) => `/v1/users/${encodeURIComponent(id)}/photo`,
  group: (id: string) => `/v1/conversations/${encodeURIComponent(id)}/photo`,
  org: (id: string) => `/v1/orgs/${encodeURIComponent(id)}/photo`,
  /** A community's banner (API 0.44.0): members, or anyone for a public community. */
  banner: (id: string) => `/v1/orgs/${encodeURIComponent(id)}/banner`,
  /** The banner of the community an invitation code leads to. */
  inviteBanner: (code: string) => `/v1/invites/${encodeURIComponent(code)}/banner`,
  /** API 0.45.0: a person's animated avatar, its still frame (video avatars), and their profile banner. */
  avatarMedia: (id: string) => `/v1/users/${encodeURIComponent(id)}/avatar-media`,
  avatarPoster: (id: string) => `/v1/users/${encodeURIComponent(id)}/avatar-poster`,
  profileBanner: (id: string) => `/v1/users/${encodeURIComponent(id)}/profile-banner`,
  /** API 0.60.0: one of your own decoration submissions, while it isn't public. */
  ownDecoration: (id: string) => `/v2/decorations/mine/${encodeURIComponent(id)}/image`,
};

/** The photo (or banner) of a user, group or community at revision [rev], or null (none, not allowed, or still loading). */
export function usePhoto(kind: keyof typeof PHOTO_PATH, id: string, rev: number | null | undefined, mime?: string): string | null {
  const engine = useEngine();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!rev) return setUrl(null);
    let live = true;
    void load(engine, PHOTO_PATH[kind](id), `${kind}:${id}:${rev}`, mime).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [engine, kind, id, rev, mime]);
  return url;
}
