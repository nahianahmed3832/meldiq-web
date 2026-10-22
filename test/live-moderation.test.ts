import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { createCommunity, updateChannel } from "../src/sync/community";
import type { Engine } from "../src/sync/engine";
import { communityReports, reportContent, sendReport, setReportStatus } from "../src/sync/reports";
import { auditLog } from "../src/sync/roles";
import { acceptInvite, createInvitation, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Moderation from the browser against the real server (batches B3, B4): reports with what the reporter's browser shares,
 * the moderators' queue, audit filters by kind and person, and slowmode queuing messages until the server allows them.
 */
let server: Server;
let olivia: Phone;
let bob: Phone;
let web: Engine;
let bobWeb: Engine;
let orgId: string;
let general: string;
let ready = false;

beforeAll(async () => {
  server = await startServer();
  const f = await serverFeatures(server);
  ready = f.includes("reports") && f.includes("slowmode");
  olivia = await server.client("olivia", "Olivia");
  bob = await server.client("bob", "Bob");
  web = (await linkBrowser(server, olivia)).engine;
  bobWeb = (await linkBrowser(server, bob)).engine;
  if (!ready) return;
  orgId = (await createCommunity(web, { name: "Mod Lab", description: null }, requestId())).id;
  await acceptInvite(bobWeb, (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
  general = await until(() => Object.values(bobWeb.state.get().conversations).find((c) => c.orgId === orgId && c.name === "general")?.id, 8000, "general for Bob");
});
afterAll(async () => {
  web?.stop();
  bobWeb?.stop();
  await server?.close();
});

describe("reports", () => {
  it("a member's message reported with its context reaches the moderators, without the reporter", async (t) => {
    if (!ready) return t.skip();
    await bobWeb.sendText(general, "first thing");
    await bobWeb.sendText(general, "buy cheap followers");
    await until(async () => (await web.conversationMessages(general)).some((m) => m.text === "buy cheap followers"), 8000, "Olivia has it");
    const lines = (await web.conversationMessages(general)).map((m) => ({ id: m.id, senderUserId: m.senderUserId, text: m.text, sentAt: m.serverTs ?? m.sortTs }));
    const target = lines.find((l) => l.text === "buy cheap followers")!;
    const sent = await sendReport(web, { targetUserId: bob.userId, reason: "spam", note: "again", conversationId: general, messageId: target.id, content: reportContent(target, lines) });
    expect(sent).toMatchObject({ to: "community", repeated: false });
    // Reporting the same message again returns the first report.
    expect((await sendReport(web, { targetUserId: bob.userId, reason: "spam", conversationId: general, messageId: target.id })).repeated).toBe(true);
    const queue = await communityReports(web, orgId, "open");
    const r = queue.reports.find((x) => x.id === sent.id)!;
    expect(r).toMatchObject({ reason: "spam", note: "again", conversationName: "general" });
    expect(r.content?.text).toBe("buy cheap followers");
    expect(r.content?.context?.map((c) => c.text)).toContain("first thing");
    expect(JSON.stringify(r)).not.toContain(olivia.userId);
    // A member without reports.view can't see the queue.
    expect(((await communityReports(bobWeb, orgId, "open").catch((e: unknown) => e)) as ApiError).status).toBe(403);
    const closed = await setReportStatus(web, r.id, "actioned", "warned");
    expect(closed).toMatchObject({ status: "actioned", handledNote: "warned" });
    expect((await communityReports(web, orgId, "closed")).reports.map((x) => x.id)).toContain(r.id);
    expect((await auditLog(web, orgId, null, "report")).entries.length).toBeGreaterThan(0);
    expect((await auditLog(web, orgId, null, undefined, bob.userId)).entries.every((e) => e.actorId === bob.userId)).toBe(true);
  });

  it("a person reported from a DM goes to Meldiq's team, illegal content too", async (t) => {
    if (!ready) return t.skip();
    expect((await sendReport(bobWeb, { targetUserId: olivia.userId, reason: "harassment" })).to).toBe("meldiq");
    expect((await sendReport(bobWeb, { targetUserId: olivia.userId, reason: "harassment", orgId })).to).toBe("community");
    expect((await sendReport(bobWeb, { targetUserId: olivia.userId, reason: "illegal", orgId })).to).toBe("meldiq");
  });
});

describe("slowmode", () => {
  it("a second message waits for the interval and then goes out, instead of failing", async (t) => {
    if (!ready) return t.skip();
    const ch = await updateChannel(web, general, { slowmodeSec: 5 });
    expect(ch.slowmodeSec).toBe(5);
    await until(() => bobWeb.state.get().conversations[general]?.slowmodeSec === 5, 8000, "Bob sees slowmode");
    await bobWeb.sendText(general, "one");
    const second = await bobWeb.sendText(general, "two");
    // Refused by the server at first (429 slowmode), kept in the outbox, sent once allowed.
    await until(async () => (await bobWeb.store.message(second))?.status === "SENT", 15000, "second message sent after the wait");
    await until(async () => (await web.conversationMessages(general)).some((m) => m.text === "two"), 8000, "Olivia gets it");
    await updateChannel(web, general, { slowmodeSec: 0 });
  });
});
