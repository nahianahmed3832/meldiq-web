import { z } from "zod";
import type { Engine } from "./engine";

/**
 * API keys and outgoing webhooks for a workspace (server docs/DEVELOPER_API.md, android round 7 slice C6), managed by
 * people with `developers.manage`. A key's token and a webhook's signing secret come back once, when made: the web keeps
 * them only in the dialog that shows them, never in storage or logs. Every rule is the server's.
 */
const enc = encodeURIComponent;

/** Key lengths the phone offers (the server allows 1–365 days). */
export const KEY_DAYS = [30, 90, 365] as const;

export const SCOPE_LABEL: Record<string, string> = {
  "workspace:read": "Read the workspace's name and size",
  "members:read": "Read names, usernames, roles and titles",
  "channels:read": "Read public and announcement channels",
  "documents:read": "Read documents shared with the whole workspace",
  "meetings:read": "Read upcoming meetings in rooms that aren't private",
  "updates:write": "Post updates into public channels",
};

const zCatalog = z.object({
  scopes: z.array(z.string()),
  events: z.array(z.string()),
  limits: z.object({ keysPerOrg: z.number(), webhooksPerOrg: z.number(), keyMaxDays: z.number(), keyRatePerMinute: z.number() }).partial().passthrough(),
});
export type DeveloperCatalog = z.infer<typeof zCatalog>;

const zWho = z.object({ id: z.string(), name: z.string().nullable() });
const zKey = z.object({
  id: z.string(),
  name: z.string(),
  hint: z.string(),
  scopes: z.array(z.string()),
  createdBy: zWho,
  createdAt: z.number(),
  expiresAt: z.number(),
  lastUsedAt: z.number().nullable(),
  revoked: z.boolean(),
  expired: z.boolean(),
  ownerAllowed: z.boolean(),
});
export type ApiKey = z.infer<typeof zKey>;
const zKeyMade = z.object({ key: zKey, token: z.string() });
export type KeyMade = z.infer<typeof zKeyMade>;

const zHook = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  disabledReason: z.string().nullable(),
  verified: z.boolean(),
  consecutiveFailures: z.number(),
  deliveries: z.object({ delivered: z.number(), failed: z.number(), waiting: z.number() }),
  createdBy: zWho,
  createdAt: z.number(),
  ownerAllowed: z.boolean(),
});
export type Webhook = z.infer<typeof zHook>;
export interface WebhookInput {
  name: string;
  url: string;
  events: string[];
}

const zDelivery = z.object({
  id: z.string(),
  eventId: z.string(),
  event: z.string(),
  state: z.string(),
  attempts: z.number(),
  lastStatus: z.number().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  deliveredAt: z.number().nullable(),
});
export type WebhookDelivery = z.infer<typeof zDelivery>;

export async function developerCatalog(engine: Engine): Promise<DeveloperCatalog> {
  return engine.api.json("GET", "/v1/developer/catalog", zCatalog);
}

// ───────────── API keys ─────────────

export async function listApiKeys(engine: Engine, orgId: string): Promise<ApiKey[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/api-keys`, z.object({ keys: z.array(zKey) }))).keys;
}
/** The token (`mdq.<id>.<secret>`) is in the answer this once; Meldiq keeps only a hash of it. */
export async function createApiKey(engine: Engine, orgId: string, input: { name: string; scopes: string[]; expiresInDays: number }): Promise<KeyMade> {
  return engine.api.json("POST", `/v1/orgs/${enc(orgId)}/api-keys`, zKeyMade, { body: input });
}
/** A new key with the same name and scopes; the old one stops at once. */
export async function rotateApiKey(engine: Engine, orgId: string, id: string): Promise<KeyMade> {
  return engine.api.json("POST", `/v1/orgs/${enc(orgId)}/api-keys/${enc(id)}/rotate`, zKeyMade, { body: {} });
}
export async function revokeApiKey(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/api-keys/${enc(id)}`);
}

// ───────────── Webhooks ─────────────

export async function listWebhooks(engine: Engine, orgId: string): Promise<Webhook[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/webhooks`, z.object({ webhooks: z.array(zHook) }))).webhooks;
}
/** Sends the new webhook a signed `ping`; its signing secret is in the answer this once. */
export async function createWebhook(engine: Engine, orgId: string, input: WebhookInput): Promise<{ webhook: Webhook; secret: string }> {
  return engine.api.json("POST", `/v1/orgs/${enc(orgId)}/webhooks`, z.object({ webhook: zHook, secret: z.string() }), { body: input });
}
/** Turning a paused webhook back on resets its failure count. */
export async function updateWebhook(engine: Engine, orgId: string, id: string, input: WebhookInput & { enabled: boolean }): Promise<Webhook> {
  return (await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/webhooks/${enc(id)}`, z.object({ webhook: zHook }), { body: input })).webhook;
}
export async function rotateWebhookSecret(engine: Engine, orgId: string, id: string): Promise<string> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/webhooks/${enc(id)}/rotate-secret`, z.object({ secret: z.string() }), { body: {} })).secret;
}
export async function testWebhook(engine: Engine, orgId: string, id: string): Promise<Webhook> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/webhooks/${enc(id)}/test`, z.object({ webhook: zHook }), { body: {} })).webhook;
}
export async function webhookDeliveries(engine: Engine, orgId: string, id: string): Promise<WebhookDelivery[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/webhooks/${enc(id)}/deliveries`, z.object({ deliveries: z.array(zDelivery) }))).deliveries;
}
export async function deleteWebhook(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/webhooks/${enc(id)}`);
}

// ───────────── Rules shown before saving (the server checks them again) ─────────────

/** What's wrong with a webhook address, as the server words it; null when it may be saved. */
export function webhookUrlProblem(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "That isn't a valid address";
  }
  if (u.protocol !== "https:") return "Webhook addresses must start with https://";
  if (u.username || u.password) return "Put credentials in the signing secret, not the address";
  if (url.length > 1000) return "That address is too long";
  const host = u.hostname.replace(/^\[(.*)\]$/, "$1");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return "Webhooks can't be sent to private or local addresses";
  return null;
}

/** A key's state in a word or two: revoked, expired, its creator lost the right, or when it expires. */
export function keyState(k: ApiKey, day: (ms: number) => string): string {
  if (k.revoked) return "Revoked";
  if (k.expired) return "Expired";
  if (!k.ownerAllowed) return "Not working: its creator can't manage developer access any more";
  return `Expires ${day(k.expiresAt)}`;
}
