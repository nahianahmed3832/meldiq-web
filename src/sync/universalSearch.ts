import { z } from "zod";
import { zConversation, zMember } from "../api/schemas";
import type { Engine } from "./engine";

/**
 * Universal search (server docs/SEARCH.md, android round 7 slice C2 SearchRules): people, channels, workspaces, groups
 * and documents from the server, which checks each one's own access rule; messages, files and pinned messages from
 * this browser's history (end-to-end encrypted, so the server can't search them).
 */
export const FILTERS = ["all", "messages", "files", "pinned", "people", "channels", "documents", "workspaces"] as const;
export type Filter = (typeof FILTERS)[number];
export const SECTIONS = ["conversations", "channels", "documents", "workspaces", "groups", "people", "messages", "files", "pinned"] as const;
export type Section = (typeof SECTIONS)[number];

export const DEBOUNCE_MS = 250;
/** Results per kind under All; a single-kind filter shows a page and "Show more". */
export const PREVIEW_COUNT = 5;
export const RECENT_MAX = 6;
const MAX_QUERY = 60;

export function sections(filter: Filter): Section[] {
  return filter === "all" ? [...SECTIONS] : [filter as Section];
}

/** The server kinds a filter needs ("people,channels,…"), or null when it needs none. */
export function serverTypes(filter: Filter): string | null {
  switch (filter) {
    case "all":
      return "people,channels,workspaces,groups,documents";
    case "people":
    case "channels":
    case "documents":
    case "workspaces":
      return filter;
    default:
      return null;
  }
}

/** A query worth sending: at least one non-space character, at most the server's 60. */
export function usable(q: string): string | null {
  const t = q.trim();
  return t ? t.slice(0, MAX_QUERY) : null;
}

/** [q] first, without repeats (ignoring case), at most RECENT_MAX. */
export function remember(recent: readonly string[], q: string): string[] {
  const t = usable(q);
  if (!t) return [...recent];
  return [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
}

const zDocHit = z.object({
  id: z.string(),
  orgId: z.string(),
  title: z.string(),
  channel: z.object({ id: z.string(), name: z.string().nullable() }).nullable().optional(),
  snippet: z.string().nullable().optional(),
  updatedAt: z.number(),
});
const page = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), next: z.string().nullable() }).optional();
const zResults = z.object({
  results: z.object({
    people: page(zMember),
    channels: page(zConversation.extend({ orgName: z.string().nullable().optional() })),
    workspaces: page(z.object({ id: z.string(), name: z.string(), myRole: z.string().nullable().optional() })),
    groups: page(zConversation),
    documents: page(zDocHit),
  }),
});
export type SearchResults = z.infer<typeof zResults>["results"];
export type DocHit = z.infer<typeof zDocHit>;

export async function serverSearch(engine: Engine, q: string, opts: { types: string; limit: number; cursor?: string | null; orgId?: string | null }): Promise<SearchResults> {
  const p = new URLSearchParams({ q, types: opts.types, limit: String(opts.limit) });
  if (opts.cursor) p.set("cursor", opts.cursor);
  if (opts.orgId) p.set("orgId", opts.orgId);
  return (await engine.api.json("GET", `/v1/search?${p}`, zResults)).results;
}
