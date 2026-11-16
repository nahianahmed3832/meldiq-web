import { expect, test } from "@playwright/test";
import { numericConversationPath } from "../src/application/conversationPaths";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });

test("a configured bot DM command prepares a draft and only sends after confirmation", async ({ page, context }) => {
  const serverInfo = await fetch(process.env.ORBIT_E2E_API + "/v1/server-info");
  expect(serverInfo.ok).toBe(true);
  const { features } = await serverInfo.json();
  test.skip(!features.includes("bot-direct-messages"), "Bot DMs need the PostgreSQL-backed test server.");

  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const owner = await newPhone("dmcommandsowner", "DM Commands Owner");
  const person = await newPhone("dmcommandsperson", "DM Commands Person");
  try {
    const { org } = await owner.req("POST", "/v1/orgs", { name: "DM Commands Test" });
    const { invite } = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" });
    await person.req("POST", "/v1/invites/accept", { code: invite.code });
    const { bot, token } = await owner.req("POST", "/v2/developer/bots", { name: "DM Commands Manager", public: true });
    await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId: bot.id });
    await owner.req("PUT", `/v2/developer/bots/${bot.id}/permissions`, { rev: 0, permissions: ["direct_messages"] });

    const registered = await fetch(process.env.ORBIT_E2E_API + "/v2/bot/commands", {
      method: "PUT",
      headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        commands: [
          {
            name: "message",
            description: "Send a private message",
            options: [
              { name: "username", type: "string", required: true, description: "Recipient username" },
              { name: "text", type: "string", required: true, description: "Message text" },
            ],
          },
          {
            name: "assign",
            description: "Assign an employee task",
            options: [
              { name: "username", type: "string", required: true, description: "Recipient username" },
              { name: "title", type: "string", required: true, description: "Task title" },
              { name: "deadline", type: "string", required: true, description: "Task deadline" },
              { name: "deliverable", type: "string", required: true, description: "What the employee should deliver" },
            ],
          },
        ],
      }),
    });
    expect(registered.ok).toBe(true);

    const consentPath = `/v2/bots/${bot.id}/direct-messages`;
    const previous = await person.req("GET", consentPath);
    const approved = await person.req("PUT", consentPath, {
      enabled: true,
      rev: previous.rev,
      manifestRev: previous.manifestRev,
      noticeVersion: previous.noticeVersion,
    });
    expect(approved.conversationId).toBeTruthy();
    const readBotHistory = async () => {
      const response = await fetch(process.env.ORBIT_E2E_API + `/v2/bot/conversations/${approved.conversationId}/messages`, {
        headers: { authorization: `Bot ${token}` },
      });
      expect(response.ok).toBe(true);
      const { messages } = await response.json();
      return messages.map((message: { payload: { text: string } }) => message.payload.text) as string[];
    };

    let finishConfig = () => {};
    const configReady = new Promise<void>((resolve) => {
      finishConfig = resolve;
    });
    await page.addInitScript(() => localStorage.setItem("meldiq.config.v1", JSON.stringify({ directBotCommands: null })));
    await page.route("**/config.json", async (route) => {
      await configReady;
      await route.fulfill({ json: { directBotCommands: { botId: bot.id, communityId: org.id } } });
    });
    // The opted-in bot DM is already available while the community list has yet to sync.
    await page.route("**/v1/orgs", (route) => route.fulfill({ json: { orgs: [] } }));
    const [plans, subscription] = await Promise.all([person.req("GET", "/v2/mojo/catalog"), person.req("GET", "/v2/mojo/me")]);
    await page.route("**/v2/mojo/catalog", (route) => route.fulfill({ json: { ...plans, enforced: true } }));
    await page.route("**/v2/mojo/me", (route) => route.fulfill({ json: { ...subscription, perks: { ...subscription.perks, messageChars: 4_000 } } }));
    await link(page, person);
    await page.goto(numericConversationPath("dms", approved.conversationId));
    const composer = page.getByRole("textbox", { name: "Message DM Commands Manager", exact: true });
    await expect(composer).toBeVisible();
    await expect(page.getByRole("button", { name: "Commands", exact: true })).toHaveCount(0);
    await composer.fill("/");
    const catalog = page.getByRole("listbox", { name: "Bot commands", exact: true });
    await expect(catalog).toHaveCount(0);
    finishConfig();
    await catalog.getByRole("option", { name: /\/message/ }).click();
    const form = page.getByRole("dialog", { name: "/message", exact: true });
    await form.getByRole("textbox", { name: "username", exact: true }).fill("@recipient");
    const text = 'Say "hello"\nnext';
    await form.getByRole("textbox", { name: "text", exact: true }).fill(text);
    await form.getByRole("button", { name: "Insert command", exact: true }).click();

    const draft = `/message username:"@recipient" text:${JSON.stringify(text)}`;
    await expect(composer).toHaveValue(draft);
    expect(await readBotHistory()).toEqual([]);
    await composer.press("Enter");
    await expect.poll(readBotHistory).toContain(draft);

    await composer.fill("/");
    await catalog.getByRole("option", { name: /\/assign/ }).click();
    const assignment = page.getByRole("dialog", { name: "/assign", exact: true });
    await assignment.getByRole("textbox", { name: "username", exact: true }).fill("@recipient");
    await assignment.getByRole("textbox", { name: "title", exact: true }).fill("Stock audit");
    await assignment.getByRole("textbox", { name: "deadline", exact: true }).fill("2026-11-17 11:36 Asia/Shanghai");
    const deliverable = assignment.getByRole("textbox", { name: "deliverable", exact: true });
    const insert = assignment.getByRole("button", { name: "Insert command", exact: true });

    const oversized = "x".repeat(2_001);
    await deliverable.fill(oversized);
    await expect(deliverable).toHaveValue(oversized);
    await insert.click();
    await expect(assignment.getByRole("alert")).toContainText("deliverable");

    // Exactly 2,000 quotes fit the field but JSON escaping pushes the full DM over the plan's limit.
    await deliverable.fill('"'.repeat(2_000));
    await insert.click();
    await expect(assignment.getByRole("alert")).toContainText("4,000");

    const fullText = "Warehouse count and link https://example.test/stock. ".padEnd(2_000, "x");
    await deliverable.fill(fullText);
    await expect(assignment.getByText("2,000 / 2,000", { exact: true })).toBeVisible();
    await insert.click();
    const longDraft = `/assign username:"@recipient" title:"Stock audit" deadline:"2026-11-17 11:36 Asia/Shanghai" deliverable:${JSON.stringify(fullText)}`;
    await expect(composer).toHaveValue(longDraft);
    await composer.press("Enter");
    await expect.poll(readBotHistory).toContain(longDraft);
  } finally {
    await owner.disconnect();
    await person.disconnect();
  }
});
