import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Apps and integrations (server docs/INTEGRATIONS.md, API 0.6+): the workspace's app directory with each app's state for
 * this person and the actions the server allows them, installing, requesting, approving and configuring apps, incoming
 * webhooks and workflows. Credentials never reach the browser; the server checks every rule on every call.
 */
const zCapability = z.object({
  key: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  kind: z.string().optional(),
  accountType: z.string().optional(),
  granted: z.boolean().default(false),
  requested: z.boolean().default(false),
});
const zApp = z.object({
  id: z.string(),
  name: z.string(),
  publisher: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  featured: z.boolean().optional(),
  availability: z.string().nullable().optional(),
  state: z.string(),
  actions: z.array(z.string()).default([]),
  capabilities: z.array(zCapability).default([]),
  installState: z.string().nullable().optional(),
  myAccount: z.object({ status: z.string().optional(), displayName: z.string().nullable().optional(), login: z.string().nullable().optional() }).passthrough().nullable().optional(),
});
export type App = z.infer<typeof zApp>;
const zDirectory = z.object({
  apps: z.array(zApp),
  permissions: z.object({
    canInstall: z.boolean(),
    canRequest: z.boolean(),
    canConfigure: z.boolean(),
    canConnect: z.boolean(),
    canUninstall: z.boolean(),
    canViewActivity: z.boolean().default(false),
  }),
});
export type AppDirectory = z.infer<typeof zDirectory>;
const zDetail = z.object({ install: z.object({ rev: z.number(), enabled: z.boolean().optional() }).passthrough().nullable().optional() }).passthrough();

const zHook = z.object({
  id: z.string(),
  name: z.string(),
  conversationId: z.string(),
  channelName: z.string().nullable(),
  url: z.string(),
  active: z.boolean(),
  lastDeliveryAt: z.number().nullable().optional(),
  lastError: z.string().nullable().optional(),
});
export type Hook = z.infer<typeof zHook>;
const zWorkflow = z
  .object({
    id: z.string().optional(),
    trigger: z.string().optional(),
    action: z.string().optional(),
    owner: z.string().nullable().optional(),
    lastRunAt: z.number().nullable().optional(),
    problem: z.string().nullable().optional(),
  })
  .passthrough();
export type Workflow = z.infer<typeof zWorkflow>;

const enc = encodeURIComponent;
const base = (orgId: string) => `/v1/orgs/${enc(orgId)}`;

export async function appDirectory(engine: Engine, orgId: string): Promise<AppDirectory> {
  return engine.api.json("GET", `${base(orgId)}/integrations`, zDirectory);
}

/** Install with the least-privilege capabilities the server preselects (or those given). */
export async function installApp(engine: Engine, orgId: string, appId: string, capabilities?: string[]): Promise<void> {
  await engine.api.call("POST", `${base(orgId)}/integrations/${enc(appId)}/install`, { body: capabilities ? { capabilities } : {} });
}

export async function requestApp(engine: Engine, orgId: string, appId: string, note: string | null): Promise<void> {
  await engine.api.call("POST", `${base(orgId)}/integrations/${enc(appId)}/request`, { body: { note } });
}

export async function declineApp(engine: Engine, orgId: string, appId: string): Promise<void> {
  await engine.api.call("POST", `${base(orgId)}/integrations/${enc(appId)}/decline`, { body: {} });
}

/** Turns an installed app off or on again, on its current revision. */
export async function setAppEnabled(engine: Engine, orgId: string, appId: string, enabled: boolean): Promise<void> {
  const detail = await engine.api.json("GET", `${base(orgId)}/integrations/${enc(appId)}`, zDetail);
  const rev = detail.install?.rev;
  if (!rev) throw new Error("This app isn't installed.");
  await engine.api.call("PATCH", `${base(orgId)}/integrations/${enc(appId)}`, { body: { baseRev: rev, enabled } });
}

export async function uninstallApp(engine: Engine, orgId: string, appId: string): Promise<void> {
  await engine.api.call("DELETE", `${base(orgId)}/integrations/${enc(appId)}`);
}

export async function webhooks(engine: Engine, orgId: string): Promise<Hook[]> {
  return (await engine.api.json("GET", `${base(orgId)}/integration-hooks`, z.object({ hooks: z.array(zHook) }))).hooks;
}

/** A new incoming webhook for a channel; its secret is returned once and never again. */
export async function createWebhook(engine: Engine, orgId: string, conversationId: string, name: string): Promise<{ hook: Hook; secret: string }> {
  return engine.api.json("POST", `${base(orgId)}/integration-hooks`, z.object({ hook: zHook, secret: z.string() }), { body: { conversationId, name } });
}

export async function rotateWebhook(engine: Engine, orgId: string, hookId: string): Promise<{ hook: Hook; secret: string }> {
  return engine.api.json("POST", `${base(orgId)}/integration-hooks/${enc(hookId)}/rotate`, z.object({ hook: zHook, secret: z.string() }), { body: {} });
}

export async function deleteWebhook(engine: Engine, orgId: string, hookId: string): Promise<void> {
  await engine.api.call("DELETE", `${base(orgId)}/integration-hooks/${enc(hookId)}`);
}

export async function workflows(engine: Engine, orgId: string): Promise<Workflow[]> {
  return (await engine.api.json("GET", `${base(orgId)}/integrations/workflows`, z.object({ workflows: z.array(zWorkflow) }))).workflows;
}

/** What each state means to the person, in the phone's words (server policy.ts connectorState). */
export const STATE_LABEL: Record<string, string> = {
  coming_soon: "Coming soon",
  needs_configuration: "Needs configuration",
  blocked: "Blocked",
  available: "Available",
  approval_required: "Waiting for approval",
  disabled: "Turned off",
  installed: "Installed",
  connected: "Connected",
  error: "Needs attention",
};

const zAppEvent = z.object({
  id: z.string(),
  appName: z.string(),
  kind: z.string().nullable().optional(),
  title: z.string(),
  url: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  actor: z.string().nullable().optional(),
  occurredAt: z.number().nullable().optional(),
  createdAt: z.number(),
});
export type AppEvent = z.infer<typeof zAppEvent>;

/** Updates apps and incoming webhooks posted into a channel (server-visible, kept 30 days, members only). */
export async function channelAppEvents(engine: Engine, conversationId: string): Promise<AppEvent[]> {
  return (await engine.api.json("GET", `/v1/conversations/${enc(conversationId)}/integration-events?limit=50`, z.object({ events: z.array(zAppEvent) }))).events;
}
