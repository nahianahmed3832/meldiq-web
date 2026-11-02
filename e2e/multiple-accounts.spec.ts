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
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
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
  await choose(page, "Alice Saved", isMobile);
  await page.goto(`/dms/c/${aliceDm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Alice");
  await expect(page.getByRole("log", { name: "Messages" })).not.toContainText("Private message only for Bob");
  await page.reload();
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
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private message only for Bob");
  await openAccounts(page, isMobile);
  await expect(page.getByRole(isMobile ? "button" : "menuitemradio", { name: /Alice Saved/ })).toHaveCount(0);
});
