import { finishWelcome } from "./welcome";
import crypto from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";
import { expectSignedOut } from "./link";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
const PASSWORD = "a long enough password";
async function createAccount(page: Page, name: string) {
  const email = `multi.${crypto.randomBytes(5).toString("hex")}@example.test`;
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("I am 13 or older. I agree to the Terms and acknowledge the Privacy.", { exact: true }).check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  return email;
}
async function openAccounts(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.goto("/settings/you");
    await page.getByRole("button", { name: "Switch account", exact: true }).click();
  } else await page.getByRole("button", { name: "Account options", exact: true }).click();
}
async function choose(page: Page, name: string, isMobile: boolean) {
  await openAccounts(page, isMobile);
  const target = isMobile ? page.getByRole("button", { name: new RegExp(`Switch to ${name} \\(@`) }) : page.getByRole("menuitemradio", { name: new RegExp(name) });
  await Promise.all([page.waitForEvent("domcontentloaded"), target.click()]);
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
}

test("two real account sessions survive switching, cancellation, reload and logout of only one account", async ({ page, isMobile }, info) => {
  test.setTimeout(240000);
  // A delayed read receipt is background bookkeeping, and must not trap the user in this account.
  await page.route("**/v2/messages", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.cls === "control" && body?.payload?.type === "read") return route.fulfill({ status: 503, json: { error: "busy", message: "Read receipt delayed" } });
    await route.continue();
  });
  const auth = new Map<string, { token: string; userId: string }>();
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname !== "/v1/users/me" || !response.ok()) return;
    const token = (await response.request().allHeaders()).authorization;
    const body = await response.json().catch(() => null);
    if (body?.user && token) auth.set(body.user.displayName, { token, userId: body.user.id });
  });
  const revoked: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "DELETE" && /\/v1\/devices\//.test(new URL(request.url()).pathname)) revoked.push(request.url());
  });
  await page.goto("/");
  await createAccount(page, "Alice Saved");
  await expect.poll(() => auth.has("Alice Saved")).toBe(true);
  const alice = auth.get("Alice Saved")!;
  await openAccounts(page, isMobile);
  await page.getByRole(isMobile ? "button" : "menuitem", { name: "Add account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel adding account" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel adding account" }).click();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  expect(revoked).toHaveLength(0);
  await openAccounts(page, isMobile);
  await page.getByRole(isMobile ? "button" : "menuitem", { name: "Add account", exact: true }).click();
  await createAccount(page, "Bob Saved");
  await expect.poll(() => auth.has("Bob Saved")).toBe(true);
  const bob = auth.get("Bob Saved")!;
  const peer = await newPhone("multipeer", "Shared Friend");
  const aliceDm = (await peer.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  const bobDm = (await peer.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await peer.send(aliceDm, { type: "text", text: "Private message only for Alice" });
  await peer.send(bobDm, { type: "text", text: "Private message only for Bob" });
  await page.goto(`/dms/c/${bobDm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Bob");
  await page.getByRole("button", { name: "Insert emoji", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search emoji and expressions" }).fill("red heart");
  await page.getByRole("menuitem", { name: "red heart", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Message/ })).toHaveValue("❤️");
  await choose(page, "Alice Saved", isMobile);
  await page.goto(`/dms/c/${aliceDm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Alice");
  await expect(page.getByRole("log", { name: "Messages" })).not.toContainText("Private message only for Bob");
  await page.getByRole("button", { name: "Insert emoji", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search emoji and expressions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recently used", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Alice");
  const stillSignedIn = await fetch(`${process.env.ORBIT_E2E_API}/v2/account/sessions`, { headers: { authorization: bob.token, "x-orbit-test-ip": testAddress() } });
  expect(stillSignedIn.ok).toBe(true);
  expect(revoked).toHaveLength(0);
  await page.goto("/settings/you");
  await page.getByRole("button", { name: "Switch account", exact: true }).click();
  await page.screenshot({ animations: "disabled", path: `/tmp/meldiq-real-accounts-${info.project.name}.png` });
  await page.getByRole("dialog", { name: "Switch account", exact: true }).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("dialog", { name: "Log out of Meldiq?" }).getByRole("button", { name: "Log out", exact: true }).click()]);
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  await page.goto(`/dms/c/${bobDm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Bob");
  expect(revoked).toHaveLength(1);
  await page.reload();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Bob");
  await page.getByRole("button", { name: "Insert emoji", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recently used", exact: true })).toBeVisible();
  await expect(page.locator('[data-section="recent"]').getByRole("menuitem", { name: "❤️", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await openAccounts(page, isMobile);
  await expect(page.getByRole(isMobile ? "button" : "menuitemradio", { name: /Alice Saved/ })).toHaveCount(0);
});

test("tabs renew one session together and keep their own account through switching and logout", async ({ page, context, isMobile }) => {
  test.setTimeout(240000);
  await page.goto("/");
  await createAccount(page, "Alice Tabs");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator(".app[data-connection=online]").first()).toBeVisible();
  const identity = (tab: Page) => tab.evaluate(() => (window as unknown as { __orbit: { device: { userId: string } } }).__orbit.device.userId);
  const aliceId = await identity(page);
  expect(await identity(second)).toBe(aliceId);
  let rotations = 0;
  context.on("request", (request) => {
    if (new URL(request.url()).pathname === "/v2/auth/refresh") rotations++;
  });
  const renew = (tab: Page) => tab.evaluate(() => (window as unknown as { __orbit: { session: { reauthenticate(): Promise<boolean> } } }).__orbit.session.reauthenticate());
  expect(await Promise.all([renew(page), renew(second)])).toEqual([true, true]);
  expect(rotations).toBe(1);
  for (const tab of [page, second]) await expect(tab.locator(".app[data-connection=online]").first()).toBeVisible();

  const peer = await newPhone("tabpeer", "Tab Friend");
  const aliceDm = (await peer.req("POST", "/v1/conversations/dm", { userId: aliceId })).conversation.id;
  await peer.send(aliceDm, { type: "text", text: "Only Alice should see this" });
  await second.goto(`/dms/c/${aliceDm}`);
  await expect(second.getByRole("log", { name: "Messages" })).toContainText("Only Alice should see this");
  await openAccounts(page, isMobile);
  await page.getByRole(isMobile ? "button" : "menuitem", { name: "Add account", exact: true }).click();
  await createAccount(page, "Bob Tabs");
  const bobId = await identity(page);
  expect(bobId).not.toBe(aliceId);
  await second.reload();
  await expect(second.locator(".app[data-connection=online]").first()).toBeVisible();
  expect(await identity(second)).toBe(aliceId);
  await expect(second.getByRole("log", { name: "Messages" })).toContainText("Only Alice should see this");
  const bobDm = (await peer.req("POST", "/v1/conversations/dm", { userId: bobId })).conversation.id;
  await peer.send(bobDm, { type: "text", text: "Only Bob should see this" });
  await page.goto(`/dms/c/${bobDm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Only Bob should see this");
  await expect(second.getByRole("log", { name: "Messages" })).not.toContainText("Only Bob should see this");
  await page.goto("/settings/you");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("dialog", { name: "Log out of Meldiq?" }).getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  expect(await identity(page)).toBe(aliceId);
  await second.reload();
  await expect(second.getByRole("log", { name: "Messages" })).toContainText("Only Alice should see this");
  expect(await identity(second)).toBe(aliceId);
});
