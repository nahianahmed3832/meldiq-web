import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { createCommunity } from "../src/sync/community";
import type { Engine } from "../src/sync/engine";
import { expressionImage, expressions, refOf, removeExpression, renameExpression, sha256Hex, uploadExpression } from "../src/sync/expressions";
import { startDirect } from "../src/sync/account";
import { acceptInvite, createInvitation, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * A community's own emoji and stickers against the real server, with the reference client playing the phone (batches
 * B9, B12): uploads, messages naming them both ways, `:name:` reactions inside the community only, and images shown
 * only when their hash matches.
 */
let server: Server;
let ada: Phone;
let bob: Phone;
let web: Engine;
let bobWeb: Engine;
let orgId: string;
let general: string;
let ready = false;

/** A 1×1 PNG. */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

beforeAll(async () => {
  server = await startServer();
  ready = (await serverFeatures(server)).includes("community-expressions");
  ada = await server.client("ada", "Ada");
  bob = await server.client("bob", "Bob");
  await bob.connect();
  web = (await linkBrowser(server, ada)).engine;
  bobWeb = (await linkBrowser(server, bob)).engine;
  if (!ready) return;
  orgId = (await createCommunity(web, { name: "Emoji Lab", description: null }, requestId())).id;
  await acceptInvite(bobWeb, (await createInvitation(web, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
  general = await until(() => Object.values(web.state.get().conversations).find((c) => c.orgId === orgId && c.name === "general")?.id, 8000, "general");
  await until(() => bobWeb.state.get().conversations[general]?.joined, 8000, "Bob in general");
});
afterAll(async () => {
  web?.stop();
  bobWeb?.stop();
  await server?.close();
});

describe("community emoji and stickers", () => {
  it("are uploaded, renamed and removed by managers; members can't", async (t) => {
    if (!ready) return t.skip();
    const e = await uploadExpression(web, orgId, "emoji", "party", PNG);
    expect(e).toMatchObject({ kind: "emoji", name: "party", sha256: await sha256Hex(PNG) });
    expect(((await uploadExpression(bobWeb, orgId, "emoji", "mine", PNG).catch((x: unknown) => x)) as ApiError).status).toBe(403);
    expect(((await uploadExpression(web, orgId, "emoji", "party", PNG).catch((x: unknown) => x)) as ApiError).status).toBe(409);
    const s = await uploadExpression(web, orgId, "sticker", "wave_hi", PNG);
    await renameExpression(web, orgId, s.id, "wave");
    expect((await expressions(bobWeb, orgId, true)).expressions.map((x) => x.name).sort()).toEqual(["party", "wave"]);
    await removeExpression(web, orgId, s.id);
    expect((await expressions(web, orgId, true)).expressions.map((x) => x.name)).toEqual(["party"]);
  });

  it("travel by reference both ways, and their images show only with the right hash", async (t) => {
    if (!ready) return t.skip();
    const party = (await expressions(web, orgId, true)).expressions.find((e) => e.name === "party")!;
    await web.sendText(general, "hello :party:", { rich: { customEmoji: [refOf(party)] } });
    const onPhone = await bob.waitFor(() => bob.received.find((m) => m.payload?.text === "hello :party:"), 8000);
    expect(onPhone.payload.customEmoji).toEqual([expect.objectContaining({ id: party.id, orgId, name: "party", sha256: party.sha256 })]);
    // The phone sends one; the browser keeps the reference (and drops one whose name isn't in the text).
    await bob.send(general, { type: "text", text: "back :party:", customEmoji: [refOf(party), { ...refOf(party), name: "ghost" }] });
    const got = await until(async () => (await web.conversationMessages(general)).find((m) => m.text === "back :party:"), 8000, "the phone's message");
    expect(got.rich?.customEmoji?.map((r) => r.name)).toEqual(["party"]);
    expect(await expressionImage(bobWeb, party.id, party.sha256)).toMatch(/^blob:/);
    expect(await expressionImage(bobWeb, party.id, "f".repeat(64))).toBeNull();
  });

  it("react as :name: inside the community, never in a DM", async (t) => {
    if (!ready) return t.skip();
    const m = (await web.conversationMessages(general)).find((x) => x.text === "hello :party:")!;
    await bob.send(general, { type: "reaction", target: m.id, emoji: ":party:", add: true }, "control");
    await until(async () => (await web.store.message(m.id))?.reactions[":party:"]?.includes(bob.userId), 8000, "the reaction in the browser");
    const dm = await startDirect(web, bob.userId);
    await web.sendText(dm, "hi bob");
    const dmMsg = await until(async () => (await web.conversationMessages(dm)).find((x) => x.text === "hi bob"), 8000, "DM message");
    await bob.send(dm, { type: "reaction", target: dmMsg.id, emoji: ":party:", add: true }, "control");
    await bob.send(dm, { type: "reaction", target: dmMsg.id, emoji: "👍", add: true }, "control");
    await until(async () => (await web.store.message(dmMsg.id))?.reactions["👍"]?.length, 8000, "a normal reaction arrives");
    expect((await web.store.message(dmMsg.id))?.reactions[":party:"]).toBeUndefined();
  });
});
