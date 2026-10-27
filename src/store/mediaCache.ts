/**
 * Media kept in this browser between visits (reported 2026-10-23: every photo downloaded again on every page load). It
 * holds what the server sent: an attachment's ciphertext, still end-to-end encrypted and checked (SHA-256) and
 * decrypted each time it's opened, and profile and community photos. Erased with the rest of this browser's data
 * (LocalStore.erase); the oldest entries go first past a size budget. Where the Cache API is missing (an insecure page,
 * some private windows), everything is fetched as before.
 */
const CACHE_NAME = "meldiq-media-v1";
/** What this browser keeps at most; the oldest entries are let go first. */
export const MEDIA_BUDGET_BYTES = 300 * 1024 * 1024;
const SIZE = "x-meldiq-size";
const AT = "x-meldiq-at";
/** Trimming lists every entry, so it runs after this many new entries rather than after each one. */
const TRIM_EVERY = 10;

let added = 0;

function storage(): CacheStorage | null {
  try {
    return typeof caches !== "undefined" ? caches : null;
  } catch {
    return null;
  }
}

/** Not a real address: a key under this site, which the Cache API requires. Never requested from the network. */
const requestFor = (key: string): string => new URL(`/__meldiq-media/${encodeURIComponent(key)}`, location.origin).href;

export async function cachedMedia(key: string): Promise<Uint8Array | null> {
  const store = storage();
  if (!store) return null;
  try {
    const hit = await (await store.open(CACHE_NAME)).match(requestFor(key));
    return hit ? new Uint8Array(await hit.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function keepMedia(key: string, bytes: Uint8Array): Promise<void> {
  const store = storage();
  if (!store || bytes.byteLength > MEDIA_BUDGET_BYTES / 4) return;
  try {
    const cache = await store.open(CACHE_NAME);
    const headers = { [SIZE]: String(bytes.byteLength), [AT]: String(Date.now()) };
    await cache.put(requestFor(key), new Response(new Uint8Array(bytes), { headers }));
    if (++added % TRIM_EVERY === 0) await trim(cache);
  } catch {
    /* full or unavailable: fetched again next time */
  }
}

/** A kept entry as a Blob (large ciphertexts: read in slices later, never whole into memory). */
export async function cachedMediaBlob(key: string): Promise<Blob | null> {
  const store = storage();
  if (!store) return null;
  try {
    const hit = await (await store.open(CACHE_NAME)).match(requestFor(key));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

/** Keeps a Blob (streamed into the cache, not copied into memory); skipped past a quarter of the budget. */
export async function keepMediaBlob(key: string, blob: Blob): Promise<void> {
  const store = storage();
  if (!store || blob.size > MEDIA_BUDGET_BYTES / 4) return;
  try {
    const cache = await store.open(CACHE_NAME);
    await cache.put(requestFor(key), new Response(blob, { headers: { [SIZE]: String(blob.size), [AT]: String(Date.now()) } }));
    if (++added % TRIM_EVERY === 0) await trim(cache);
  } catch {
    /* full or unavailable: fetched again next time */
  }
}

export async function forgetMediaEntry(key: string): Promise<void> {
  try {
    await (await storage()?.open(CACHE_NAME))?.delete(requestFor(key));
  } catch {
    /* nothing kept */
  }
}

/** Erases every kept file (sign-out, account deletion). */
export async function forgetAllMedia(): Promise<void> {
  try {
    await storage()?.delete(CACHE_NAME);
  } catch {
    /* nothing kept */
  }
}

export interface KeptEntry {
  key: string;
  size: number;
  at: number;
}

/** The entries to let go, oldest first, so what stays fits in [budget]. */
export function toEvict(entries: readonly KeptEntry[], budget: number): string[] {
  let total = entries.reduce((n, e) => n + e.size, 0);
  const out: string[] = [];
  for (const e of [...entries].sort((a, b) => a.at - b.at)) {
    if (total <= budget) break;
    out.push(e.key);
    total -= e.size;
  }
  return out;
}

async function trim(cache: Cache): Promise<void> {
  const entries: KeptEntry[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    entries.push({ key: req.url, size: Number(res?.headers.get(SIZE) ?? 0), at: Number(res?.headers.get(AT) ?? 0) });
  }
  for (const url of toEvict(entries, MEDIA_BUDGET_BYTES)) await cache.delete(url);
}
