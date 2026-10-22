import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { appDirectory, channelAppEvents, createWebhook, deleteWebhook, installApp, rotateWebhook, setAppEnabled, webhooks } from "../src/sync/apps";
import type { Engine } from "../src/sync/engine";
import { assignRole, auditLog, createRole, deleteRole, roleMembers, rolesOverview, transferOwnership, unassignRole, updateRole } from "../src/sync/roles";
import { workspacePlan, workspaceUsage } from "../src/sync/usage";
import { acceptInvite, changeMember, createChannel, createInvitation, createWorkspace, requestId, workspaceDetail } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Custom roles, the audit log, ownership transfer, the app directory and incoming webhooks from the browser against the
 * real server (docs/WORKSPACE_ROLES.md, docs/INTEGRATIONS.md): what the browser shows comes from the server's answers,
 * and everything a member may not do is refused there.
 */
const PUBLIC = "http://meldiq.test";
let server: Server;
let owner: Phone;
let bob: Phone;
let web: Engine;
let bobWeb: Engine;
let orgId: string;
const NAME = "Roles Studio";

beforeAll(async () => {
  server = await startServer({
    INTEGRATIONS_SANDBOX: "on",
    INTEGRATIONS_PUBLIC_URL: PUBLIC,
    INTEGRATIONS_TOKEN_KEY: nodeCrypto.randomBytes(32).toString("base64"),
  });
  owner = await server.client("owner", "Olivia Owner");
  bob = await server.client("bob", "Bob");
  web = (await linkBrowser(server, owner)).engine;
  bobWeb = (await linkBrowser(server, bob)).engine;
  orgId = (await createWorkspace(web, NAME, null, requestId())).id;
  await acceptInvite(bobWeb, (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  web?.stop();
  bobWeb?.stop();
  await server?.close();
});

const fail = async (p: Promise<unknown>): Promise<ApiError> => {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
};
const effective = async (e: Engine) => (await workspaceDetail(e, orgId)).permissions.effective ?? [];

describe("custom roles", () => {
  it("lists the catalog for owners, creates from a template, grants exactly its permissions and takes them back", async () => {
    const overview = await rolesOverview(web, orgId);
    expect(overview.me).toMatchObject({ base: "OWNER", canManage: true });
    expect(overview.catalog.some((p) => p.key === "channels.manage")).toBe(true);
    expect(overview.templates.map((t) => t.key)).toContain("moderator");
    // A member can't see or make roles.
    expect((await fail(createRole(bobWeb, orgId, { name: "Self-made", permissions: [] }))).status).toBe(403);

    const mod = await createRole(web, orgId, { template: "moderator" });
    expect(mod.permissions).toContain("channels.manage");
    expect(await effective(bobWeb)).not.toContain("channels.manage");
    await assignRole(web, mod.id, bob.userId);
    expect(await effective(bobWeb)).toContain("channels.manage");
    expect((await roleMembers(web, mod.id)).map((m) => m.id)).toEqual([bob.userId]);
    await unassignRole(web, mod.id, bob.userId);
    expect(await effective(bobWeb)).not.toContain("channels.manage");
  });

  it("edits on the role's revision: a stale one is refused; only an archived role can be deleted", async () => {
    const r = await createRole(web, orgId, { name: "Reviewers", permissions: ["channels.create"] });
    const renamed = await updateRole(web, r, { name: "Design reviewers" });
    expect(renamed.rev).toBeGreaterThan(r.rev);
    const stale = await fail(updateRole(web, r, { name: "Late" }));
    expect([stale.status, stale.code]).toEqual([409, "stale"]);
    expect((await fail(deleteRole(web, r.id))).status).toBe(409);
    const archived = await updateRole(web, renamed, { archived: true });
    expect(archived.archived).toBe(true);
    await deleteRole(web, r.id);
    expect((await rolesOverview(web, orgId, true)).roles.some((x) => x.id === r.id)).toBe(false);
  });

  it("the audit log shows the role changes, newest first", async () => {
    const page = await auditLog(web, orgId, null, "role");
    expect(page.entries.every((e) => e.action.startsWith("role."))).toBe(true);
    expect(page.entries.map((e) => e.action)).toEqual(expect.arrayContaining(["role.create", "role.assign", "role.unassign", "role.archive", "role.delete"]));
    expect([...page.entries].sort((a, b) => b.id - a.id)).toEqual(page.entries);
    expect((await fail(auditLog(bobWeb, orgId))).status).toBe(403);
  });
});

describe("ownership", () => {
  it("needs the exact workspace name; the previous owner stays as an admin and can be handed it back", async () => {
    expect((await fail(transferOwnership(bobWeb, orgId, bob.userId, NAME))).status).toBe(403);
    expect((await fail(transferOwnership(web, orgId, bob.userId, NAME.toLowerCase()))).status).toBe(400);
    await transferOwnership(web, orgId, bob.userId, NAME);
    expect((await workspaceDetail(bobWeb, orgId)).permissions.isOwner).toBe(true);
    expect((await workspaceDetail(web, orgId)).permissions.isOwner).toBe(false);
    await transferOwnership(bobWeb, orgId, owner.userId, NAME);
    expect((await workspaceDetail(web, orgId)).permissions.isOwner).toBe(true);
    expect((await workspaceDetail(bobWeb, orgId)).org.myRole).toBe("ADMIN");
    await changeMember(web, orgId, bob.userId, { role: "MEMBER" });
  });
});

describe("apps and incoming webhooks", () => {
  it("installs incoming webhooks, posts into a channel with the secret, and the browser hears of it at once", async (t) => {
    // Apps and webhooks were retired with the community rebuild (API 0.12): servers since then don't offer them.
    if (!(await serverFeatures(server)).includes("integrations")) return t.skip();
    const dir = await appDirectory(web, orgId);
    expect(dir.permissions.canInstall).toBe(true);
    expect(dir.apps.some((a) => a.id === "incoming-webhooks")).toBe(true);
    expect((await appDirectory(bobWeb, orgId)).permissions.canInstall).toBe(false);

    const ch = await createChannel(web, orgId, { name: "builds", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" });
    // The connector has to be installed first.
    expect((await fail(createWebhook(web, orgId, ch.id, "CI"))).status).toBe(409);
    await installApp(web, orgId, "incoming-webhooks");
    expect((await fail(createWebhook(bobWeb, orgId, ch.id, "Rogue"))).status).toBe(403);
    const { hook, secret } = await createWebhook(web, orgId, ch.id, "Jenkins");
    expect(JSON.stringify(await webhooks(web, orgId))).not.toContain(secret);

    const post = (s: string, body: object) =>
      fetch(hook.url.replace(PUBLIC, server.baseUrl), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s}` }, body: JSON.stringify(body) });
    const before = web.state.get().appEventsRev[ch.id] ?? 0;
    expect((await post(secret, { title: "Build #42 passed", text: "main · 3m 12s", url: "https://ci.example.com/42", actor: "jenkins" })).status).toBe(202);
    await until(() => (web.state.get().appEventsRev[ch.id] ?? 0) > before, 8000, "integration.event in the browser");
    expect((await channelAppEvents(web, ch.id))[0]).toMatchObject({ title: "Build #42 passed", summary: "main · 3m 12s", actor: "jenkins" });

    // A rotated secret replaces the old one; a turned-off app takes no posts.
    const rotated = await rotateWebhook(web, orgId, hook.id);
    expect((await post(secret, { title: "old secret" })).status).toBe(401);
    await setAppEnabled(web, orgId, "incoming-webhooks", false);
    expect((await post(rotated.secret, { title: "while off" })).status).not.toBe(202);
    await setAppEnabled(web, orgId, "incoming-webhooks", true);
    expect((await post(rotated.secret, { title: "back on" })).status).toBe(202);
    await deleteWebhook(web, orgId, hook.id);
    expect(await webhooks(web, orgId)).toEqual([]);
  });
});

describe("usage and limits", () => {
  it("counts the workspace for those allowed to see usage; every member sees the plan and its limits", async () => {
    const u = await workspaceUsage(web, orgId);
    expect(u.members).toMatchObject({ total: 2, owners: 1, members: 1 });
    expect(u.structure.channels).toBeGreaterThanOrEqual(1);
    if ((await serverFeatures(server)).includes("integrations")) expect(u.apps?.installed).toBe(1);
    else {
      // Community servers: no apps any more, and categories counted instead of branches and teams.
      expect(u.apps).toBeUndefined();
      expect(u.structure.categories).toBeGreaterThanOrEqual(0);
    }
    expect((await workspaceDetail(web, orgId)).permissions.canViewUsage).toBe(true);
    expect((await workspaceDetail(bobWeb, orgId)).permissions.canViewUsage).toBe(false);
    expect((await fail(workspaceUsage(bobWeb, orgId))).status).toBe(403);
    const plan = await workspacePlan(bobWeb, orgId);
    expect(plan.plan).toBeNull();
    expect(plan.capabilities.some((c) => c.key === "roles.custom")).toBe(true);
  });
});

describe("channel access (android round 7, bug 6)", () => {
  it("a public channel from the browser reaches every member at once, and people who join later", async () => {
    const ch = await createChannel(web, orgId, { name: "everyone-sees-this", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" });
    // Bob was already a member: the channel shows up in his browser without him joining it.
    await until(() => bobWeb.state.get().conversations[ch.id]?.joined === true, 8000, "Bob auto-joined");
    // Someone who joins the workspace afterwards gets it too.
    const cleo = await server.client("cleo", "Cleo");
    await cleo.req("POST", "/v1/invites/accept", { code: (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code });
    const list = (await cleo.req("GET", "/v1/conversations")).conversations as { id: string }[];
    expect(list.some((c) => c.id === ch.id)).toBe(true);
    // A private channel stays invite-only.
    const priv = await createChannel(web, orgId, { name: "leads-only", topic: null, scope: "ORG", scopeId: null, kind: "PRIVATE" });
    expect(((await cleo.req("GET", "/v1/conversations")).conversations as { id: string }[]).some((c) => c.id === priv.id)).toBe(false);
  });
});
