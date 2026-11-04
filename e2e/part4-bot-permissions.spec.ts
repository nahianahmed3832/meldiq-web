import { expect, test } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";

test.describe.configure({ timeout: 180_000 });
// This suite intercepts a failed read; service workers can hide requests from Playwright routing.
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("bot requested access, explicit approval, stale review and retry use the real API", async ({ page }) => {
  const owner = await newPhone("scopeowner", "Permission Owner");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Scope Review Lab" });
  const made = await owner.req("POST", "/v2/developer/bots", { name: "Review Helper" });
  await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId: made.bot.id });
  const channelId = (await owner.req("GET", `/v1/orgs/${org.id}/channels`)).channels[0].id;
  const bot = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(process.env.ORBIT_E2E_API + path, {
      method,
      headers: { authorization: `Bot ${made.token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  await link(page, owner);
  await page.goto("/settings/developer");
  const row = page.locator(".dev-item").filter({ hasText: "Review Helper" }).first();
  await row
    .locator("summary")
    .filter({ hasText: /^Permissions$/ })
    .click();
  const requested = row.getByRole("form", { name: "Requested access" });
  await requested.getByRole("checkbox", { name: /^Read earlier messages/ }).check();
  await requested.getByRole("checkbox", { name: "Events", exact: true }).focus();
  await requested.getByRole("checkbox", { name: "Events", exact: true }).press("Space");
  await expect(requested.getByRole("checkbox", { name: "Events", exact: true })).toBeChecked();
  await requested.getByRole("button", { name: "Save", exact: true }).click();
  await expect(requested.getByText("Saved.", { exact: true })).toBeVisible();
  expect((await owner.req("GET", `/v2/bots/${made.bot.id}/permissions`)).permissions).toEqual(expect.arrayContaining(["events.read", "messages.history"]));
  expect((await bot("GET", `/v2/bot/conversations/${channelId}/messages`)).status).toBe(403);

  await page.goto("/workspace/bots");
  const installed = page.locator(".dev-item").filter({ hasText: "Review Helper" }).first();
  await installed
    .locator("summary")
    .filter({ hasText: /^Permissions$/ })
    .click();
  const approval = installed.getByRole("form", { name: "Approved access" });
  await expect(approval.getByRole("checkbox", { name: /^Read earlier messages/ })).not.toBeChecked();
  await approval.getByRole("checkbox", { name: /^Read earlier messages/ }).check();
  await approval.getByRole("checkbox", { name: "Events", exact: true }).check();
  await approval.getByRole("button", { name: "Save", exact: true }).click();
  await expect(approval.getByText("Saved.", { exact: true })).toBeVisible();
  expect((await bot("GET", `/v2/bot/conversations/${channelId}/messages`)).status).toBe(200);
  expect((await bot("POST", `/v2/bot/orgs/${org.id}/channels`, { name: "no-automatic-management" })).status).toBe(403);

  await owner.req("PUT", `/v2/developer/bots/${made.bot.id}/permissions`, { permissions: ["messages.history", "events.read", "channels.manage"], rev: 1 });
  await approval.getByRole("checkbox", { name: /^Read earlier messages/ }).uncheck();
  await approval.getByRole("button", { name: "Save", exact: true }).click();
  await expect(approval.getByRole("alert")).toContainText(/changed.*requested permissions|requested permissions.*changed/i);
  await expect(approval.getByRole("checkbox", { name: /^Read earlier messages/ })).not.toBeChecked();
  await approval.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(approval.getByRole("checkbox", { name: /^Manage channels/ })).not.toBeChecked();
  expect(await approval.evaluate((form) => form.scrollWidth <= form.clientWidth + 1)).toBe(true);
  await expect(approval.getByRole("checkbox", { name: /^Read earlier messages/ })).toBeChecked();

  const reviewPath = `**/v1/orgs/${org.id}/bots/${made.bot.id}/permission-review`;
  await page.route(reviewPath, (route) => route.abort());
  await approval.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(approval.getByRole("alert")).toBeVisible();
  await expect(approval.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await page.unroute(reviewPath);
  await approval.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(approval.getByRole("alert")).toHaveCount(0);
  await expect(approval.getByRole("checkbox", { name: /^Manage channels/ })).not.toBeChecked();
  if (process.env.ORBIT_E2E_SHOTS) await page.screenshot({ path: `${process.env.ORBIT_E2E_SHOTS}/bot-permission-review-${test.info().project.name}.png`, fullPage: true });
});
