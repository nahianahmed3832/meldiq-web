import crypto from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { expectSignedOut } from "./link";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";

/**
 * Orbit 2.0 accounts in a real browser against the real server: sign up with an emailed code, set up encryption (the
 * recovery key shown once), reload into the stored session, then a second browser signs in and sets itself up with the
 * recovery key; both receive a message from someone's phone.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const PASSWORD = "a long enough password";

/** What the phone's Settings › Sessions does: another sign-in lists the account's sessions and removes the newest one without a device (a browser still being set up). */
async function removeSetupSessionElsewhere(email: string): Promise<void> {
  const api = process.env.ORBIT_E2E_API!;
  const headers = { "content-type": "application/json", "x-orbit-test-ip": testAddress() };
  const login = await fetch(`${api}/v2/auth/login`, { method: "POST", headers, body: JSON.stringify({ email, password: PASSWORD, deviceName: "Phone" }) });
  const { accessToken } = (await login.json()) as { accessToken: string };
  // No content-type on the body-less requests: the server refuses an empty JSON body.
  const auth = { "x-orbit-test-ip": headers["x-orbit-test-ip"], authorization: `Bearer ${accessToken}` };
  const list = (await (await fetch(`${api}/v2/account/sessions`, { headers: auth })).json()) as { sessions: { id: string; deviceId: string | null; current: boolean; createdAt: number }[] };
  const target = list.sessions.filter((s) => !s.current && s.deviceId === null).sort((a, b) => b.createdAt - a.createdAt)[0];
  expect(target, "the browser's setup session is listed").toBeTruthy();
  const r = await fetch(`${api}/v2/account/sessions/${encodeURIComponent(target!.id)}`, { method: "DELETE", headers: auth });
  expect(r.ok).toBe(true);
}

async function signIn(page: Page, email: string): Promise<void> {
  await expectSignedOut(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  // The form reads what React holds: make sure the typing landed before sending.
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("sign up, set up encryption, come back after a reload, and add a second browser with the recovery key", async ({ page, browser }) => {
  const email = `e2e.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Nadia Rahman");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code").fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("heading", { name: "Set up end-to-end encryption" })).toBeVisible();
  await page.getByRole("button", { name: "Set up encryption" }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery key" })).toBeVisible();
  const recovery = ((await page.getByLabel("Recovery key", { exact: true }).innerText()) ?? "").replace(/\s+/g, "-");
  expect(recovery).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{1,4})+$/);
  await expect(page.getByRole("button", { name: "Open Meldiq" })).toBeDisabled();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq" }).click();
  await expect(page.locator(":is(.conn.online, .user-panel[data-connection=online]):visible").first()).toBeVisible({ timeout: 15_000 });

  // Settings › My Account (2026-10-28, the reference's page): your card with name, username and the email hidden until
  // Reveal; then password and authentication, and the account itself.
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { name: "My Account", level: 1 })).toBeVisible();
  const info = page.locator(".account-card");
  await expect(info).toContainText("Nadia Rahman");
  await expect(info).not.toContainText(email);
  await info.getByRole("button", { name: "Reveal" }).click();
  await expect(info).toContainText(email);
  await expect(page.getByRole("heading", { name: "Password and authentication" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();

  // The session survives a reload (stored sealed); no password asked.
  await page.reload();
  await expect(page.locator(":is(.conn.online, .user-panel[data-connection=online]):visible").first()).toBeVisible({ timeout: 15_000 });
  // Back to the conversations, where a new direct message shows.
  await page.getByRole("button", { name: "Back to conversations" }).click();

  // Someone writes to the new account from their phone.
  const me = await page.evaluate(() => (window as unknown as { __orbit: { device: { userId: string } } }).__orbit.device.userId);
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: me })).conversation.id as string;
  await bob.send(dm, { type: "text", text: "Welcome to Meldiq, Nadia" });
  await expect(page.getByRole("complementary", { name: "Conversations" }).getByRole("link", { name: /Bob Chen/ })).toBeVisible();

  // A second browser: sign in, set it up with the recovery key, and it reads the same conversation.
  const other = await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const second = await other.newPage();
  await second.goto("/");
  await signIn(second, email);
  await expect(second.getByRole("heading", { name: "Set up this browser" })).toBeVisible();

  // The setup session is removed on another device before it finishes (production, 2026-10-19): the recovery key can't
  // be used with it, so the screen goes back to sign-in with the email kept and says why, instead of failing every try.
  await removeSetupSessionElsewhere(email);
  await openOtherWays(second);
  await second.getByRole("tab", { name: "Use my recovery key" }).click();
  await second.getByLabel("Recovery key", { exact: true }).fill(recovery);
  await second.getByRole("button", { name: "Set up this browser" }).click();
  await expect(second.getByText(/This sign-in was ended before the browser was set up/)).toBeVisible();
  await expect(second.getByLabel("Email")).toHaveValue(email);

  // Signing in again sets it up with the same recovery key.
  await signIn(second, email);
  await expect(second.getByRole("heading", { name: "Set up this browser" })).toBeVisible();
  await openOtherWays(second);
  await second.getByRole("tab", { name: "Use my recovery key" }).click();
  await second.getByLabel("Recovery key", { exact: true }).fill(recovery.toLowerCase());
  await second.getByRole("button", { name: "Set up this browser" }).click();
  await expect(second.locator(":is(.conn.online, .user-panel[data-connection=online]):visible").first()).toBeVisible({ timeout: 15_000 });
  await bob.send(dm, { type: "text", text: "Both of your browsers get this" });
  for (const p of [page, second]) {
    await p
      .getByRole("complementary", { name: "Conversations" })
      .getByRole("link", { name: /Bob Chen/ })
      .click();
    await expect(p.getByText("Both of your browsers get this")).toBeVisible();
  }
  await other.close();

  // A third browser with the emailed code (reported 2026-10-23): the code is sent as the screen opens, so it asks only
  // for the code; no "Email me a code" step, and no server line.
  const third = await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const t = await third.newPage();
  await t.goto("/");
  await signIn(t, email);
  await expect(t.getByRole("heading", { name: "Set up this browser" })).toBeVisible();
  await expect(t.getByText(/Enter the 6-digit code we sent to/)).toBeVisible();
  await expect(t.getByRole("button", { name: "Email me a code" })).toHaveCount(0);
  await expect(t.getByText(/^Server:/)).toHaveCount(0);
  await expect(t.getByRole("button", { name: "Account recovery" })).toBeVisible();
  await t.getByRole("button", { name: "Having trouble?" }).click();
  await expect(t.getByRole("button", { name: "Send a new code" })).toBeVisible();
  await t.getByLabel("Verification code").fill(await emailedCode(email, "verify"));
  await t.getByRole("button", { name: "Unlock" }).click();
  await expect(t.locator(":is(.conn.online, .user-panel[data-connection=online]):visible").first()).toBeVisible({ timeout: 15_000 });
  await third.close();
});

test("a wrong password and a forgotten password", async ({ page }) => {
  const email = `e2e.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/");
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("don't match an account");
  await page.getByRole("button", { name: "Having trouble signing in?" }).click();
  await page.getByRole("button", { name: /I forgot my password/ }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByRole("button", { name: "Send code" }).click();
  // The same answer whether or not the address has an account.
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
});

/** "Set up this browser" offers the emailed code first when the keys are backed up; the other ways sit behind a link. */
async function openOtherWays(page: Page): Promise<void> {
  const help = page.getByRole("button", { name: "Account recovery" });
  await expect(help.or(page.getByRole("tab", { name: "Use my recovery key" }))).toBeVisible();
  if (await help.isVisible()) await help.click();
}
