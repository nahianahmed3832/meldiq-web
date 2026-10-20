import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { aiAsk, aiCatchUp, aiDocumentSummary, aiStatus, aiWorkflowDraft, aiWrite, catchUpMessages, setAiPolicy } from "../src/sync/ai";
import { createDocument } from "../src/sync/documents";
import type { Engine } from "../src/sync/engine";
import { acceptInvite, createChannel, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Workspace AI (android round 7 C8, server docs/AI.md) from the browser. No real provider is called: as in the server's
 * own tests, the in-process server gets a stand-in provider that records what it was sent and answers plainly.
 */
interface Sent {
  system: string;
  user: string;
}
class StandInProvider {
  readonly id = "anthropic";
  readonly model = "stand-in";
  sent: Sent[] = [];
  reply: string | null = null;
  async complete(req: Sent) {
    this.sent.push(req);
    return { text: this.reply ?? "A short answer.", inputTokens: 10, outputTokens: 5 };
  }
}

let server: Server;
let ann: Phone;
let bo: Phone;
let annWeb: Engine;
let boWeb: Engine;
let orgId: string;
let round7 = false;
const provider = new StandInProvider();
const setProviders = (p: unknown[]) => {
  (server.ctx as unknown as { config: { ai: { providers: unknown[] } } }).config.ai.providers = p;
};
const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as ApiError,
  );

beforeAll(async () => {
  server = await startServer({ WORKFLOW_TICK_MS: "0", AI_REQUESTS_PER_USER_PER_MINUTE: "40" });
  round7 = (await serverFeatures(server)).includes("ai");
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  annWeb = (await linkBrowser(server, ann)).engine;
  boWeb = (await linkBrowser(server, bo)).engine;
  orgId = (await createWorkspace(annWeb, "Smart Co", null, requestId())).id;
  await acceptInvite(boWeb, (await createInvitation(annWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
});
afterAll(async () => {
  annWeb?.stop();
  boWeb?.stop();
  await server?.close();
});

describe("workspace AI", () => {
  it("is off until the server has a provider and an admin turns it on; members can't change it", async (t) => {
    if (!round7) return t.skip();
    setProviders([]);
    expect(await aiStatus(boWeb, orgId)).toMatchObject({ available: false, reason: "not_configured", provider: null });
    expect((await fail(setAiPolicy(annWeb, orgId, true, "default")))?.code).toBe("ai_not_configured");
    setProviders([provider]);
    expect(await aiStatus(boWeb, orgId)).toMatchObject({ available: false, reason: "workspace_off", canManage: false });
    expect((await fail(setAiPolicy(boWeb, orgId, true, "default")))?.status).toBe(403);
    expect((await fail(aiWrite(boWeb, orgId, "shorter", "hello there")))?.code).toBe("ai_off");
    const on = await setAiPolicy(annWeb, orgId, true, "default");
    expect(on).toMatchObject({ available: true, enabled: true, canManage: true, chosenProvider: null, provider: { id: "anthropic" } });
  });

  it("writing help and a catch-up send only what the browser shows: the draft, and messages it decrypted", async (t) => {
    if (!round7) return t.skip();
    setProviders([provider]);
    provider.sent = [];
    provider.reply = "Thanks, see you at 3.";
    const w = await aiWrite(boWeb, orgId, "friendlier", "meeting at 3. be there");
    expect(w).toMatchObject({ text: "Thanks, see you at 3.", provider: { id: "anthropic" } });
    expect(provider.sent[0].user).toContain("meeting at 3. be there");

    const ch = await createChannel(annWeb, orgId, { name: "launch", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC" });
    await until(() => boWeb.state.get().conversations[ch.id], 6000, "channel on Bo's browser");
    await annWeb.sendText(ch.id, "The beta ships on Friday");
    await annWeb.sendText(ch.id, "Pilot list is in the plan doc");
    await boWeb.openConversation(ch.id);
    const items = await until(
      () => {
        const got = boWeb.state.get().messages[ch.id]?.items ?? [];
        return got.filter((m) => m.kind === "text").length >= 2 ? got : null;
      },
      8000,
      "messages decrypted in Bo's browser",
    );
    const picked = catchUpMessages(items, (id) => boWeb.state.get().users[id]?.displayName ?? "?");
    expect(picked.map((m) => [m.author, m.text])).toEqual([
      ["Ann", "The beta ships on Friday"],
      ["Ann", "Pilot list is in the plan doc"],
    ]);
    provider.sent = [];
    provider.reply = "The beta ships Friday; pilots are listed in the plan.";
    expect((await aiCatchUp(boWeb, orgId, ch.id, picked)).text).toContain("Friday");
    expect(provider.sent[0].user).toContain("Pilot list is in the plan doc");
    await boWeb.openConversation(null);
  });

  it("document summary and ask follow document access; nothing goes out when no document matches; drafts come back off", async (t) => {
    if (!round7) return t.skip();
    setProviders([provider]);
    const shared = await createDocument(annWeb, orgId, { title: "Launch plan", content: "# Goals\n- ship the beta on Friday", access: "workspace", defaultRole: "view", channelId: null, members: [] });
    const secret = await createDocument(annWeb, orgId, { title: "Salaries", content: "private figures", access: "restricted", defaultRole: "view", channelId: null, members: [] });
    provider.reply = "Ship the beta on Friday.";
    expect((await aiDocumentSummary(boWeb, shared.id)).text).toBe("Ship the beta on Friday.");
    expect((await fail(aiDocumentSummary(boWeb, secret.id)))?.status).toBe(404);

    provider.sent = [];
    const none = await aiAsk(boWeb, orgId, "what are the salaries figures");
    expect(none).toMatchObject({ found: false, text: null, sources: [] });
    expect(provider.sent).toHaveLength(0);
    provider.reply = "Friday [1].";
    const asked = await aiAsk(boWeb, orgId, "when does the beta ship");
    expect(asked).toMatchObject({ found: true, text: "Friday [1]." });
    expect(asked.sources.map((s) => s.id)).toEqual([shared.id]);

    expect((await fail(aiWorkflowDraft(boWeb, orgId, "welcome new people", "UTC")))?.status).toBe(403);
    provider.reply = JSON.stringify({
      name: "Welcome",
      trigger: { type: "member.joined" },
      conditions: [],
      actions: [{ type: "post_channel", channelId: "nope", text: "Hi {{member.name}}" }],
      enabled: true,
    });
    const draft = await aiWorkflowDraft(annWeb, orgId, "when someone joins, welcome them", "UTC");
    expect(draft.draft).toMatchObject({ name: "Welcome", enabled: false });
    expect(draft.problems.length).toBeGreaterThan(0);
  });
});
