import { createHmac, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
import {
  addInboxNote,
  composerState,
  connectInboxAccount,
  eraseInboxCustomer,
  inboxAccounts,
  inboxConversation,
  inboxConversations,
  inboxProviders,
  inboxReport,
  inboxSettings,
  inboxTemplates,
  saveInboxSettings,
  sendInboxReply,
  sendInboxTemplate,
  updateInboxConversation,
} from "../src/sync/inbox";
import { acceptInvite, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * The Unified Inbox (android round 8, server docs/UNIFIED_INBOX.md) from the browser. Meta is a fake inside the test
 * server answering its documented endpoints, as in the server's own tests; customers are synthetic, every secret is
 * generated for this run, and nothing reaches a real platform.
 */
const SECRET = randomBytes(24).toString("hex");
const PAGE = "1000001";
const PHONE = "2000002";
const WABA = "3000003";
const PAGE_TOKEN = `EAAPAGE-${randomBytes(12).toString("hex")}`;
const WA_TOKEN = `EAAWA-${randomBytes(12).toString("hex")}`;
const HOUR = 3_600_000;

class FakeMeta {
  sent: Record<string, unknown>[] = [];
  private n = 0;
  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const token = String((init?.headers as Record<string, string> | undefined)?.authorization ?? "").replace("Bearer ", "");
    if (token !== PAGE_TOKEN && token !== WA_TOKEN) return json({ error: { code: 190, message: "Invalid OAuth access token" } }, 400);
    const u = new URL(url);
    if (init?.method === "POST" && u.pathname.endsWith("/messages")) {
      this.sent.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      this.n++;
      return u.pathname.includes(PHONE) ? json({ messages: [{ id: `wamid.out${this.n}` }] }) : json({ recipient_id: "x", message_id: `m_out${this.n}` });
    }
    if (u.pathname.endsWith("/subscribed_apps")) return json({ success: true });
    if (u.pathname.endsWith(`/${PAGE}`)) return json({ id: PAGE, name: "Acme Shop" });
    if (u.pathname.endsWith(`/${PHONE}`)) return json({ id: PHONE, display_phone_number: "+1 555 0100", verified_name: "Acme Shop WA" });
    if (u.pathname.endsWith(`/${WABA}/message_templates`)) return json({ data: [{ name: "order_update", language: "en_US", status: "APPROVED", category: "UTILITY" }] });
    return json({ error: { code: 100, message: "Unknown path" } }, 400);
  };
}

let server: Server;
let ann: Phone;
let bo: Phone;
let annWeb: Engine;
let boWeb: Engine;
let orgId: string;
let round8 = false;
let mid = 0;
const meta = new FakeMeta();
const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  );
/** A customer writes: Meta posts a signed webhook; the server's worker then files it. */
async function customerWrites(payload: unknown) {
  const raw = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
  const res = await fetch(`${server.baseUrl}/v1/inbox/webhooks/meta`, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": signature }, body: raw });
  expect(res.status).toBe(200);
  await (server.ctx as unknown as { inbox: { worker: { tick(): Promise<unknown> } } }).inbox.worker.tick();
}
const messengerText = (customer: string, text: string, at = Date.now()) => ({
  object: "page",
  entry: [{ id: PAGE, time: at, messaging: [{ sender: { id: customer }, recipient: { id: PAGE }, timestamp: at, message: { mid: `m_in${++mid}`, text } }] }],
});
const whatsappText = (from: string, text: string, at: number) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: WABA,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: PHONE },
            contacts: [{ wa_id: from, profile: { name: "Rina" } }],
            messages: [{ from, id: `wamid.in${++mid}`, timestamp: String(Math.floor(at / 1000)), type: "text", text: { body: text } }],
          },
        },
      ],
    },
  ],
});

beforeAll(async () => {
  server = await startServer(
    { INBOX_TICK_MS: "0", WORKFLOW_TICK_MS: "0", INTEGRATIONS_TOKEN_KEY: randomBytes(32).toString("base64"), META_APP_SECRET: SECRET, META_WEBHOOK_VERIFY_TOKEN: randomBytes(12).toString("hex") },
    { integrationsFetch: meta.fetch },
  );
  round8 = (await serverFeatures(server)).includes("unified-inbox");
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(annWeb, "Acme", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("customer inbox", () => {
  it("connects a Page with its Meta token (kept sealed, never shown again); members without inbox access are refused", async (t) => {
    if (!round8) return t.skip();
    const providers = await inboxProviders(annWeb, orgId);
    expect(Object.fromEntries(providers.map((p) => [p.id, p.state]))).toMatchObject({ messenger: "ready", whatsapp: "ready", tiktok: "awaiting_access" });
    const page = await connectInboxAccount(annWeb, orgId, { provider: "messenger", externalId: PAGE, token: PAGE_TOKEN });
    expect(page).toMatchObject({ name: "Acme Shop", status: "active", provider: "messenger" });
    expect(JSON.stringify(await inboxAccounts(annWeb, orgId))).not.toContain(PAGE_TOKEN);
    expect((await fail(connectInboxAccount(annWeb, orgId, { provider: "messenger", externalId: PAGE, token: "EAA-not-a-real-token-at-all" })))?.status).toBeGreaterThanOrEqual(400);
    expect((await fail(inboxConversations(boWeb, orgId, { view: "all" })))?.status).toBe(403);
  });

  it("a customer's message reaches the browser live; a reply goes to Meta, a note never does; stale changes are refused", async (t) => {
    if (!round8) return t.skip();
    const rev0 = annWeb.state.get().inboxRev;
    await customerWrites(messengerText("cust-1", "Is my order shipped?"));
    await until(() => annWeb.state.get().inboxRev > rev0, 6000, "inbox.updated on Ann's browser");
    const list = await inboxConversations(annWeb, orgId, { view: "all" });
    expect(list.conversations).toHaveLength(1);
    const c = list.conversations[0];
    expect(c).toMatchObject({ provider: "messenger", preview: "Is my order shipped?", unread: 1, status: "waiting_agent" });
    expect((await inboxConversations(annWeb, orgId, { view: "unassigned" })).counts.unassigned).toBe(1);

    const d = await inboxConversation(annWeb, c.id);
    expect(composerState(d)).toEqual({ kind: "text" });
    meta.sent = [];
    const reply = await sendInboxReply(annWeb, c.id, "Yes, it left today.", false);
    expect([reply.direction, reply.status]).toEqual(["out", "sent"]);
    await addInboxNote(annWeb, c.id, "Customer asked twice; check the courier.");
    expect(JSON.stringify(meta.sent)).toContain("Yes, it left today.");
    expect(JSON.stringify(meta.sent)).not.toContain("courier");

    const fresh = await inboxConversation(annWeb, c.id);
    expect(fresh.messages.map((m) => m.direction)).toEqual(["in", "out", "note"]);
    const tagged = await updateInboxConversation(annWeb, c.id, fresh.conversation.rev, { priority: "high", tags: ["vip", "shipping"] });
    expect(tagged).toMatchObject({ priority: "high", tags: ["vip", "shipping"] });
    expect((await fail(updateInboxConversation(annWeb, c.id, fresh.conversation.rev, { status: "resolved" })))?.status).toBe(409);
    expect((await inboxConversations(annWeb, orgId, { view: "all", q: "vip" })).conversations.map((x) => x.id)).toEqual([c.id]);
  });

  it("WhatsApp after 24 hours offers only approved templates; settings, report and erasing a customer", async (t) => {
    if (!round8) return t.skip();
    await connectInboxAccount(annWeb, orgId, { provider: "whatsapp", externalId: PHONE, token: WA_TOKEN, businessAccountId: WABA });
    await customerWrites(whatsappText("8801700000000", "Hello?", Date.now() - 30 * HOUR));
    const wa = (await inboxConversations(annWeb, orgId, { view: "all", provider: "whatsapp" })).conversations[0];
    expect(wa.customer).toMatchObject({ name: "Rina", handle: "+8801700000000" });
    const d = await inboxConversation(annWeb, wa.id);
    expect(composerState(d)).toEqual({ kind: "template_only" });
    expect((await fail(sendInboxReply(annWeb, wa.id, "free text", false)))?.status).toBeGreaterThanOrEqual(400);
    const [template] = await inboxTemplates(annWeb, orgId, wa.account.id);
    expect(template).toMatchObject({ name: "order_update", language: "en_US" });
    meta.sent = [];
    await sendInboxTemplate(annWeb, wa.id, template);
    expect(JSON.stringify(meta.sent)).toContain("order_update");

    const { settings, canManage } = await inboxSettings(annWeb, orgId);
    expect([canManage, settings.aiMode]).toEqual([true, "off"]);
    expect((await saveInboxSettings(annWeb, orgId, { ...settings, responseTargetMinutes: 15 })).responseTargetMinutes).toBe(15);
    expect((await fail(saveInboxSettings(annWeb, orgId, { ...settings, aiMode: "draft" })))?.code).toBe("ai_not_configured");
    expect((await inboxReport(annWeb, orgId, 30)).messages.received).toBe(2);

    await eraseInboxCustomer(annWeb, wa.id);
    expect((await fail(inboxConversation(annWeb, wa.id)))?.status).toBe(404);
  });
});
