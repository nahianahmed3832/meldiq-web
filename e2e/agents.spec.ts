import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";
import { serverDir } from "../test/support/serverDir";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * AI Workforce in Meldiq Web (server docs/AI_WORKFORCE.md) against the throwaway test server: a community owner opens
 * AI agents, installs Product Video Editor from the catalog, renames it and assigns it to a channel; in the channel the
 * agents bar shows it, a message naming it opens the agent request (with its notice) instead of being sent, the
 * request asks for footage; then the General Assistant is asked, and the request is refused plainly because this test
 * server has no verified model. Tests that need a request accepted get testModel(): a verified model whose provider key
 * can't be opened, so the job fails without anything leaving this machine. Screenshots go to E2E_SHOTS when set.
 *
 * The platform side (AI on, AI Workforce on, two agents published) is what an operator does in the Platform Admin
 * Console, whose own browser test covers it; here those rows are written straight into the test server's database.
 */
const SHOTS = process.env.E2E_SHOTS;

function testDb() {
  const req = createRequire(path.join(serverDir(), "package.json"));
  const Database = req("better-sqlite3") as new (file: string) => { prepare(sql: string): { run(...a: unknown[]): unknown }; close(): void };
  return new Database(path.join(process.env.ORBIT_E2E_DATA!, "griip.sqlite"));
}

/**
 * A text model the server treats as verified (an operator's Set up in the console), on a provider whose stored key
 * isn't a sealed key: requests are accepted and routed, and fail at the gateway without a network call. Off removes it.
 */
function testModel(on: boolean): void {
  const db = testDb();
  const t = Date.now();
  db.prepare("DELETE FROM ai_model_capabilities WHERE provider_id = 'aip_e2e'").run();
  db.prepare("DELETE FROM ai_models WHERE provider_id = 'aip_e2e'").run();
  db.prepare("DELETE FROM ai_providers WHERE id = 'aip_e2e'").run();
  if (on) {
    db.prepare(
      "INSERT INTO ai_providers (id, kind, name, enabled, secret_ciphertext, secret_set_at, max_retries, created_by, created_at, updated_at) VALUES ('aip_e2e', 'openai', 'E2E', 1, 'not-a-sealed-key', ?, 0, 'e2e', ?, ?)",
    ).run(t, t, t);
    db.prepare("INSERT INTO ai_models (provider_id, model, enabled) VALUES ('aip_e2e', 'gpt-e2e', 1)").run();
    db.prepare("INSERT INTO ai_model_capabilities (provider_id, model, capability, verified_at, verify_ok, verify_detail) VALUES ('aip_e2e', 'gpt-e2e', 'text', ?, 1, 'e2e')").run(t);
  }
  db.close();
}

function platformReady(): void {
  const db = testDb();
  const t = Date.now();
  for (const key of ["ai.enabled", "ai.workforce.enabled"]) {
    db.prepare("INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES (?, 'true', 'e2e', ?) ON CONFLICT (key) DO UPDATE SET value = 'true'").run(key, t);
  }
  for (const agent of ["general_assistant", "product_video_editor"]) {
    db.prepare(
      "INSERT INTO ai_agent_templates (agent_id, version, status, availability, policy, updated_by, created_at, updated_at) VALUES (?, 1, 'published', 'all', '{}', 'e2e', ?, ?) ON CONFLICT DO NOTHING",
    ).run(agent, t, t);
  }
  db.close();
}

test("a community installs an agent, assigns it to a channel and asks it from the channel", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Agent Lab" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "marketing", scope: "ORG" })).channel.id as string;
  await link(page, alice);

  // AI agents: nothing installed; the catalog shows what the platform published, with what's missing to work.
  await page.goto("/#/workspace/agents");
  await expect(page.getByText("No agent is installed yet.")).toBeVisible();
  await expect(page.getByText(/n't end-to-end encrypted/).first()).toBeVisible();
  await page.getByRole("button", { name: "Add agents" }).click();
  const catalog = page.getByRole("dialog", { name: "Agent catalog" });
  await expect(catalog.getByText("Product Video Editor")).toBeVisible();
  await expect(catalog.getByText(/Setup needed: .*No verified model/).first()).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-01-catalog.png` });
  await catalog.locator("article", { hasText: "Product Video Editor" }).getByRole("button", { name: "Install" }).click();

  // Its settings: a name of the community's own, and the channel.
  await expect(page.getByRole("heading", { name: "Product Video Editor", level: 3 })).toBeVisible();
  await page.getByLabel(/^Name/).fill("Reel Maker");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  // The box follows the server's answer (it's checked once the assignment is saved).
  await page.getByRole("tab", { name: "4. Channels" }).click();
  await page.getByRole("checkbox", { name: "In #marketing" }).click();
  await expect(page.getByRole("checkbox", { name: "In #marketing" })).toBeChecked();
  await expect(page.getByLabel("How Reel Maker is asked in #marketing")).toHaveValue("mention");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-02-settings.png`, fullPage: true });

  // The channel: the agents bar, and a message naming the agent opens its request instead of being sent.
  await page.goto(`/#/home/c/${channel}`);
  await expect(page.locator(".agent-bar")).toContainText("Reel Maker works here");
  const composer = page.locator(".composer textarea").first();
  await composer.fill("@Reel Maker a 20-second teaser for the launch");
  await composer.press("Enter");
  // The first request from this browser asks for the notice once; this agent needs footage, so the form opens.
  const notice = page.getByRole("dialog", { name: "Send to Reel Maker?" });
  await expect(notice.getByText(/n't end-to-end encrypted/)).toBeVisible();
  await notice.getByRole("button", { name: "Send" }).click();
  const ask = page.getByRole("dialog", { name: "Ask an AI agent" });
  await expect(ask.getByLabel("What should it do?")).toHaveValue("a 20-second teaser for the launch");
  await expect(ask.getByText(/needs a file/)).toBeVisible();
  await expect(ask.getByRole("button", { name: "Send to the agent" })).toBeDisabled();
  await expect(ask.getByText(/n't end-to-end encrypted/)).toBeVisible();
  await expect(composer).toHaveValue("");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-03-ask-from-channel.png` });
  await ask.getByRole("button", { name: "Cancel" }).click();

  // The General Assistant, from the AI agents page: without a verified model the server refuses the request plainly
  // (nothing is queued that could only fail).
  await page.goto("/#/workspace/agents");
  await page.getByRole("button", { name: "Add agents" }).click();
  await page.getByRole("dialog", { name: "Agent catalog" }).locator("article", { hasText: "General Assistant" }).getByRole("button", { name: "Install" }).click();
  // Installing opens the agent's settings; their back button returns to the list.
  await page.locator("button.btn-secondary", { hasText: "AI agents" }).click();
  await page.locator(".ws-row", { hasText: "General Assistant" }).getByRole("button", { name: "Ask" }).click();
  const ask2 = page.getByRole("dialog", { name: "Ask an AI agent" });
  await ask2.getByLabel("What should it do?").fill("Summarise our launch plan in three bullet points.");
  await ask2.getByRole("button", { name: "Send to the agent" }).click();
  await expect(ask2.getByText(/General Assistant can't work yet: no verified model for quick replies and classification/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-04-request-refused.png`, fullPage: true });
  await ask2.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("tab", { name: "Requests" }).click();
  await expect(page.locator(".ws-row", { hasText: "General Assistant" })).toHaveCount(0);
});

test("a request from a channel can share the channel's recent messages, decrypted in the browser", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  testModel(true);
  const [alice, bob] = await Promise.all([newPhone("alice", "Alice Rahman"), newPhone("bob", "Bob Okafor")]);
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Launch Crew" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "launch", scope: "ORG" })).channel.id as string;
  const code = (await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 2 })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  await bob.req("POST", `/v1/conversations/${channel}/join`).catch(() => undefined);
  const agent = (await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" })).agent.id as string;
  await alice.req("PUT", `/v1/orgs/${org.id}/ai/agents/${agent}/channels/${channel}`, { activation: "mention" });
  await link(page, alice);

  // A real end-to-end encrypted message in the channel: only members' devices, this browser among them, can read it.
  await bob.send(channel, { type: "text", text: "The launch moves to Thursday because the build failed." });
  await page.goto(`/#/home/c/${channel}`);
  await expect(page.getByText("The launch moves to Thursday because the build failed.")).toBeVisible();

  // Asking the agent: nothing from the channel goes unless a number of messages is chosen, and the notice says so.
  // Sharing messages is in the full form (the Ask button); "@Agent …" sends just the text.
  await page.getByRole("button", { name: "Ask an agent" }).click();
  const ask = page.getByRole("dialog", { name: "Ask an AI agent" });
  await ask.getByLabel("What should it do?").fill("what did we decide?");
  await expect(ask.getByText("Only what you put here is sent, never the channel's messages.")).toBeVisible();
  const share = ask.getByLabel("Share recent messages from this channel");
  await expect(share).toHaveValue("0");
  await share.selectOption({ label: "The one recent message" });
  await expect(ask.getByText(/The last message here, as this browser shows it, is sent with your request, whoever wrote it\. Everyone in the channel is told\./)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-05-share-messages.png` });

  // What leaves the browser: the decrypted text, its author's name and time, and nothing else from the channel.
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/v1/orgs/${org.id}/ai/jobs`));
  await ask.getByRole("button", { name: "Send to the agent" }).click();
  const body = (await sent).postDataJSON();
  expect(body.channelMessages).toEqual([{ author: "Bob Okafor", text: "The launch moves to Thursday because the build failed.", at: expect.any(Number) }]);
  expect(body.conversationId).toBe(channel);

  // The channel is told, for everyone in it: the request shows among the messages.
  await expect(page.getByRole("log", { name: "Messages" }).getByText(/Shared the last message here with the agent \(not end-to-end encrypted\)/)).toBeVisible();
  const { posts } = await bob.req("GET", `/v1/conversations/${channel}/ai/posts`);
  expect(posts.some((p: { body: string }) => p.body.includes("Shared the last message here with the agent"))).toBe(true);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-06-shared-in-channel.png` });
  testModel(false);
});

test("a community's settings list scrolls to AI agents in a short window", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this layout check");
  platformReady();
  const alice = await newPhone("alice", "Alice Rahman");
  await alice.req("POST", "/v1/orgs", { name: "Tall Settings" });
  await link(page, alice);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/#/workspace/overview");
  const nav = page.locator(".settings-nav");
  await expect(nav).toBeVisible();
  // The list is taller than the window, and the mouse wheel scrolls it (it used to be cut off at MORE).
  expect(await nav.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
  await nav.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => nav.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
  const agents = nav.getByRole("button", { name: "AI agents" });
  await expect(agents).toBeInViewport();
  await agents.click();
  await expect(page.getByRole("button", { name: "AI agents" }).first()).toHaveAttribute("aria-current", "page");
});

test("the agent catalog scrolls when it's taller than the window, with its search kept in view", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this layout check");
  platformReady();
  const alice = await newPhone("alice", "Alice Rahman");
  await alice.req("POST", "/v1/orgs", { name: "Short Window" });
  await link(page, alice);
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/#/workspace/agents");
  await page.getByRole("button", { name: "Add agents" }).click();
  const catalog = page.getByRole("dialog", { name: "Agent catalog" });
  const body = catalog.locator(".scroll");
  await expect(catalog.getByText("Product Video Editor")).toBeVisible();
  // Taller than the dialog, and the mouse wheel scrolls it (it used to be cut off with no way down).
  expect(await body.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
  await body.hover();
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => body.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
  await expect(catalog.getByRole("button", { name: "Install" }).last()).toBeInViewport();
  await expect(catalog.getByLabel("Search agents")).toBeInViewport();
  // Escape closes it, as other dialogs do.
  await page.keyboard.press("Escape");
  await expect(catalog).toBeHidden();
});

test("an agent can be removed straight from the list, after a confirmation", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Tidy Lab" });
  await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" });
  await link(page, alice);
  await page.goto("/#/workspace/agents");
  const row = page.locator(".ws-row", { hasText: "General Assistant" });
  await expect(row).toBeVisible();

  // Cancel keeps it; Remove takes it out of the community, and the catalog offers it again.
  await row.getByRole("button", { name: "Remove General Assistant" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove General Assistant?" });
  await expect(confirm).toContainText("requests in progress are cancelled");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Remove General Assistant" }).click();
  await page.getByRole("dialog", { name: "Remove General Assistant?" }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("No agent is installed yet.")).toBeVisible();
  const { agents } = await alice.req("GET", `/v1/orgs/${org.id}/ai`);
  expect(agents).toEqual([]);
  await page.getByRole("button", { name: "Add agents" }).click();
  await expect(page.getByRole("dialog", { name: "Agent catalog" }).locator("article", { hasText: "General Assistant" }).getByRole("button", { name: "Install" })).toBeVisible();
});

test("a channel's agents are listed beside its people, marked AI, and open Ask", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Bot Corner" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "help", scope: "ORG" })).channel.id as string;
  const helper = (await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" })).agent.id as string;
  await alice.req("PUT", `/v1/orgs/${org.id}/ai/agents/${helper}/channels/${channel}`, { activation: "mention" });
  // Installed but not in this channel: not listed here.
  await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "product_video_editor" });
  await link(page, alice);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/#/home/c/${channel}`);

  const members = page.getByRole("complementary", { name: "Members" });
  if (!(await members.isVisible()))
    await page
      .getByRole("button", { name: /members/i })
      .first()
      .click();
  const agents = members.getByRole("region", { name: "AI agents, 1" });
  await expect(agents).toBeVisible();
  await expect(agents).toContainText("They can't read this channel: they see only what you send them.");
  await expect(agents.locator(".ai-tag")).toHaveText("AI");
  await expect(agents).not.toContainText("Product Video Editor");
  // People are still listed, below.
  await expect(members).toContainText("Alice Rahman");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-07-member-list.png` });

  await agents.getByRole("button", { name: "General Assistant, AI agent: ask" }).click();
  const ask = page.getByRole("dialog", { name: "Ask an AI agent" });
  await expect(ask.getByLabel("Agent")).toHaveValue(helper);
  await expect(ask.getByText(/n't end-to-end encrypted/)).toBeVisible();
});

test("agents work like bots: @Agent sends at once, and the request and the answer show in the chat", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  testModel(true);
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Bot Chat" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "ask", scope: "ORG" })).channel.id as string;
  const helper = (await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" })).agent.id as string;
  await alice.req("PUT", `/v1/orgs/${org.id}/ai/agents/${helper}/channels/${channel}`, { activation: "mention" });
  await link(page, alice);
  await page.goto(`/#/home/c/${channel}`);
  await expect(page.locator(".agent-bar")).toContainText("type @General Assistant and your question");

  const composer = page.locator(".composer textarea").first();
  const log = page.getByRole("log", { name: "Messages" });
  await composer.fill("@General Assistant what is our refund policy?");
  await composer.press("Enter");
  // Asked once on this browser, then straight to the agent.
  await page.getByRole("dialog", { name: "Send to General Assistant?" }).getByRole("button", { name: "Send" }).click();
  await expect(composer).toHaveValue("");
  const request = log.locator(".agent-msg.request");
  await expect(request).toContainText("what is our refund policy?");
  await expect(request).toContainText("to General Assistant · not end-to-end encrypted");
  // The agent answers in the chat with its AI tag (the test model's provider can't be reached, so the answer is its failure).
  const answer = log.locator(".agent-msg.error");
  await expect(answer).toContainText("I couldn't finish this", { timeout: 60_000 });
  await expect(answer.locator(".ai-tag")).toHaveText("AI");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-08-bot-chat.png` });

  // A second request goes straight through: no notice, no form.
  await composer.fill("@General Assistant and the shipping times?");
  await composer.press("Enter");
  await expect(log.locator(".agent-msg.request", { hasText: "and the shipping times?" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  testModel(false);
});

test("an admin configures an agent step by step: readiness says what's missing, autonomy, triggers, a real test", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Configure Lab" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "digest", scope: "ORG" })).channel.id as string;
  const helper = (await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" })).agent.id as string;
  await alice.req("PUT", `/v1/orgs/${org.id}/ai/agents/${helper}/channels/${channel}`, { activation: "mention" });
  await link(page, alice);
  await page.goto("/#/workspace/agents");
  await page.locator(".ws-row", { hasText: "General Assistant" }).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Configure General Assistant")).toBeVisible();

  // This test server has no AI provider: the readiness says so, and who fixes it.
  await expect(page.locator(".agent-config-head .status-pill")).toContainText("missing");
  await page.getByRole("tab", { name: "2. Models" }).click();
  await expect(page.getByText(/No verified model for quick replies/)).toBeVisible();
  await expect(page.getByText(/A platform operator fixes this in the AI Control Center/).first()).toBeVisible();

  // Permissions are least privilege, and reading channel messages is never possible.
  await page.getByRole("tab", { name: "5. Permissions" }).click();
  await expect(page.locator(".ws-row", { hasText: "Read channel messages and history" })).toContainText("Never");

  // Autonomy: continuous, which runs triggers (none yet, and it says so).
  await page.getByRole("tab", { name: "6. Autonomy" }).click();
  await expect(page.getByRole("radio", { name: /Assisted/ })).toBeChecked();
  // The choice shows once the server has saved it.
  await page.getByRole("radio", { name: /Continuous/ }).click();
  await expect(page.getByText("Autonomy: Continuous.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Continuous/ })).toBeChecked();
  await expect(page.getByText(/no trigger yet/)).toBeVisible();

  // Triggers: a daily schedule posting in #digest, and a webhook whose secret shows once.
  await page.getByRole("tab", { name: "7. Triggers" }).click();
  await page.getByRole("button", { name: "Add a trigger" }).click();
  await page.getByLabel("Name").fill("Daily digest");
  await page.getByLabel("What it should do each time").fill("Summarise what was decided today.");
  await page.getByLabel("Post the request and answers in").selectOption({ label: "#digest" });
  await page.getByRole("button", { name: "Save trigger" }).click();
  const row = page.locator(".ws-row", { hasText: "Daily digest" });
  await expect(row).toContainText("every day at 09:00");
  await expect(row).toContainText("posts in #digest");
  await page.getByRole("button", { name: "Add a trigger" }).click();
  await page.getByLabel("When").selectOption("webhook");
  await page.getByLabel("Name").fill("Help desk");
  await page.getByLabel("What it should do each time").fill("Draft a reply to the customer.");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await expect(page.getByText("Copy the webhook secret now: it isn't shown again.")).toBeVisible();
  const { triggers } = await alice.req("GET", `/v1/orgs/${org.id}/ai/agents/${helper}/triggers`);
  expect(triggers.map((t: { kind: string }) => t.kind).sort()).toEqual(["schedule", "webhook"]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-09-triggers.png`, fullPage: true });

  // Test & activate: every check, and a real test request, refused plainly without a verified model.
  await page.getByRole("tab", { name: "9. Test & activate" }).click();
  await expect(page.getByRole("region", { name: "Readiness" })).toContainText("Triggers to run on its own");
  await page.getByRole("button", { name: "Test this agent" }).click();
  await expect(page.getByRole("region", { name: "Test" }).getByRole("alert")).toContainText("can't work yet: no verified model for quick replies and classification");
  // Nothing was queued, so nothing failed.
  await expect(page.getByRole("region", { name: "Activity" })).toContainText("0 failed");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-10-test.png`, fullPage: true });
});

test("tasks for people: an admin gives one, the person hands it in, the admin accepts it", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  const [alice, bob] = await Promise.all([newPhone("alice", "Alice Rahman"), newPhone("bob", "Bob Okafor")]);
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Task Lab" });
  const code = (await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1 })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  await link(page, alice);
  await page.goto("/#/workspace/agents");
  await page.getByRole("tab", { name: "Tasks" }).click();
  await expect(page.getByText(/Tasks, notes and files handed in aren't end-to-end encrypted/)).toBeVisible();
  // Nobody may be given work by the Agent Manager until an admin says so.
  await expect(page.getByText("Nobody yet: the Agent Manager can't give work to people.")).toBeVisible();

  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill("Count shelf B");
  await dialog.getByLabel("What to do").fill("Count the grips on shelf B and note the number.");
  await dialog.getByLabel("For").selectOption({ label: "Bob Okafor" });
  await dialog.getByRole("button", { name: "Give the task" }).click();
  // The new task opens: Alice can cancel or reassign it, but only Bob can accept it.
  await expect(page.getByRole("region", { name: "Count shelf B" })).toContainText("New · for Bob Okafor");
  await expect(page.getByRole("button", { name: "Accept", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel task" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-11-task.png`, fullPage: true });

  // Bob accepts and hands it in (from his phone).
  const { tasks } = await bob.req("GET", `/v1/orgs/${org.id}/ai/tasks?scope=mine`);
  const id = tasks[0].id as string;
  let rev = (await bob.req("GET", `/v1/orgs/${org.id}/ai/tasks/${id}`)).task.rev;
  rev = (await bob.req("POST", `/v1/orgs/${org.id}/ai/tasks/${id}/accept`, { rev })).task.rev;
  await bob.req("POST", `/v1/orgs/${org.id}/ai/tasks/${id}/submit`, { rev, note: "42 grips on shelf B." });

  // Alice sees what he handed in, and accepts the work.
  await expect(page.getByText("42 grips on shelf B.").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Accept the work" }).click();
  await expect(page.getByRole("region", { name: "Count shelf B" })).toContainText("Done · for Bob Okafor");
  await expect(page.getByRole("region", { name: "History" })).toContainText("approved by Alice Rahman");
});

test("Health: an admin runs the full system check and sees what needs attention, with evidence and what to do", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  testModel(false);
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Health Lab" });
  await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" });
  await link(page, alice);
  await page.goto("/#/workspace/agents");
  await page.getByRole("tab", { name: "Health" }).click();
  await expect(page.getByText("No check has run here yet.")).toBeVisible();
  await page.getByRole("button", { name: "Run full system check" }).click();
  // No verified model on this test server: the agent can't work, and the report says so first, with what to do.
  const attention = page.getByRole("list", { name: "Needs attention" });
  await expect(attention).toContainText("General Assistant");
  await expect(attention).toContainText("Failed");
  await expect(attention).toContainText("What to do:");
  // Real smoke tests ran (the AI file store round-trip), and what couldn't be proved safely says why.
  await page.getByText(/^Healthy \(\d+\)$/).click();
  await expect(page.getByText(/SHA-256 matched/)).toBeVisible();
  await expect(page.getByText(/^Not tested \(\d+\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-13-health.png`, fullPage: true });
  // A second run keeps the first in the history.
  await page.getByRole("button", { name: "Run full system check" }).click();
  await expect(page.getByRole("region", { name: "Earlier checks" }).getByRole("listitem")).toHaveCount(2);
});

/** The platform setting that lets channels' managers switch an agent's reading on (off by default). */
function readingAllowed(on: boolean): void {
  const db = testDb();
  db.prepare("INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('ai.workforce.channel_reading', ?, 'e2e', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(
    on ? "true" : "false",
    Date.now(),
  );
  db.close();
}

test("an agent that reads a channel: the notice and choice, @mention as a message, commands, and a direct conversation", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "one engine is enough for this flow");
  platformReady();
  readingAllowed(true);
  testModel(true);
  const alice = await newPhone("alice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Reading Lab" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "support", scope: "ORG" })).channel.id as string;
  const helper = (await alice.req("POST", `/v1/orgs/${org.id}/ai/agents`, { agentId: "general_assistant" })).agent.id as string;
  await alice.req("PUT", `/v1/orgs/${org.id}/ai/agents/${helper}/channels/${channel}`, { activation: "mention" });
  await link(page, alice);

  // Agent settings › Channels: let it read #support, with a reason everyone in the channel sees.
  await page.goto("/#/workspace/agents");
  await page.locator(".ws-row", { hasText: "General Assistant" }).getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "4. Channels" }).click();
  const reading = page.getByRole("region", { name: "Reading channels" });
  await expect(reading).toContainText("It doesn't read any channel.");
  await reading.getByLabel("Reason (shown to the channel)").fill("Answer support questions from the team");
  await reading.getByLabel("Channel to read").selectOption({ label: "#support" });
  await reading.getByRole("button", { name: "Let it read this channel" }).click();
  await expect(reading).toContainText("#support");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-12-reading-settings.png`, fullPage: true });

  // The channel: the notice, and the composer waits for this person's choice.
  await page.goto(`/#/home/c/${channel}`);
  await expect(page.getByText(/General Assistant \(AI agent\) reads new messages here from members who share theirs/)).toBeVisible();
  const choice = page.getByRole("group", { name: "Share your messages with General Assistant?" });
  await expect(choice).toBeVisible();
  await expect(page.locator(".composer textarea")).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-13-reader-choice.png` });
  await choice.getByRole("button", { name: "Share my messages with General Assistant" }).click();
  await expect(page.getByText("You share yours.")).toBeVisible();

  // "/" lists the agents' commands.
  const composer = page.locator(".composer textarea").first();
  await composer.fill("/gen");
  await expect(page.getByRole("listbox", { name: "Agent commands" })).toContainText("/generalassistant");
  // "@General Assistant …" now goes as an ordinary encrypted message: the agent reads it and answers in its thread.
  await composer.fill("@General Assistant what is our refund window?");
  await composer.press("Escape");
  await composer.press("Enter");
  const log = page.getByRole("log", { name: "Messages" });
  await expect(log.getByText("@General Assistant what is our refund window?")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The job is the agent's answer to that message (the test model's provider can't be reached, so it reports a failure).
  await expect.poll(async () => (await alice.req("GET", `/v1/orgs/${org.id}/ai/jobs?scope=mine`)).jobs.length, { timeout: 30_000 }).toBeGreaterThan(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-14-mention-as-message.png` });

  // A direct conversation from the member list (which says the agent reads here): everything written there is for it.
  const members = page.getByRole("complementary", { name: "Members" });
  if (!(await members.isVisible()))
    await page
      .getByRole("button", { name: /members/i })
      .first()
      .click();
  await expect(members.getByRole("region", { name: "AI agents, 1" })).toContainText("reads here");
  await page.getByRole("button", { name: "Message General Assistant" }).click();
  await expect(page.getByText(/A direct conversation with General Assistant \(AI agent\)/)).toBeVisible({ timeout: 20_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agents-15-direct.png` });
  testModel(false);
  readingAllowed(false);
});
