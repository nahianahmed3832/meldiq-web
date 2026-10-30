import { z } from "zod";
import {
  type BotCategory,
  type BotDirectoryPage,
  type BotListing,
  type BoostTier,
  type DiscoverListing,
  type DiscoverySettings,
  type OwnTemplate,
  type PromoteView,
  type TemplatePreview,
  zBotDirectoryPage,
  zBotListingOut,
  zCheckout,
  zDiscoverListing,
  zDiscoverySettings,
  zOwnTemplateOut,
  zPromoteView,
  zTemplatePreviewOut,
} from "../../api/discoverySchemas";
import type { Engine } from "../engine";
import { DISCOVERY_LIMITS } from "./rules";

/**
 * Discovery from the browser (community parity batch E; server docs/COMMUNITY_PARITY_API.md › Discovery): Discover's
 * list and its clicks, a community's Discovery settings, Promote, templates made from a community, and the community
 * bot directory with a bot owner's listing. Every change is checked by the server again.
 */

const enc = encodeURIComponent;

export interface DiscoverQuery {
  q?: string;
  tag?: string | null;
  cursor?: number;
}

/** The query string for a Discover page: only what's set, trimmed to the server's limits. */
export function discoverParams({ q = "", tag = null, cursor = 0 }: DiscoverQuery): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim().slice(0, DISCOVERY_LIMITS.query));
  if (tag?.trim()) params.set("tag", tag.trim().slice(0, DISCOVERY_LIMITS.tag));
  if (cursor) params.set("cursor", String(cursor));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function discoverListing(engine: Engine, query: DiscoverQuery): Promise<DiscoverListing> {
  return engine.api.json("GET", `/v1/discover${discoverParams(query)}`, zDiscoverListing);
}

/** Someone opened a card: counted for its Promoted week, so a join after it counts too. Never fails the open. */
export async function recordDiscoverClick(engine: Engine, orgId: string): Promise<void> {
  try {
    await engine.api.json("POST", `/v1/discover/${enc(orgId)}/click`, z.object({ recorded: z.boolean() }));
  } catch {
    /* a statistic only: the preview opens either way */
  }
}

// ───────────── a community's Discovery settings ─────────────

export interface DiscoveryChange {
  discoverable?: boolean;
  description?: string | null;
  tags?: string[];
}

export function discoverySettings(engine: Engine, orgId: string): Promise<DiscoverySettings> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/discovery`, zDiscoverySettings);
}

export function saveDiscoverySettings(engine: Engine, orgId: string, change: DiscoveryChange): Promise<DiscoverySettings> {
  return engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/discovery`, zDiscoverySettings, { body: change });
}

// ───────────── Promote ─────────────

export function promoteView(engine: Engine, orgId: string): Promise<PromoteView> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/promote`, zPromoteView);
}

/** The checkout page's address (503 billing_unavailable while Meldiq takes no payments). */
export async function buyBoost(engine: Engine, orgId: string, tier: BoostTier): Promise<string> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/promote/boost`, zCheckout, { body: { tier } })).url;
}

/** Books the next free Promoted week (or [weekStart]); the checkout page's address. */
export async function bookPromoted(engine: Engine, orgId: string, weekStart?: number): Promise<string> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/promote/promoted`, zCheckout, { body: weekStart ? { weekStart } : {} })).url;
}

// ───────────── templates from a community ─────────────

export async function ownTemplate(engine: Engine, orgId: string): Promise<OwnTemplate | null> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/templates`, zOwnTemplateOut)).template;
}

export async function createTemplate(engine: Engine, orgId: string, name?: string): Promise<OwnTemplate | null> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/templates`, zOwnTemplateOut, { body: name?.trim() ? { name: name.trim() } : {} })).template;
}

/** Copies the community again under the same code. */
export async function syncTemplate(engine: Engine, orgId: string): Promise<OwnTemplate | null> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/templates/sync`, zOwnTemplateOut)).template;
}

/** The link stops working. */
export async function deleteTemplate(engine: Engine, orgId: string): Promise<void> {
  await engine.api.json("DELETE", `/v1/orgs/${enc(orgId)}/templates`, z.object({ deleted: z.boolean() }));
}

export async function templatePreview(engine: Engine, code: string): Promise<TemplatePreview> {
  return (await engine.api.json("GET", `/v1/templates/${enc(code)}`, zTemplatePreviewOut)).template;
}

// ───────────── community bot directory ─────────────

export type BotSort = "most_used" | "newest" | "a_z";

export interface BotDirectoryQuery {
  q?: string;
  category?: BotCategory | null;
  sort?: BotSort;
  cursor?: number;
}

export function botDirectoryParams({ q = "", category = null, sort = "most_used", cursor = 0 }: BotDirectoryQuery): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim().slice(0, DISCOVERY_LIMITS.query));
  if (category) params.set("category", category);
  params.set("sort", sort);
  if (cursor) params.set("cursor", String(cursor));
  return `?${params.toString()}`;
}

export function botDirectory(engine: Engine, query: BotDirectoryQuery): Promise<BotDirectoryPage> {
  return engine.api.json("GET", `/v1/bot-directory${botDirectoryParams(query)}`, zBotDirectoryPage);
}

export async function botListing(engine: Engine, botId: string): Promise<BotListing> {
  return (await engine.api.json("GET", `/v2/developer/bots/${enc(botId)}/listing`, zBotListingOut)).listing;
}

export async function saveBotListing(engine: Engine, botId: string, listing: { listed: boolean; category: BotCategory; description: string }): Promise<BotListing> {
  return (await engine.api.json("PUT", `/v2/developer/bots/${enc(botId)}/listing`, zBotListingOut, { body: { ...listing, description: listing.description.trim() } })).listing;
}
