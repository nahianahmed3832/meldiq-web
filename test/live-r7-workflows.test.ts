import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { channelAppEvents } from "../src/sync/apps";
import type { Engine } from "../src/sync/engine";
import { createWorkflow, deleteWorkflow, fromTemplate, listWorkflows, testWorkflow, updateWorkflow, inputOf, workflowCatalog, workflowRuns } from "../src/sync/workflows";
import { acceptInvite, createChannel, createInvitation, createWorkspace, requestId, workspaceDetail } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/** Workflows (android round 7 C3, server docs/WORKFLOWS.md) from the browser against the round 7 server. */
let server: Server;
let owner: Phone;
let bo: Phone;
let web: Engine;
let boWeb: Engine;
let orgId: string;
let round7 = false;

beforeAll(async () => {
  server = await startServer({ WORKFLOW_TICK_MS: "200" });
  round7 = (await serverFeatures(server)).includes("workflows");
  owner = await server.client("olivia", "Olivia");
  bo = await server.client("bo", "Bo");
  web = (await linkBrowser(server, owner)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(web, "Flow Lab", null, requestId())).id;
});
afterAll(async () => {
  web?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("workflows", () => {
  it("a template saved from the browser runs on the next new member: added to the channel and greeted there", async (t) => {
    if (!round7) return t.skip();
    expect((await workspaceDetail(web, orgId)).permissions.canManageWorkflows).toBe(true);
    const ch = await createChannel(web, orgId, { name: "welcome", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" });
    const { catalog, templates } = await workflowCatalog(web, orgId);
    expect(catalog.triggers.map((x) => x.type)).toContain("member.joined");
    const welcome = templates.find((x) => x.id === "welcome")!;
    const input = fromTemplate(welcome, ch.id, "2026-10-20", "UTC");
    const dry = await testWorkflow(web, orgId, input);
    expect(dry.outcomes.every((o) => o.status === "would_run")).toBe(true);
    const wf = await createWorkflow(web, orgId, input);

    await acceptInvite(boWeb, (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
    await until(async () => (await workflowRuns(web, orgId, wf.id))[0]?.state === "done", 10_000, "the run finished");
    const run = (await workflowRuns(web, orgId, wf.id))[0];
    expect(run.outcomes.map((o) => o.status)).toEqual(["done", "done"]);
    await until(async () => (await channelAppEvents(boWeb, ch.id)).some((e) => e.summary?.includes("Bo") || e.title.includes("Bo")), 10_000, "greeting in the channel");
  });

  it("a member can't manage workflows; a stale revision is refused; delete removes it", async (t) => {
    if (!round7) return t.skip();
    const refused = await listWorkflows(boWeb, orgId).catch((e: unknown) => e);
    expect((refused as ApiError).status).toBe(403);
    const [wf] = await listWorkflows(web, orgId);
    const renamed = await updateWorkflow(web, orgId, wf.id, wf.rev, { ...inputOf(wf), name: "Welcome everyone" });
    expect(renamed.rev).toBeGreaterThan(wf.rev);
    const stale = await updateWorkflow(web, orgId, wf.id, wf.rev, { ...inputOf(wf), enabled: false }).catch((e: unknown) => e);
    expect((stale as ApiError).status).toBe(409);
    await deleteWorkflow(web, orgId, wf.id);
    expect(await listWorkflows(web, orgId)).toEqual([]);
  });
});
