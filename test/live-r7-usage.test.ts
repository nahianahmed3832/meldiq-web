import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { createApiKey } from "../src/sync/developer";
import type { Engine } from "../src/sync/engine";
import { adminUsage, setWorkspaceLimits, workspacePlan, workspaceUsage } from "../src/sync/usage";
import { createGroup } from "../src/sync/workspaceC5";
import { acceptInvite, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { makePlatformAdmin, serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";

/** Usage metering and plan limits (android round 7 C7, server docs/USAGE_AND_PLANS.md) from the browser. */
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

beforeAll(async () => {
  server = await startServer({ WORKFLOW_TICK_MS: "0" });
  round7 = (await serverFeatures(server)).includes("developer-api");
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(annWeb, "Meter Co", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
  makePlatformAdmin(server, ann.userId);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("usage metering", () => {
  it("the Usage screen gets 30 measured days: members today, and each external API request counted", async (t) => {
    if (!round7) return t.skip();
    const { token } = await createApiKey(annWeb, orgId, { name: "Meter", scopes: ["workspace:read"], expiresInDays: 30 });
    for (let i = 0; i < 3; i++) expect((await fetch(`${server.baseUrl}/ext/v1/workspace`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
    const m = (await workspaceUsage(annWeb, orgId)).metered!;
    expect(m.days).toBe(30);
    const of = (k: string) => m.metrics.find((x) => x.metric === k)!;
    expect(of("seats.members")).toMatchObject({ kind: "gauge", total: 2 });
    expect(of("api.requests")).toMatchObject({ kind: "counter", total: 3 });
    expect(of("api.requests").daily).toHaveLength(30);
    expect((await fail(workspaceUsage(boWeb, orgId)))?.status).toBe(403);
  });
});

describe("plan limits", () => {
  it("only platform admins set a workspace's own limits; the server refuses adding past one and says where it comes from", async (t) => {
    if (!round7) return t.skip();
    expect((await fail(adminUsage(boWeb, 30)))?.status).toBe(403);
    expect((await fail(setWorkspaceLimits(boWeb, orgId, { groups: 1 })))?.status).toBe(403);
    const all = await adminUsage(annWeb, 30);
    expect(all.workspaces.find((w) => w.id === orgId)).toMatchObject({ name: "Meter Co", limits: [] });

    expect(await setWorkspaceLimits(annWeb, orgId, { groups: 1 })).toEqual([{ key: "groups", limit: 1 }]);
    expect((await workspacePlan(annWeb, orgId)).capabilities.find((c) => c.key === "groups")).toMatchObject({ limit: 1, used: 0, source: "workspace" });
    await createGroup(annWeb, orgId, { name: "One", description: null, memberIds: [] });
    const refused = await fail(createGroup(annWeb, orgId, { name: "Two", description: null, memberIds: [] }));
    expect([refused?.status, refused?.code]).toEqual([409, "limit_reached"]);
    expect((await fail(setWorkspaceLimits(annWeb, orgId, { "not.a.limit": 1 })))?.status).toBe(400);

    expect(await setWorkspaceLimits(annWeb, orgId, { groups: null })).toEqual([]);
    expect((await workspacePlan(annWeb, orgId)).capabilities.find((c) => c.key === "groups")?.limit).toBeNull();
    await createGroup(annWeb, orgId, { name: "Two", description: null, memberIds: [] });
  });
});
