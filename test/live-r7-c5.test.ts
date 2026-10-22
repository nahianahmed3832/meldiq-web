import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
import { cancelMeeting, createMeeting, listMeetings, respondToMeeting, setGuestExpiry, setGuestPolicy, updateMeeting } from "../src/sync/workspaceC5";
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
let features: string[] = [];
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
  features = f;
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

describe("guests", () => {
  it("the policy caps a guest's end date; turning guests off refuses guest invitations", async (t) => {
    if (!features.includes("guest-expiry")) return t.skip();
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

    await setGuestPolicy(annWeb, orgId, false, null);
    expect((await fail(createInvitation(annWeb, orgId, { role: "GUEST", maxUses: 1, expiresInHours: 1 })))?.status).toBe(409);
    expect((await directory(annWeb, orgId, "cy")).some((m) => m.id === cy.userId)).toBe(true);
    await setGuestPolicy(annWeb, orgId, true, null);
  });
});

describe("meetings", () => {
  it("schedule in a voice room; the invitee hears live, answers, is told it's starting soon; a stale edit is refused", async (t) => {
    if (!features.includes("meetings")) return t.skip();
    const room = await createChannel(annWeb, orgId, { name: "meeting-room", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC", voice: true });
    await annWeb.refreshAll();
    expect((await workspaceChannels(annWeb, orgId, false)).find((c) => c.id === room.id)?.voice).toBe(true);
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
