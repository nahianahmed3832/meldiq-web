import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import {
  answerApplication,
  applications,
  applyToJoin,
  ban,
  bans,
  communityPreview,
  communityTemplates,
  createCategory,
  createCommunity,
  createCommunityChannel,
  deleteCategory,
  deleteChannel,
  discover,
  joinCommunity,
  joinCommunityChannel,
  overwrites,
  renameCategory,
  saveLayout,
  setJoinQuestions,
  setOverwrite,
  setSecurity,
  setTimeout_,
  unban,
  updateChannel,
  updateCommunityAccess,
} from "../src/sync/community";
import { layoutPositions } from "../src/sync/communityRules";
import type { Engine } from "../src/sync/engine";
import { acceptInvite, createInvitation, removeConversationMember, requestId, workspaceDetail } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Communities from the browser against the real server (docs/COMMUNITY_REBUILD_2026-10-21.md, batches B2–B4b): starter
 * templates, categories and the layout, channel types and settings, permission overwrites, discovery, joining and
 * applying, bans, timeouts and security actions. Everything a member may not do is refused by the server.
 */
let server: Server;
let olivia: Phone;
let bob: Phone;
let cleo: Phone;
let web: Engine;
let bobWeb: Engine;
let cleoWeb: Engine;
let orgId: string;
let community = false;

const fail = async (p: Promise<unknown>): Promise<ApiError> => {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ApiError);
  return e as ApiError;
};

beforeAll(async () => {
  server = await startServer();
  community = (await serverFeatures(server)).includes("community-channels");
  olivia = await server.client("olivia", "Olivia");
  bob = await server.client("bob", "Bob");
  cleo = await server.client("cleo", "Cleo");
  web = (await linkBrowser(server, olivia)).engine;
  bobWeb = (await linkBrowser(server, bob)).engine;
  cleoWeb = (await linkBrowser(server, cleo)).engine;
  await until(() => web.state.get().server, 6000, "server info");
  if (!community) return;
  orgId = (await createCommunity(web, { name: "Paint Club", description: "We paint", template: "club" }, requestId())).id;
  await acceptInvite(bobWeb, (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  for (const e of [web, bobWeb, cleoWeb]) e?.stop();
  await server?.close();
});

describe("community structure", () => {
  it("starts from a template with its categories and channels, loaded into the panel", async (t) => {
    if (!community) return t.skip();
    expect((await communityTemplates(web)).map((x) => x.id)).toEqual(expect.arrayContaining(["starter", "club", "gaming"]));
    await web.community.refresh(orgId);
    const data = web.state.get().communities[orgId]!;
    expect(data.categories.map((c) => c.name)).toEqual(["Start here", "Club"]);
    const ideas = data.channels.find((c) => c.name === "ideas")!;
    expect(ideas.format).toBe("forum");
    expect(data.channels.find((c) => c.name === "meeting-room")?.voice).toBe(true);
    expect(ideas.categoryName).toBe("Club");
  });

  it("creates, renames, orders and deletes categories; members can't", async (t) => {
    if (!community) return t.skip();
    const cat = await createCategory(web, orgId, "Projects");
    await renameCategory(web, orgId, cat.id, "Big projects");
    expect(web.state.get().communities[orgId]!.categories.map((c) => c.name)).toContain("Big projects");
    const order = web.state.get().communities[orgId]!.categories.map((c) => c.id);
    await saveLayout(web, orgId, { categories: [cat.id, ...order.filter((id) => id !== cat.id)] });
    expect(web.state.get().communities[orgId]!.categories[0].id).toBe(cat.id);
    expect((await fail(createCategory(bobWeb, orgId, "Mine"))).status).toBe(403);
    await deleteCategory(web, orgId, cat.id);
    expect(web.state.get().communities[orgId]!.categories.some((c) => c.id === cat.id)).toBe(false);
  });

  it("creates each type of channel in a category, sets slowmode and forum settings, moves and deletes it", async (t) => {
    if (!community) return t.skip();
    const club = web.state.get().communities[orgId]!.categories.find((c) => c.name === "Club")!;
    const ch = await createCommunityChannel(web, orgId, { name: "critique", topic: "Show your work", kind: "PUBLIC", voice: false, format: "text", categoryId: club.id });
    expect(ch.categoryId).toBe(club.id);
    await until(() => bobWeb.state.get().conversations[ch.id]?.joined === true, 8000, "Bob auto-joined");
    const slow = await updateChannel(web, ch.id, { slowmodeSec: 30 });
    expect(slow.slowmodeSec).toBe(30);
    const forum = await updateChannel(web, ch.id, { format: "forum", forumTags: [{ name: "Oil" }, { name: "Watercolour" }], guidelines: "One picture per post" });
    expect(forum.format).toBe("forum");
    expect(forum.forumTags.map((x) => x.name)).toEqual(["Oil", "Watercolour"]);
    expect(forum.guidelines).toBe("One picture per post");
    // A member who doesn't manage it can't change it.
    expect((await fail(updateChannel(bobWeb, ch.id, { name: "mine" }))).status).toBe(403);
    // Moved out of the category, then back first in it.
    await saveLayout(web, orgId, { channels: layoutPositions(null, [ch.id]) });
    expect(web.state.get().conversations[ch.id]?.categoryId ?? null).toBeNull();
    await saveLayout(web, orgId, { channels: layoutPositions(club.id, [ch.id]) });
    expect(web.state.get().conversations[ch.id]?.categoryId).toBe(club.id);
    // Deleting needs the exact name.
    expect((await fail(deleteChannel(web, orgId, ch.id, "wrong"))).code).toBe("confirm_mismatch");
    await deleteChannel(web, orgId, ch.id, "#critique");
    await until(() => !bobWeb.state.get().conversations[ch.id], 8000, "gone for Bob");
  });

  it("a category that hides its channels from @everyone takes them from members, and a role brings them back", async (t) => {
    if (!community) return t.skip();
    const cat = await createCategory(web, orgId, "Staff");
    const room = await createCommunityChannel(web, orgId, { name: "staff-room", topic: null, kind: "PUBLIC", voice: false, format: "text", categoryId: cat.id });
    await until(() => bobWeb.state.get().conversations[room.id]?.joined === true, 8000, "Bob in the staff room");
    const before = await overwrites(web, { type: "category", id: cat.id });
    expect(before.capabilities.map((c) => c.key)).toContain("channels.view");
    const after = await setOverwrite(web, orgId, { type: "category", id: cat.id }, "everyone", [], ["channels.view"]);
    expect(after.overwrites.find((o) => o.subject === "everyone")?.deny).toEqual(["channels.view"]);
    expect(after.removed).toBeGreaterThanOrEqual(1);
    await until(() => !bobWeb.state.get().conversations[room.id], 8000, "Bob lost the staff room");
    // Bob can't change the rules.
    expect((await fail(setOverwrite(bobWeb, orgId, { type: "category", id: cat.id }, "everyone", [], []))).status).toBeGreaterThanOrEqual(403);
    // The category can't be deleted while its rules decide who sees its channels.
    expect((await fail(deleteCategory(web, orgId, cat.id))).code).toBe("category_has_permissions");
  });
});

describe("discovery, joining and applications", () => {
  it("a public open community is found, previewed and joined; a private one isn't listed", async (t) => {
    if (!community) return t.skip();
    expect((await discover(cleoWeb, "Paint")).communities.some((c) => c.id === orgId)).toBe(false);
    await updateCommunityAccess(web, orgId, { visibility: "public", joinPolicy: "open", rules: "Be kind" });
    const found = (await discover(cleoWeb, "Paint")).communities.find((c) => c.id === orgId);
    expect(found).toMatchObject({ joinPolicy: "open", joined: false });
    const preview = await communityPreview(cleoWeb, orgId);
    expect(preview.community.rules).toBe("Be kind");
    expect(preview.channels.some((c) => c.name === "general")).toBe(true);
    expect(preview.channels.some((c) => c.name === "staff-room")).toBe(false);
    await joinCommunity(cleoWeb, orgId);
    await until(() => cleoWeb.state.get().orgs.some((o) => o.id === orgId), 8000, "Cleo is a member");
  });

  it("bans remove a member and keep them out until lifted", async (t) => {
    if (!community) return t.skip();
    await ban(web, orgId, cleo.userId, "spam");
    await until(() => !cleoWeb.state.get().orgs.some((o) => o.id === orgId), 8000, "Cleo removed");
    expect((await bans(web, orgId)).map((b) => b.userId)).toContain(cleo.userId);
    expect((await communityPreview(cleoWeb, orgId)).banned).toBe(true);
    expect((await fail(joinCommunity(cleoWeb, orgId))).code).toBe("banned");
    expect((await fail(bans(bobWeb, orgId))).status).toBe(403);
    await unban(web, orgId, cleo.userId);
  });

  it("with join questions, people apply; a moderator lets them in", async (t) => {
    if (!community || !(await serverFeatures(server)).includes("join-applications")) return t.skip();
    await setJoinQuestions(web, orgId, ["Why do you paint?"]);
    expect((await fail(joinCommunity(cleoWeb, orgId))).code).toBe("application_required");
    expect((await fail(applyToJoin(cleoWeb, orgId, [""]))).status).toBe(400);
    const app = await applyToJoin(cleoWeb, orgId, ["It's calming"]);
    expect(app.status).toBe("pending");
    expect((await communityPreview(cleoWeb, orgId)).application?.status).toBe("pending");
    const queue = await applications(web, orgId, "pending");
    expect(queue.applications.map((a) => a.answers)).toContainEqual(["It's calming"]);
    expect((await fail(applications(bobWeb, orgId, "pending"))).status).toBe(403);
    const answered = await answerApplication(web, app.id, "approved", "Welcome");
    expect(answered).toMatchObject({ status: "approved", note: "Welcome" });
    await until(() => cleoWeb.state.get().orgs.some((o) => o.id === orgId), 8000, "Cleo let in");
    await setJoinQuestions(web, orgId, null);
  });
});

describe("moderation", () => {
  it("times a member out: they can't post until it ends", async (t) => {
    if (!community) return t.skip();
    const general = Object.values(bobWeb.state.get().conversations).find((c) => c.orgId === orgId && c.name === "general")!;
    const until_ = await setTimeout_(web, orgId, bob.userId, Date.now() + 3_600_000, "cool off");
    expect(until_).toBeGreaterThan(Date.now());
    await until(() => bobWeb.state.get().conversations[general.id]?.timedOutUntil, 8000, "Bob sees the timeout");
    expect(bobWeb.state.get().conversations[general.id]?.canPost).toBe(false);
    expect((await fail(setTimeout_(bobWeb, orgId, olivia.userId, Date.now() + 60_000, null))).status).toBe(403);
    await setTimeout_(web, orgId, bob.userId, null, null);
    await until(() => bobWeb.state.get().conversations[general.id]?.canPost === true, 8000, "Bob can post again");
  });

  it("pauses joining and new DMs for a time, then resumes", async (t) => {
    if (!community || !(await serverFeatures(server)).includes("security-actions")) return t.skip();
    const r = await setSecurity(web, orgId, { invitesPausedUntil: Date.now() + 3_600_000 });
    expect(r.invitesPausedUntil).toBeGreaterThan(Date.now());
    expect(web.state.get().orgs.find((o) => o.id === orgId)?.invitesPausedUntil).toBeGreaterThan(Date.now());
    expect((await fail(setSecurity(bobWeb, orgId, { invitesPausedUntil: null }))).status).toBe(403);
    await setSecurity(web, orgId, { invitesPausedUntil: null, activityAlerts: false });
    expect(web.state.get().orgs.find((o) => o.id === orgId)).toMatchObject({ invitesPausedUntil: null, activityAlerts: false });
  });

  it("a channel you may see but haven't joined opens and joins", async (t) => {
    if (!community) return t.skip();
    const ch = await createCommunityChannel(web, orgId, { name: "opt-in", topic: null, kind: "PUBLIC", voice: false, format: "text", categoryId: null });
    // Bob isn't in it (the owner takes him out: since API 0.26.0 people leave a community, not one of its channels), so it
    // shows dimmed in his panel; opening it joins it again.
    await removeConversationMember(web, ch.id, bob.userId);
    await until(() => !bobWeb.state.get().conversations[ch.id]?.joined, 8000, "Bob left");
    await bobWeb.community.refresh(orgId);
    expect(bobWeb.state.get().communities[orgId]!.channels.find((c) => c.id === ch.id)?.joined).toBe(false);
    await joinCommunityChannel(bobWeb, orgId, ch.id);
    expect(bobWeb.state.get().conversations[ch.id]?.joined).toBe(true);
    expect((await workspaceDetail(bobWeb, orgId)).permissions.canManageChannels).toBe(false);
  });
});
