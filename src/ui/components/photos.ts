import { useEffect, useState } from "react";
import { useEngine } from "../../app/orbit";
import type { Engine } from "../../sync/engine";

/**
 * Profile and workspace photos. They need the session (members only), so they're fetched with the API client and shown
 * as object URLs, one per photo revision, kept for the page's life (a bounded number, oldest let go first).
 */
const MAX_KEPT = 300;
const cache = new Map<string, Promise<string | null>>();

function load(engine: Engine, path: string, key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = engine.api
    .bytes(path)
    .then((b) => URL.createObjectURL(new Blob([new Uint8Array(b)], { type: "image/jpeg" })))
    .catch(() => null);
  cache.set(key, p);
  if (cache.size > MAX_KEPT) {
    const [oldest, url] = cache.entries().next().value as [string, Promise<string | null>];
    cache.delete(oldest);
    void url.then((u) => u && URL.revokeObjectURL(u));
  }
  return p;
}

/** The photo of a user or workspace at revision [rev], or null (none, not allowed, or still loading). */
export function usePhoto(kind: "user" | "org", id: string, rev: number | null | undefined): string | null {
  const engine = useEngine();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!rev) return setUrl(null);
    let live = true;
    const path = kind === "user" ? `/v1/users/${encodeURIComponent(id)}/photo` : `/v1/orgs/${encodeURIComponent(id)}/photo`;
    void load(engine, path, `${kind}:${id}:${rev}`).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [engine, kind, id, rev]);
  return url;
}
