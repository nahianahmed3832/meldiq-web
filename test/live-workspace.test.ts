import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
import {
  acceptInvite,
  archivedScopes,
  changeMember,
  createBranch,
  createChannel,
  createGroup,
  createInvitation,
  createTeam,
  createWorkspace,
  deleteWorkspace,
  directory,
  invitations,
  leaveWorkspace,
  previewInvite,
  removeMember,
  requestId,
  revokeInvitation,
  setTeamArchived,
  setWorkspacePhoto,
  updateConversation,
  updateWorkspace,
  workspaceChannels,
  workspaceDetail,
} from "../src/sync/workspaces";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Workspace administration from the browser against the real server (docs/WORKSPACE_ADMINISTRATION.md): what an owner
 * can do, what the server refuses others, and that other members' devices learn of each change in real time.
 */
let server: Server;
let owner: Phone;
let bob: Phone;
let web: Engine;
let bobWeb: Engine;

beforeAll(async () => {
  server = await startServer();
  owner = await server.client("owner", "Olivia Owner");
  bob = await server.client("bob", "Bob");
  web = (await linkBrowser(server, owner)).engine;
  bobWeb = (await linkBrowser(server, bob)).engine;
});
afterAll(async () => {
  web?.stop();
  bobWeb?.stop();
  await server?.close();
});

const fail = async (p: Promise<unknown>) => {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
};

describe("workspaces from the browser", () => {
  let orgId: string;

  it("creates a workspace once per form, even when the request is repeated", async () => {
    const req = requestId();
    const a = await createWorkspace(web, "Acme Design", "Studio", req);
    const b = await createWorkspace(web, "Acme Design", "Studio", req);
    expect(b.id).toBe(a.id);
    orgId = a.id;
    expect(web.state.get().orgs.map((o) => o.id)).toContain(orgId);
    const d = await workspaceDetail(web, orgId);
    expect(d.permissions).toMatchObject({ canManageOrg: true, isOwner: true, canLeave: false });
    // Another create form with the same name is refused: an owner couldn't tell the two apart.
    expect((await fail(createWorkspace(web, "acme design", null, requestId()))).code).toBe("org_name_taken");
  });

  it("invites by code: the other browser previews, joins, and both see it at once", async () => {
    const inv = await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 24 });
    expect(inv.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const preview = await previewInvite(bobWeb, inv.code.toLowerCase());
    expect(preview).toMatchObject({ org: { id: orgId, name: "Acme Design" }, role: "MEMBER", alreadyMember: false });
    await acceptInvite(bobWeb, inv.code);
    expect(bobWeb.state.get().orgs.map((o) => o.id)).toContain(orgId);
    // The owner's browser hears about the new member through org.updated, without asking.
    await until(() => web.state.get().orgs.find((o) => o.id === orgId)?.memberCount === 2, 6000, "member count update");
    const list = await invitations(web, orgId);
    expect(list[0]).toMatchObject({ status: "used_up", uses: 1, createdByName: "Olivia Owner" });
    // A used invitation can't be used again; a revoked one can't be previewed.
    const spare = await createInvitation(web, orgId, { role: "GUEST", maxUses: 5, expiresInHours: 1 });
    await revokeInvitation(web, spare.id);
    expect((await fail(previewInvite(bobWeb, spare.code))).status).toBe(404);
  });

  it("the server refuses what a member may not do, whatever the browser sends", async () => {
    expect((await fail(updateWorkspace(bobWeb, orgId, { name: "Hijacked" }))).status).toBe(403);
    expect((await fail(createInvitation(bobWeb, orgId, { role: "ADMIN", maxUses: 1, expiresInHours: 1 }))).status).toBe(403);
    expect((await fail(changeMember(bobWeb, orgId, bob.userId, { role: "OWNER" }))).status).toBe(403);
    expect((await fail(removeMember(bobWeb, orgId, owner.userId))).status).toBe(403);
    expect((await fail(createChannel(bobWeb, orgId, { name: "rogue", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" }))).status).toBe(403);
    expect((await fail(deleteWorkspace(bobWeb, orgId, "Acme Design", requestId()))).status).toBe(403);
  });

  it("owners change roles and titles; the directory shows them", async () => {
    await changeMember(web, orgId, bob.userId, { role: "ADMIN", title: "Design lead" });
    const people = await directory(web, orgId);
    expect(people.find((p) => p.id === bob.userId)).toMatchObject({ orgRole: "ADMIN", title: "Design lead" });
    expect((await directory(web, orgId, "bob")).map((p) => p.id)).toEqual([bob.userId]);
    // An admin can't make another owner.
    expect((await fail(changeMember(bobWeb, orgId, bob.userId, { role: "OWNER" }))).status).toBe(403);
    await changeMember(web, orgId, bob.userId, { role: "MEMBER" });
  });

  it("renames the workspace and sets its photo; members see the change", async () => {
    await updateWorkspace(web, orgId, { name: "Acme Studio", description: "Design and research" });
    await until(() => bobWeb.state.get().orgs.find((o) => o.id === orgId)?.name === "Acme Studio", 6000, "rename on Bob's browser");
    // A minimal JPEG (SOI … EOI): the server checks the JPEG signature.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
    await setWorkspacePhoto(web, orgId, jpeg);
    await until(() => (bobWeb.state.get().orgs.find((o) => o.id === orgId)?.photoRev ?? 0) > 0, 6000, "photo revision on Bob's browser");
    expect(new Uint8Array(await bobWeb.api.bytes(`/v1/orgs/${orgId}/photo`))).toEqual(jpeg);
  });

  it("channels: create, change access, archive and restore; members follow in real time", async () => {
    const ch = await createChannel(web, orgId, { name: "reviews", topic: "Design reviews", scope: "ORG", scopeId: null, kind: "PUBLIC" });
    expect(ch).toMatchObject({ name: "reviews", kind: "PUBLIC", canManage: true, canManageAccess: true });
    const priv = await updateConversation(web, ch.id, { kind: "PRIVATE" });
    expect(priv.kind).toBe("PRIVATE");
    await updateConversation(web, ch.id, { archived: true });
    expect((await workspaceChannels(web, orgId, true)).find((c) => c.id === ch.id)?.archived).toBe(true);
    expect((await workspaceChannels(web, orgId, false)).some((c) => c.id === ch.id)).toBe(false);
    await updateConversation(web, ch.id, { archived: false });
    // An announcement channel for the whole workspace: everyone is in it, so Bob's browser gets it unasked.
    const news = await createChannel(web, orgId, { name: "news", topic: null, scope: "ORG", scopeId: null, kind: "ANNOUNCEMENT" });
    await until(() => !!bobWeb.state.get().conversations[news.id], 6000, "announcement channel on Bob's browser");
    expect(bobWeb.state.get().conversations[news.id]?.canPost).toBe(false);
  });

  it("branches and teams: create, archive and restore", async () => {
    await createBranch(web, orgId, "Dhaka", "Gulshan");
    const d = await workspaceDetail(web, orgId);
    const branch = d.branches.find((b) => b.name === "Dhaka")!;
    expect(branch).toMatchObject({ location: "Gulshan", canManage: true });
    await createTeam(web, orgId, "Support", branch.id);
    const team = (await workspaceDetail(web, orgId)).teams.find((t) => t.name === "Support")!;
    await setTeamArchived(web, team.id, true);
    expect((await archivedScopes(web, orgId)).teams.map((t) => t.id)).toContain(team.id);
    await setTeamArchived(web, team.id, false);
    expect((await workspaceDetail(web, orgId)).teams.map((t) => t.id)).toContain(team.id);
  });

  it("groups: the browser creates one, and the other member's browser gets it", async () => {
    const g = await createGroup(web, "Lunch club", [bob.userId]);
    expect(g).toMatchObject({ type: "GROUP", name: "Lunch club", memberCount: 2 });
    await until(() => !!bobWeb.state.get().conversations[g.id], 6000, "group on Bob's browser");
    const id = await web.sendText(g.id, "pizza?");
    await until(async () => (await bobWeb.store.message(id))?.text === "pizza?", 6000, "group message");
  });

  it("a member leaves; the last owner can't; the owner deletes the workspace for everyone", async () => {
    await leaveWorkspace(bobWeb, orgId);
    expect(bobWeb.state.get().orgs.some((o) => o.id === orgId)).toBe(false);
    expect((await fail(leaveWorkspace(web, orgId))).status).toBe(409);
    expect((await fail(deleteWorkspace(web, orgId, "Wrong name", requestId()))).status).toBeGreaterThanOrEqual(400);
    await deleteWorkspace(web, orgId, "Acme Studio", requestId());
    expect(web.state.get().orgs.some((o) => o.id === orgId)).toBe(false);
  });
});
