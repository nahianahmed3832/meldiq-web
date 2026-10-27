import { z } from "zod";
import type { GifRef } from "../protocol/payload";
import type { Engine } from "./engine";

/**
 * GIFs (continuation brief v3 §11, API 0.45.0; meldiq docs/GIFS.md): search and popular GIFs come through this
 * server, which asks the provider (Tenor or GIPHY) for it, and the files come through the server too
 * (GET /v1/gifs/media), so the provider never sees this browser and the page loads images from its own origin only.
 * Without a provider set up on the server, the GIF tab says so and offers nothing that would fail.
 */

const zMedia = z.object({ url: z.string(), width: z.number(), height: z.number() });
export const zGifResult = z.object({ id: z.string(), title: z.string().default(""), preview: zMedia, gif: zMedia });
export type GifResult = z.infer<typeof zGifResult>;
const zPage = z.object({ results: z.array(zGifResult), next: z.string().nullable() });
const zStatus = z.object({ configured: z.boolean(), provider: z.enum(["tenor", "giphy"]).nullable().catch(null), attribution: z.string().nullable() });
export type GifStatus = z.infer<typeof zStatus>;

/** The provider's media hosts (the server checks the same before fetching). */
export function gifHostAllowed(provider: "tenor" | "giphy", host: string): boolean {
  const h = host.toLowerCase();
  if (provider === "tenor") return /^media\d?\.tenor\.com$/.test(h) || h === "c.tenor.com";
  return /^media\d?\.giphy\.com$/.test(h) || h === "i.giphy.com";
}

/** A GIF in a message is shown only when its address is https on its provider's media hosts. */
export function gifAllowed(g: GifRef): boolean {
  try {
    const u = new URL(g.url);
    return u.protocol === "https:" && !u.username && !u.password && gifHostAllowed(g.provider, u.hostname);
  } catch {
    return false;
  }
}

export async function gifStatus(engine: Engine): Promise<GifStatus> {
  return engine.api.json("GET", "/v1/gifs/status", zStatus);
}

/** A page of results: a search for [q], or what's popular without one. */
export async function gifPage(engine: Engine, q: string, pos?: string): Promise<{ results: GifResult[]; next: string | null }> {
  const body = pos ? { ...(q ? { q } : {}), pos } : q ? { q } : {};
  return engine.api.json("POST", q ? "/v1/gifs/search" : "/v1/gifs/trending", zPage, { body });
}

const cache = new Map<string, Promise<string | null>>();
const MAX_KEPT = 200;

/** A GIF file as an object URL, through the server (kept for the page's life, a bounded number). */
export function gifObjectUrl(engine: Engine, src: string): Promise<string | null> {
  let p = cache.get(src);
  if (!p) {
    p = engine.api
      .response(`/v1/gifs/media?src=${encodeURIComponent(src)}`)
      .then(async (res) => URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: res.headers.get("content-type") ?? "image/gif" })))
      .catch(() => null);
    cache.set(src, p);
    if (cache.size > MAX_KEPT) {
      const [oldest, url] = cache.entries().next().value as [string, Promise<string | null>];
      cache.delete(oldest);
      void url.then((u) => u && URL.revokeObjectURL(u));
    }
  }
  return p;
}
