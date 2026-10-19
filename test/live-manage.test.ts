import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { block, blockedIds, findByPhone, unblock } from "../src/sync/profile";
import type { Engine } from "../src/sync/engine";
import { addConversationMember, createGroup, updateConversation } from "../src/sync/workspaces";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Managing a conversation from the browser's details panel (android ChannelDetailsSections, ManageSheets,
 * PrivacyScreen › Blocked) against the real server: renaming, adding people, and blocking someone. Each change reaches
 * the other people's devices in real time; what a non-manager may not do is refused by the server.
 */
let server: Server;
let ada: Phone;
let ben: Phone;
let cy: Phone;
let web: Engine;

beforeAll(async () => {
  server = await startServer();
  ada = await server.client("ada", "Ada");
  ben = await server.client("ben", "Ben");
  cy = await server.client("cy", "Cy");
  for (const p of [ada, ben, cy]) await p.connect();
  web = (await linkBrowser(server, ada)).engine;
});
afterAll(async () => {
  web?.stop();
  await server?.close();
});

describe("managing a group", () => {
  it("the group's admin renames it and adds someone; everyone's devices see the change, and a non-admin is refused", async () => {
    const g = await createGroup(web, "Launch", [ben.userId]);
    expect(web.state.get().conversations[g.id].canManage).toBe(true);

    await updateConversation(web, g.id, { name: "Launch crew" });
    expect(web.state.get().conversations[g.id].name).toBe("Launch crew");
    await until(async () => (await ben.req("GET", `/v1/conversations/${g.id}`)).conversation.name === "Launch crew", 8000, "Ben sees the new name");

    await addConversationMember(web, g.id, cy.userId);
    await until(() => web.state.get().conversations[g.id]?.memberCount === 3, 8000, "member count in the browser");
    const members = (await cy.req("GET", `/v1/conversations/${g.id}/members`)).members as { id: string }[];
    expect(members.map((m) => m.id).sort()).toEqual([ada.userId, ben.userId, cy.userId].sort());

    // A message sent from the browser after the change reaches the new member's device.
    await web.sendText(g.id, "welcome, Cy");
    await until(() => cy.received.some((m) => m.payload.text === "welcome, Cy"), 8000, "Cy receives it");

    // Ben is a member, not an admin: the server refuses his rename.
    const refused = await ben.req("PATCH", `/v1/conversations/${g.id}`, { name: "Ben's" }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(String(refused)).toMatch(/403|forbidden/i);
  });

  it("a name the server won't take is refused with its reason, and nothing changes", async () => {
    const g = await createGroup(web, "Short", [ben.userId]);
    const e = await updateConversation(web, g.id, { name: "x".repeat(61) }).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(400);
    expect(web.state.get().conversations[g.id].name).toBe("Short");
  });
});

describe("blocking from a direct message", () => {
  it("blocks and unblocks; while blocked, the other person's messages don't reach the browser", async () => {
    const dm = (await ben.req("POST", "/v1/conversations/dm", { userId: ada.userId })).conversation.id as string;
    await ben.send(dm, { type: "text", text: "before the block" });
    await until(async () => (await web.conversationMessages(dm)).some((m) => m.text === "before the block"), 8000, "first message");

    await block(web, ben.userId);
    expect(await blockedIds(web)).toContain(ben.userId);
    await ben.send(dm, { type: "text", text: "while blocked" });
    // A message from someone not blocked still arrives, so the browser is connected and receiving.
    const cyDm = (await cy.req("POST", "/v1/conversations/dm", { userId: ada.userId })).conversation.id as string;
    await cy.send(cyDm, { type: "text", text: "Cy is not blocked" });
    await until(async () => (await web.conversationMessages(cyDm)).some((m) => m.text === "Cy is not blocked"), 8000, "unblocked person's message");
    expect((await web.conversationMessages(dm)).some((m) => m.text === "while blocked")).toBe(false);

    await unblock(web, ben.userId);
    expect(await blockedIds(web)).not.toContain(ben.userId);
    await ben.send(dm, { type: "text", text: "after unblocking" });
    await until(async () => (await web.conversationMessages(dm)).some((m) => m.text === "after unblocking"), 8000, "message after unblocking");
  });
});

describe("finding someone by phone number", () => {
  it("finds a person only once they allow it, by the exact international number", async () => {
    await ben.req("PATCH", "/v1/users/me", { phone: "+15550100200" });
    expect(await findByPhone(web, "+1 555 010 0200")).toBeNull(); // the default: nobody finds you by phone
    await ben.req("PUT", "/v1/users/me/privacy", { findByPhone: "everyone" });
    expect((await findByPhone(web, "+1 (555) 010-0200"))?.id).toBe(ben.userId);
    expect(await findByPhone(web, "+15550100201")).toBeNull();
  });
});

describe("animated emoji", () => {
  it("one sent from the browser reaches the phone as an animated emoji with its readable text, and the phone's shows here", async () => {
    const dm = (await cy.req("POST", "/v1/conversations/dm", { userId: ada.userId })).conversation.id as string;
    await until(() => !!web.state.get().conversations[dm], 8000, "the DM in the browser");
    await web.sendText(dm, "🎉", { rich: { animoji: "🎉" } });
    const got = await until(() => cy.received.find((m) => m.conversationId === dm && m.payload.animoji === "🎉"), 8000, "Cy's phone receives it");
    expect(got.payload.text).toBe("🎉");

    await cy.send(dm, { type: "text", text: "👋", animoji: "👋" });
    await until(async () => (await web.conversationMessages(dm)).some((m) => m.rich?.animoji === "👋"), 8000, "the phone's animated emoji in the browser");
  });
});
