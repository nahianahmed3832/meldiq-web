import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  developerCatalog,
  listApiKeys,
  listWebhooks,
  revokeApiKey,
  rotateApiKey,
  rotateWebhookSecret,
  testWebhook,
  updateWebhook,
  webhookDeliveries,
} from "../src/sync/developer";
import type { Engine } from "../src/sync/engine";
import { acceptInvite, createChannel, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";

/** API keys and webhooks (android round 7 C6, server docs/DEVELOPER_API.md) managed from the browser. */
let server: Server;
let ann: Phone;
let bo: Phone;
let annWeb: Engine;
let boWeb: Engine;
let orgId: string;
let round7 = false;
const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  );
/** What a workspace's own tool sees calling the external API with [token]. */
const ext = async (token: string, path: string, init: RequestInit = {}) => {
  const res = await fetch(`${server.baseUrl}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
};

beforeAll(async () => {
  // A synthetic sealing key for this run only; deliveries stay queued (no tick), so nothing leaves the machine.
  server = await startServer({ WORKFLOW_TICK_MS: "0", INTEGRATIONS_TOKEN_KEY: randomBytes(32).toString("base64") });
  round7 = (await serverFeatures(server)).includes("developer-api");
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(annWeb, "Tools Co", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("API keys", () => {
  it("a key is shown once, works only for its scopes and only on /ext, posts once per idempotency key, and stops when rotated or revoked", async (t) => {
    if (!round7) return t.skip();
    const cat = await developerCatalog(annWeb);
    expect(cat.scopes).toEqual(expect.arrayContaining(["workspace:read", "updates:write"]));
    expect((await fail(listApiKeys(boWeb, orgId)))?.status).toBe(403);

    const made = await createApiKey(annWeb, orgId, { name: "CI", scopes: ["workspace:read", "updates:write"], expiresInDays: 30 });
    expect(made.token.startsWith("mdq.")).toBe(true);
    expect(made.token.endsWith(made.key.hint)).toBe(true);
    const listed = await listApiKeys(annWeb, orgId);
    expect(listed.map((k) => [k.name, k.revoked, k.ownerAllowed])).toEqual([["CI", false, true]]);
    expect(JSON.stringify(listed)).not.toContain(made.token);

    expect(await ext(made.token, "/ext/v1/workspace")).toMatchObject({ status: 200, body: { workspace: { name: "Tools Co", memberCount: 2 } } });
    expect((await ext(made.token, "/ext/v1/members")).status).toBe(403);
    expect((await ext(made.token, `/v1/orgs/${orgId}`)).status).toBe(401);

    const ch = await createChannel(annWeb, orgId, { name: "builds", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" });
    const post = () => ext(made.token, `/ext/v1/channels/${ch.id}/updates`, { method: "POST", headers: { "idempotency-key": "build-42" }, body: JSON.stringify({ title: "Build 42 passed" }) });
    expect((await post()).body).toEqual({ posted: true });
    expect((await post()).body).toEqual({ posted: false });

    const rotated = await rotateApiKey(annWeb, orgId, made.key.id);
    expect(rotated.token).not.toBe(made.token);
    expect((await ext(made.token, "/ext/v1/workspace")).status).toBe(401);
    expect((await ext(rotated.token, "/ext/v1/workspace")).status).toBe(200);
    await revokeApiKey(annWeb, orgId, rotated.key.id);
    expect((await ext(rotated.token, "/ext/v1/workspace")).status).toBe(401);
    expect((await listApiKeys(annWeb, orgId)).every((k) => k.revoked)).toBe(true);
  });
});

describe("webhooks", () => {
  it("public https addresses only; a new webhook and a test send a ping; off, edit, new secret, delete", async (t) => {
    if (!round7) return t.skip();
    for (const url of ["http://hooks.example.com/x", "https://localhost/x", "https://user:pw@hooks.example.com/x", "https://10.0.0.5/x"]) {
      expect((await fail(createWebhook(annWeb, orgId, { name: "Bad", url, events: ["member.joined"] })))?.status).toBe(400);
    }
    expect((await fail(createWebhook(boWeb, orgId, { name: "Mine", url: "https://hooks.example.com/bo", events: ["member.joined"] })))?.status).toBe(403);

    const { webhook, secret } = await createWebhook(annWeb, orgId, { name: "Ops", url: "https://hooks.example.com/meldiq", events: ["member.joined", "channel.created"] });
    expect(secret.startsWith("whsec_")).toBe(true);
    expect(JSON.stringify(await listWebhooks(annWeb, orgId))).not.toContain(secret);
    expect((await webhookDeliveries(annWeb, orgId, webhook.id)).map((d) => [d.event, d.state])).toEqual([["ping", "queued"]]);
    await testWebhook(annWeb, orgId, webhook.id);
    expect((await webhookDeliveries(annWeb, orgId, webhook.id)).filter((d) => d.event === "ping")).toHaveLength(2);

    const off = await updateWebhook(annWeb, orgId, webhook.id, { name: "Ops", url: webhook.url, events: ["member.joined"], enabled: false });
    expect([off.enabled, off.events]).toEqual([false, ["member.joined"]]);
    const fresh = await rotateWebhookSecret(annWeb, orgId, webhook.id);
    expect(fresh.startsWith("whsec_") && fresh !== secret).toBe(true);
    await deleteWebhook(annWeb, orgId, webhook.id);
    expect(await listWebhooks(annWeb, orgId)).toEqual([]);
  });
});
