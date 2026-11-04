import { expect, test } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: "block", actionTimeout: 15_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("personal bot approval, messaging, revocation and fresh consent use the real API", async ({ page }, info) => {
  const owner = await newPhone("dmbotowner", "DM Bot Owner");
  const person = await newPhone("dmbotperson", "DM Recipient");
  try {
    const { org } = await owner.req("POST", "/v1/orgs", { name: "Personal bot consent" });
    const code = (await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" })).invite.code;
    await person.req("POST", "/v1/invites/accept", { code });
    const channelId = (await owner.req("GET", `/v1/orgs/${org.id}/channels`)).channels.find((channel: { name: string }) => channel.name === "general").id;
    const made = await owner.req("POST", "/v2/developer/bots", { name: "Consent Helper", public: true });
    await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId: made.bot.id });
    await owner.req("PUT", `/v2/developer/bots/${made.bot.id}/permissions`, { rev: 0, permissions: ["direct_messages"] });
    const bot = async (method: string, path: string, body?: unknown) => {
      const response = await fetch(process.env.ORBIT_E2E_API + path, {
        method,
        headers: { authorization: `Bot ${made.token}`, ...(body ? { "content-type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    expect((await bot("POST", `/v2/bot/users/${person.userId}/dm`, { content: "Must wait for consent" })).status).toBe(404);
    expect((await bot("POST", `/v2/bot/channels/${channelId}/messages`, { content: "Open my profile to choose personal messages." })).status).toBe(200);
    await link(page, person);
    await page.goto(`/dms/c/${channelId}`);
    await page.locator(".msg-name").filter({ hasText: "Consent Helper" }).first().click();
    const dialog = page.getByRole("dialog");
    const personal = dialog.getByRole("region", { name: "Direct messages", exact: true });
    const approval = personal.getByRole("checkbox", { name: "Allow bot messages" });
    await expect(approval).not.toBeChecked();
    await expect(personal.getByText("This bot and its developer can read messages in this chat.", { exact: true })).toBeVisible();
    await expect(personal.getByRole("button", { name: "Message", exact: true })).toHaveCount(0);
    await expect(approval).toBeEnabled();
    await approval.focus();
    await page.keyboard.press("Space");
    await expect(approval).toBeChecked();
    await expect(personal.getByRole("button", { name: "Message", exact: true })).toBeEnabled();
    const consent = await person.req("GET", `/v2/bots/${made.bot.id}/direct-messages`);
    expect(consent.enabled).toBe(true);
    const firstConversation = consent.conversationId;
    await page.screenshot({ path: `docs/yapin-parity/part4/screenshots/bot-dm-consent-${info.project.name}.png`, fullPage: true });
    expect((await bot("POST", `/v2/bot/users/${person.userId}/dm`, { content: "Personal bot response after approval." })).status).toBe(200);
    await personal.getByRole("button", { name: "Message", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dms/c/${firstConversation}$`));
    const messages = page.getByRole("log", { name: "Messages", exact: true });
    await expect(messages.getByText("Personal bot response after approval.", { exact: true })).toBeVisible();
    const composer = page.getByLabel("Message Consent Helper", { exact: true });
    await composer.fill("A recipient reply visible only in the approved bot conversation.");
    await composer.press("Enter");
    await expect
      .poll(async () =>
        (await bot("GET", `/v2/bot/conversations/${firstConversation}/messages`)).body.messages.some(
          (m: { payload: { text: string } }) => m.payload.text === "A recipient reply visible only in the approved bot conversation.",
        ),
      )
      .toBe(true);
    await page.locator(".msg-name").filter({ hasText: "Consent Helper" }).first().click();
    await expect(approval).toBeChecked();
    await expect(approval).toBeEnabled();
    await approval.uncheck();
    await expect(approval).not.toBeChecked();
    await expect.poll(async () => (await person.req("GET", `/v2/bots/${made.bot.id}/direct-messages`)).enabled).toBe(false);
    expect((await bot("POST", `/v2/bot/users/${person.userId}/dm`, { content: "Must not send after revocation" })).status).toBe(403);
    expect((await bot("GET", `/v2/bot/conversations/${firstConversation}/messages`)).status).toBe(403);
    await approval.check();
    await expect(personal.getByRole("button", { name: "Message", exact: true })).toBeEnabled();
    const renewed = await person.req("GET", `/v2/bots/${made.bot.id}/direct-messages`);
    expect(renewed.conversationId).not.toBe(firstConversation);
    await personal.getByRole("button", { name: "Message", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dms/c/${renewed.conversationId}$`));
    await expect(messages.getByText("Personal bot response after approval.", { exact: true })).toHaveCount(0);
    await expect(messages.getByRole("article")).toHaveCount(0);
    expect((await bot("GET", `/v2/bot/conversations/${renewed.conversationId}/messages`)).body.messages).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await person.disconnect();
    await owner.disconnect();
  }
});
