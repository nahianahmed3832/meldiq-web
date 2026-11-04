import { expect, test } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: "block", actionTimeout: 15_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("bot controls submit private inputs, recover from failure, and observe current permissions", async ({ page }, info) => {
  const owner = await newPhone("componentowner", "Control Owner");
  const person = await newPhone("componentperson", "Control Recipient");
  try {
    const { org } = await owner.req("POST", "/v1/orgs", { name: "Interactive helpers" });
    const code = (await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" })).invite.code;
    await person.req("POST", "/v1/invites/accept", { code });
    const channelId = (await owner.req("GET", `/v1/orgs/${org.id}/channels`)).channels.find((channel: { name: string }) => channel.name === "general").id;
    const made = await owner.req("POST", "/v2/developer/bots", { name: "Control Helper", public: true });
    const botId = made.bot.id;
    await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId });
    await owner.req("PUT", `/v2/developer/bots/${botId}/permissions`, { rev: 0, permissions: ["messages.post"] });
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${botId}/permissions`, { rev: 0, manifestRev: 1, permissions: ["messages.post"] });
    const bot = async (method: string, path: string, body?: unknown) => {
      const response = await fetch(process.env.ORBIT_E2E_API + path, {
        method,
        headers: { authorization: `Bot ${made.token}`, ...(body ? { "content-type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    };
    const posted = await bot("POST", `/v2/bot/channels/${channelId}/messages`, {
      content: "Choose what to share with this helper.",
      components: [
        { type: "button", customId: "confirm", label: "Confirm choice" },
        {
          type: "select",
          customId: "pick",
          label: "Choose a category",
          options: [
            { label: "First", value: "one" },
            { label: "Second", value: "two" },
          ],
        },
        { type: "form", customId: "feedback", label: "Send feedback", fields: [{ id: "note", label: "Your feedback", style: "paragraph", maxLength: 100 }] },
      ],
    });
    expect(posted.status, JSON.stringify(posted.body)).toBe(200);
    await link(page, person);
    await page.goto(`/dms/c/${channelId}`);
    const messages = page.getByRole("log", { name: "Messages", exact: true });
    const confirmation = messages.getByRole("button", { name: "Confirm choice", exact: true });
    await expect(confirmation).toBeEnabled();
    await confirmation.focus();
    await page.keyboard.press("Enter");
    const select = messages.getByRole("form", { name: "Choose a category", exact: true });
    await select.getByRole("combobox").selectOption("two");
    await select.getByRole("button", { name: "Send", exact: true }).click();
    await messages.getByRole("button", { name: "Send feedback", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Send feedback", exact: true });
    await expect(form.getByText("Control Helper", { exact: true })).toBeVisible();
    await expect(form.getByText("Your input is sent privately to this bot and its developer.", { exact: true })).toBeVisible();
    await form.getByLabel("Your feedback", { exact: true }).fill("Only this bot should receive this form input.");
    const interactionPath = "**/v2/interactions";
    await page.route(interactionPath, (route) => route.abort());
    await form.getByRole("button", { name: "Send", exact: true }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await expect(form.getByLabel("Your feedback")).toHaveValue("Only this bot should receive this form input.");
    await page.unroute(interactionPath);
    await page.screenshot({ path: `docs/yapin-parity/part4/screenshots/bot-form-retry-${info.project.name}.png`, fullPage: true });
    await form.getByRole("button", { name: "Send", exact: true }).click();
    await expect(form).toHaveCount(0);
    const pending = (await bot("GET", "/v2/bot/interactions")).body.interactions;
    expect(pending).toHaveLength(3);
    expect(pending.find((i: any) => i.component.type === "select").component.values).toEqual(["two"]);
    expect(pending.find((i: any) => i.component.type === "form").component.fields.note).toContain("Only this bot");
    expect(JSON.stringify((await person.req("GET", `/v2/conversations/${channelId}/messages`)).messages)).not.toContain("Only this bot");
    expect(JSON.stringify((await bot("GET", "/v2/bot/events")).body)).not.toContain("Only this bot");
    const chosen = pending.find((i: any) => i.component.type === "button");
    expect((await bot("POST", `/v2/bot/interactions/${chosen.id}/reply`, { content: "Private acknowledgement from your helper.", ephemeral: true })).status).toBe(200);
    await expect(page.getByText("Private acknowledgement from your helper.", { exact: true })).toBeVisible();
    const review = await owner.req("GET", `/v1/orgs/${org.id}/bots/${botId}/permissions`);
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${botId}/permissions`, { rev: review.rev, manifestRev: 1, permissions: [] });
    await confirmation.click();
    await expect(messages.getByRole("alert")).toBeVisible();
    expect((await bot("GET", "/v2/bot/interactions")).body.interactions).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/yapin-parity/part4/screenshots/bot-controls-${info.project.name}.png`, fullPage: true });
  } finally {
    await person.disconnect();
    await owner.disconnect();
  }
});
