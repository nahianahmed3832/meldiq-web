import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
import {
  addGroupToChannel,
  applyWorkspaceTemplate,
  cancelMeeting,
  createGroup,
  createMeeting,
  listGroups,
  listMeetings,
  respondToMeeting,
  setGuestExpiry,
  setGuestPolicy,
  updateMeeting,
  workspaceTemplates,
} from "../src/sync/workspaceC5";
import { acceptInvite, createChannel, createInvitation, createWorkspace, directory, requestId, workspaceChannels, workspaceDetail } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/** Workspace templates, groups, guest end dates and meetings (android round 7 C5, server docs/WORKSPACE_C5.md). */
let server: Server;
let ann: Phone;
let bo: Phone;
let cy: Phone;
let annWeb: Engine;
let boWeb: Engine;
let cyWeb: Engine;
let orgId: string;
let round7 = false;
const soon: { title: string; roomId: string | null }[] = [];
const DAY = 86_400_000;
const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  );

beforeAll(async () => {
  server = await startServer();
  const f = await serverFeatures(server);
  round7 = ["workspace-templates", "groups", "guest-expiry", "meetings"].every((x) => f.includes(x));
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  cy = await server.client("cy", "Cy");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo, "Meldiq Web · Bo", { notifyMeeting: (title, _body, roomId) => soon.push({ title, roomId }) })).engine;
  cyWeb = (await linkBrowser(server, cy)).engine;
  orgId = (await createWorkspace(annWeb, "Field Co", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  cyWeb?.stop();
  await server?.close();
});

describe("workspace templates", () => {
  it("adds only what's missing: applying the same template twice adds nothing new", async (t) => {
    if (!round7) return t.skip();
    const templates = await workspaceTemplates(annWeb);
    expect(templates.map((x) => x.id)).toContain("business");
    const first = await applyWorkspaceTemplate(annWeb, orgId, "business");
    expect(first.channels.length).toBeGreaterThan(0);
    const again = await applyWorkspaceTemplate(annWeb, orgId, "business");
    expect(again.channels).toEqual([]);
    const names = (await workspaceChannels(annWeb, orgId, false)).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["general", "random", "meeting-room"]));
    expect((await fail(applyWorkspaceTemplate(boWeb, orgId, "business")))?.status).toBe(403);
  });
});

describe("groups", () => {
  it("a manager makes a group; members see it; adding it to a private channel adds its members", async (t) => {
    if (!round7) return t.skip();
    const g = await createGroup(annWeb, orgId, { name: "Field crew", description: "On site", memberIds: [bo.userId] });
    expect(g.handle).toBeTruthy();
    expect((await listGroups(boWeb, orgId)).map((x) => x.name)).toEqual(["Field crew"]);
    expect((await fail(createGroup(boWeb, orgId, { name: "Mine", description: null, memberIds: [] })))?.status).toBe(403);

    const ch = await createChannel(annWeb, orgId, { name: "site-ops", topic: null, scope: "ORG", scopeId: null, kind: "PRIVATE" });
    expect(await addGroupToChannel(annWeb, ch.id, g.id)).toEqual({ added: 1, skipped: 0 });
    await boWeb.refreshAll();
    expect(boWeb.state.get().conversations[ch.id]?.joined).toBe(true);
    expect((await fail(addGroupToChannel(boWeb, ch.id, g.id)))?.status).toBe(403);
  });
});

describe("guests", () => {
  it("the policy caps a guest's end date; guests can't see groups; turning guests off refuses guest invitations", async (t) => {
    if (!round7) return t.skip();
    await setGuestPolicy(annWeb, orgId, true, 7);
    expect((await workspaceDetail(annWeb, orgId)).org).toMatchObject({ guestsAllowed: true, guestMaxDays: 7 });
    const inv = await createInvitation(annWeb, orgId, { role: "GUEST", maxUses: 1, expiresInHours: 1, guestDays: 30 });
    await acceptInvite(cyWeb, inv.code);
    const cyRow = (await directory(annWeb, orgId, "cy")).find((m) => m.id === cy.userId);
    expect(cyRow?.expiresAt).toBeGreaterThan(Date.now());
    expect(cyRow!.expiresAt!).toBeLessThanOrEqual(Date.now() + 7 * DAY + 60_000);

    expect((await fail(setGuestExpiry(annWeb, orgId, cy.userId, Date.now() + 30 * DAY)))?.status).toBe(409);
    await setGuestExpiry(annWeb, orgId, cy.userId, Date.now() + 3 * DAY);
    expect((await fail(setGuestExpiry(annWeb, orgId, bo.userId, Date.now() + DAY)))?.status).toBe(400);
    expect((await fail(listGroups(cyWeb, orgId)))?.status).toBe(403);

    await setGuestPolicy(annWeb, orgId, false, null);
    expect((await fail(createInvitation(annWeb, orgId, { role: "GUEST", maxUses: 1, expiresInHours: 1 })))?.status).toBe(409);
    expect((await directory(annWeb, orgId, "cy")).some((m) => m.id === cy.userId)).toBe(true);
    await setGuestPolicy(annWeb, orgId, true, null);
  });
});

describe("meetings", () => {
  it("schedule in a voice room; the invitee hears live, answers, is told it's starting soon; a stale edit is refused", async (t) => {
    if (!round7) return t.skip();
    await annWeb.refreshAll();
    const room = (await workspaceChannels(annWeb, orgId, false)).find((c) => c.name === "meeting-room" && c.voice);
    expect(room).toBeTruthy();
    const rev0 = boWeb.state.get().meetingsRev;
    const startsAt = Date.now() + 5 * 60_000;
    const input = { roomId: room!.id, title: "Site walk", description: "Bring boots", startsAt, endsAt: startsAt + 30 * 60_000, timeZone: "Asia/Dhaka", participantIds: [bo.userId], groupIds: [] };
    const m = await createMeeting(annWeb, orgId, input);
    expect(m).toMatchObject({ canEdit: true, cancelled: false, rev: 1 });
    await until(() => boWeb.state.get().meetingsRev > rev0, 6000, "meeting.updated reached Bo");

    const seen = (await listMeetings(boWeb, orgId)).find((x) => x.id === m.id);
    expect(seen).toMatchObject({ myResponse: "pending", canEdit: false, title: "Site walk" });
    expect((await respondToMeeting(boWeb, m.id, "accepted")).myResponse).toBe("accepted");
    expect((await fail(updateMeeting(boWeb, m.id, m.rev, { ...input, title: "Mine" })))?.status).toBe(403);
    expect((await fail(cancelMeeting(boWeb, m.id)))?.status).toBe(403);

    const moved = await updateMeeting(annWeb, m.id, m.rev, { ...input, title: "Site walk (moved)" });
    expect(moved.rev).toBe(2);
    const stale = await fail(updateMeeting(annWeb, m.id, m.rev, { ...input, title: "Overwrite" }));
    expect([stale?.status, stale?.code]).toEqual([409, "stale_revision"]);

    (server.ctx as unknown as { meetings: { notifySoon(): number } }).meetings.notifySoon();
    const note = await until(() => soon.find((s) => s.title.includes("Site walk (moved)")), 6000, "starting-soon notification");
    expect(note.roomId).toBe(room!.id);

    const rev1 = boWeb.state.get().meetingsRev;
    expect((await cancelMeeting(annWeb, m.id)).cancelled).toBe(true);
    await until(() => boWeb.state.get().meetingsRev > rev1, 6000, "cancellation reached Bo");
    expect((await listMeetings(boWeb, orgId)).find((x) => x.id === m.id)?.cancelled).toBe(true);
  });
});
