import { expect, test } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";
import { numericConversationPath } from "../src/application/conversationPaths";

test.use({ serviceWorkers: "block" });

test("a raw channel link opens the Commands picker and submits a native interaction", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const owner = await newPhone("pickerowner", "Picker Owner");
  try {
    const { org } = await owner.req("POST", "/v1/orgs", { name: "Command picker test" });
    const { channels } = await owner.req("GET", "/v1/orgs/" + org.id + "/channels");
    const channel = channels.find((entry: { name: string }) => entry.name === "general");
    const made = await owner.req("POST", "/v2/developer/bots", { name: "Picker Helper", public: true });
    await owner.req("POST", "/v1/orgs/" + org.id + "/bots", { botId: made.bot.id });
    const botToken = "Bot " + made.token;
    const commands = await fetch(process.env.ORBIT_E2E_API + "/v2/bot/commands", {
      method: "PUT",
      headers: { authorization: botToken, "content-type": "application/json" },
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
        ],
      }),
    });
    expect(commands.ok).toBe(true);

    await link(page, owner);
    await page.goto("/channels/" + org.id + "/" + channel.id);
    const canonical = numericConversationPath("home", channel.id, org.id);
    await expect.poll(() => new URL(page.url()).pathname).toBe(canonical);
    const composer = page.getByRole("textbox", { name: /^Message/ });
    await expect(composer).toBeVisible();
    await expect(page.getByRole("button", { name: "Commands", exact: true })).toBeVisible();

    const catalog = "**/v1/orgs/" + org.id + "/commands?*";
    await page.route(catalog, (route) => route.abort());
    await composer.fill("/");
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    const privateDraft = '/message username:@recipient text:"private test draft"';
    await composer.fill(privateDraft);
    await composer.press("Enter");
    await expect(composer).toHaveValue(privateDraft);
    await page.unroute(catalog);

    await composer.fill("/");
    const list = page.getByRole("listbox", { name: "Bot commands", exact: true });
    await list.getByRole("option", { name: /\/message/ }).click();
    const form = page.getByRole("dialog", { name: "/message", exact: true });
    await form.getByRole("textbox", { name: "username", exact: true }).fill("@recipient");
    await form.getByRole("textbox", { name: "text", exact: true }).fill("hello from a native channel command");
    const [submission] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v2/interactions"),
      form.getByRole("button", { name: "Run command", exact: true }).click(),
    ]);
    expect(submission.ok()).toBe(true);

    const claims = await fetch(process.env.ORBIT_E2E_API + "/v2/bot/interactions", { headers: { authorization: botToken } });
    expect(claims.ok).toBe(true);
    const { interactions } = await claims.json();
    expect(interactions).toHaveLength(1);
    expect(interactions[0]).toMatchObject({
      command: "message",
      channelId: channel.id,
      communityId: org.id,
      options: { username: "@recipient", text: "hello from a native channel command" },
    });
    const history = await owner.req("GET", "/v2/conversations/" + channel.id + "/messages");
    expect(JSON.stringify(history.messages)).not.toContain("hello from a native channel command");
    expect(JSON.stringify(history.messages)).not.toContain("private test draft");
    const replied = await fetch(process.env.ORBIT_E2E_API + "/v2/bot/interactions/" + interactions[0].id + "/reply", {
      method: "POST",
      headers: { authorization: botToken, "content-type": "application/json" },
      body: JSON.stringify({ content: "Test delivery acknowledged privately.", ephemeral: true }),
    });
    expect(replied.ok).toBe(true);
    await expect(page.getByText("Test delivery acknowledged privately.", { exact: true })).toBeVisible();
  } finally {
    await owner.disconnect();
  }
});
