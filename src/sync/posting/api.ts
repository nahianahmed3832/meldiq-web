import { z } from "zod";
import type { Engine } from "../engine";
import type { WebhookBody } from "./draft";

/**
 * Community parity batch C on the server (docs/COMMUNITY_PARITY_API.md › Posting tools): channel webhooks and "Make a
 * post" (feature channel-webhooks), reaction roles (reaction-roles) and tickets (community-tickets). The server checks
 * every permission again; these calls only carry what the screens chose.
 */

export const POSTING_FEATURES = {
  webhooks: "channel-webhooks",
  reactionRoles: "reaction-roles",
  tickets: "community-tickets",
} as const;

const enc = encodeURIComponent;
const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const nullableTime = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

// ───────────── Webhooks ─────────────

const zWebhook = z.object({
  id: z.string(),
  channelId: z.string(),
  name: z.string(),
  /** "/v1/webhooks/:id/avatar?rev=…" (with the session), or null for the standard picture. */
  avatarUrl: nullableString,
  createdBy: z
    .object({ id: z.string(), displayName: z.string() })
    .nullish()
    .transform((v) => v ?? null),
  createdAt: z.number(),
  tokenRotatedAt: z.number(),
  lastUsedAt: nullableTime,
});
export type Webhook = z.infer<typeof zWebhook>;

const zWebhookList = z.object({ webhooks: z.array(zWebhook), limit: z.number().int().default(10) });
const zWebhookOne = z.object({ webhook: zWebhook });
const zWebhookWithToken = z.object({ webhook: zWebhook, token: z.string() });
const zPosted = z.object({ id: z.string(), channelId: z.string(), serverTs: z.number() });

const hooks = (orgId: string, channelId: string) => `/v1/orgs/${enc(orgId)}/channels/${enc(channelId)}/webhooks`;

export function listWebhooks(engine: Engine, orgId: string, channelId: string): Promise<z.infer<typeof zWebhookList>> {
  return engine.api.json("GET", hooks(orgId, channelId), zWebhookList);
}

/** A new webhook (a friendly name when [name] is left out); its token is shown this once. */
export function createWebhook(engine: Engine, orgId: string, channelId: string, name?: string): Promise<{ webhook: Webhook; token: string }> {
  return engine.api.json("POST", hooks(orgId, channelId), zWebhookWithToken, { body: name ? { name } : {} });
}

export async function renameWebhook(engine: Engine, orgId: string, channelId: string, webhookId: string, name: string): Promise<Webhook> {
  return (await engine.api.json("PATCH", `${hooks(orgId, channelId)}/${enc(webhookId)}`, zWebhookOne, { body: { name } })).webhook;
}

/** A JPEG, or an animated GIF or WebP (the community icon's rules). */
export async function setWebhookAvatar(engine: Engine, orgId: string, channelId: string, webhookId: string, image: Uint8Array): Promise<Webhook> {
  return (await engine.api.json("PUT", `${hooks(orgId, channelId)}/${enc(webhookId)}/avatar`, zWebhookOne, { raw: image })).webhook;
}

export async function removeWebhookAvatar(engine: Engine, orgId: string, channelId: string, webhookId: string): Promise<Webhook> {
  return (await engine.api.json("DELETE", `${hooks(orgId, channelId)}/${enc(webhookId)}/avatar`, zWebhookOne)).webhook;
}

/** A new address: the old one stops working at once. */
export function rotateWebhook(engine: Engine, orgId: string, channelId: string, webhookId: string): Promise<{ webhook: Webhook; token: string }> {
  return engine.api.json("POST", `${hooks(orgId, channelId)}/${enc(webhookId)}/token`, zWebhookWithToken);
}

export async function deleteWebhook(engine: Engine, orgId: string, channelId: string, webhookId: string): Promise<void> {
  await engine.api.call("DELETE", `${hooks(orgId, channelId)}/${enc(webhookId)}`);
}

/** "Make a post": the builder's JSON, posted through [webhookId]. */
export function postThroughWebhook(engine: Engine, orgId: string, channelId: string, webhookId: string, body: WebhookBody): Promise<z.infer<typeof zPosted>> {
  return engine.api.json("POST", `${hooks(orgId, channelId)}/${enc(webhookId)}/post`, zPosted, { body });
}

/** The address anyone can post to: `<API base>/v1/webhooks/<id>/<token>`. */
export function webhookAddress(apiOrigin: string, webhookId: string, token: string): string {
  return `${apiOrigin.replace(/\/+$/, "")}/v1/webhooks/${enc(webhookId)}/${enc(token)}`;
}

// ───────────── Reaction roles ─────────────

const zReactionRoles = z.object({
  messageId: z.string(),
  channelId: z.string(),
  reactionRoles: z.array(z.object({ emoji: z.string(), roleId: z.string(), roleName: z.string(), roleColor: nullableString })),
  setBy: nullableString,
  setAt: nullableTime,
});
export type ReactionRoles = z.infer<typeof zReactionRoles>;
export interface ReactionRolePair {
  emoji: string;
  roleId: string;
}

const rr = (orgId: string, channelId: string, messageId: string) => `/v1/orgs/${enc(orgId)}/channels/${enc(channelId)}/messages/${enc(messageId)}/reaction-roles`;

export function reactionRoles(engine: Engine, orgId: string, channelId: string, messageId: string): Promise<ReactionRoles> {
  return engine.api.json("GET", rr(orgId, channelId, messageId), zReactionRoles);
}

export function setReactionRoles(engine: Engine, orgId: string, channelId: string, messageId: string, pairs: ReactionRolePair[]): Promise<ReactionRoles> {
  return engine.api.json("PUT", rr(orgId, channelId, messageId), zReactionRoles, { body: { reactionRoles: pairs } });
}

/** Roles already given stay with the people who have them. */
export async function removeReactionRoles(engine: Engine, orgId: string, channelId: string, messageId: string): Promise<void> {
  await engine.api.call("DELETE", rr(orgId, channelId, messageId));
}

// ───────────── Tickets ─────────────

const zPanel = z.object({
  id: z.string(),
  name: z.string(),
  postChannelId: nullableString,
  categoryId: nullableString,
  logChannelId: nullableString,
  postedMessageId: nullableString,
});
export type TicketPanel = z.infer<typeof zPanel>;

const zTicketsConfig = z.object({
  enabled: z.boolean(),
  maxOpenPerPerson: z.number().int(),
  panels: z.array(zPanel),
  panelLimit: z.number().int().default(2),
});
export type TicketsConfig = z.infer<typeof zTicketsConfig>;

export interface TicketPanelInput {
  /** Kept when it's an existing panel; left out for a new one. */
  id?: string;
  name: string;
  postChannelId: string;
  categoryId: string | null;
  logChannelId: string | null;
}

const zPerson = z.object({ id: z.string(), username: z.string(), displayName: z.string() });
const zTicket = z.object({
  channelId: z.string(),
  number: z.number().int(),
  name: z.string(),
  panelId: nullableString,
  panelName: nullableString,
  opener: zPerson.nullish().transform((v) => v ?? null),
  about: z.string(),
  openedAt: z.number(),
  closedAt: nullableTime,
  closedBy: zPerson.nullish().transform((v) => v ?? null),
  joined: z.boolean().default(false),
});
export type Ticket = z.infer<typeof zTicket>;
const zTicketOut = z.object({ ticket: zTicket });
const zTicketList = z.object({ tickets: z.array(zTicket) });
const zPanelPosted = z.object({ messageId: z.string(), channelId: z.string() });

const tickets = (orgId: string) => `/v1/orgs/${enc(orgId)}/tickets`;

export function ticketsConfig(engine: Engine, orgId: string): Promise<TicketsConfig> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/tickets/config`, zTicketsConfig);
}

/** Saves the switch, the per-person limit and the panels; the community's view (the menu's item) follows. */
export async function saveTicketsConfig(engine: Engine, orgId: string, config: { enabled: boolean; maxOpenPerPerson: number; panels: TicketPanelInput[] }): Promise<TicketsConfig> {
  const saved = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/tickets/config`, zTicketsConfig, { body: config });
  await engine.refreshAll();
  return saved;
}

/** Posts the panel's "Open a ticket" message in its channel. */
export function postTicketPanel(engine: Engine, orgId: string, panelId: string): Promise<z.infer<typeof zPanelPosted>> {
  return engine.api.json("POST", `/v1/orgs/${enc(orgId)}/tickets/panels/${enc(panelId)}/post`, zPanelPosted);
}

export async function openTicket(engine: Engine, orgId: string, open: { panelId: string | null; about: string; notABugReport: boolean }): Promise<Ticket> {
  const { ticket } = await engine.api.json("POST", tickets(orgId), zTicketOut, {
    body: { ...(open.panelId ? { panelId: open.panelId } : {}), about: open.about, notABugReport: open.notABugReport },
  });
  await engine.refreshAll();
  return ticket;
}

/** Open tickets: all of them for moderators, the viewer's own otherwise. */
export async function openTickets(engine: Engine, orgId: string): Promise<Ticket[]> {
  return (await engine.api.json("GET", tickets(orgId), zTicketList)).tickets;
}

export async function joinTicket(engine: Engine, orgId: string, channelId: string): Promise<Ticket> {
  const { ticket } = await engine.api.json("POST", `${tickets(orgId)}/${enc(channelId)}/join`, zTicketOut);
  await engine.refreshAll();
  return ticket;
}

export async function closeTicket(engine: Engine, orgId: string, channelId: string): Promise<Ticket> {
  const { ticket } = await engine.api.json("POST", `${tickets(orgId)}/${enc(channelId)}/close`, zTicketOut);
  await engine.refreshAll();
  return ticket;
}
