import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
test("thread close, moderator lock, synced unfollow, failed request retry and confirmed deletion", async ({ page, browser, baseURL }) => {
  const owner = await newPhone("thbowner", "Thread Manager"),
    author = await newPhone("thbauthor", "Thread Author");
  const org = (await owner.req("POST", "/v1/orgs", { name: "Thread browser" })).org.id;
  const code = (await owner.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await author.req("POST", "/v1/invites/accept", { code });
  const cid = (await owner.req("POST", `/v1/orgs/${org}/channels`, { name: "thread-room", scope: "ORG" })).channel.id;
  const root = `m_browser_thread_${Date.now()}`;
  await author.send(cid, { type: "text", text: "Thread parent stays" }, "message", root);
  await owner.send(cid, { type: "text", text: "Reply removed", threadRoot: root });
  await link(page, author);
  await page.goto(`/home/c/${cid}/thread/${root}`);
  const panel = page.getByRole("complementary", { name: "Thread", exact: true });
  await expect(panel.getByRole("button", { name: "Following", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Following", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Follow", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(panel.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  expect((await author.req("GET", "/v1/me/thread-preferences")).preferences).toContainEqual({ rootId: root, conversationId: cid, following: false });
  await page.route(
    `**/v1/threads/${root}`,
    (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "unavailable", message: "Fixture thread outage" } }) })
        : route.continue(),
    { times: 1 },
  );
  await panel.getByRole("button", { name: "Close thread", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Close thread", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Close thread", exact: true }).click();
  await expect(panel).toContainText("This thread is closed.");
  await expect(panel.locator(".composer")).toHaveCount(0);
  const context = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    serviceWorkers: "block",
    storageState: { cookies: [], origins: [{ origin: baseURL!, localStorage: [{ name: "meldiq.introSeen", value: "1" }] }] },
  });
  try {
    await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
    const manager = await context.newPage();
    await link(manager, owner);
    await manager.goto(`/home/c/${cid}/thread/${root}`);
    const mod = manager.getByRole("complementary", { name: "Thread", exact: true });
    await mod.getByRole("button", { name: "Lock thread", exact: true }).click();
    await expect(panel).toContainText("This thread is locked.");
    await expect(panel.getByRole("button", { name: "Reopen thread", exact: true })).toHaveCount(0);
    await mod.getByRole("button", { name: "Unlock thread", exact: true }).click();
    await panel.getByRole("button", { name: "Reopen thread", exact: true }).click();
    await expect(panel.locator(".composer")).toBeVisible();
    await panel.getByRole("button", { name: "Delete thread", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Confirm", exact: true });
    await expect(confirm).toContainText("The parent message will remain.");
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await author.req("GET", `/v1/threads/${root}`)).deleted).toBe(false);
    await panel.getByRole("button", { name: "Delete thread", exact: true }).click();
    await confirm.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(panel).toContainText("This thread was deleted.");
    await expect(panel.locator(".composer")).toHaveCount(0);
    await page.goto(`/home/c/${cid}`);
    await expect(page.locator(`#msg-${root}`)).toContainText("Thread parent stays");
  } finally {
    await context.close();
  }
});
