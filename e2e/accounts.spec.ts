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

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
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
  const recovery = ((await page.getByLabel("Recovery key").innerText()) ?? "").replace(/\s+/g, "-");
  expect(recovery).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{1,4})+$/);
  await expect(page.getByRole("button", { name: "Open Meldiq" })).toBeDisabled();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq" }).click();
  await expect(page.locator(".conn.online")).toBeVisible({ timeout: 15_000 });

  // The session survives a reload (stored sealed); no password asked.
  await page.reload();
  await expect(page.locator(".conn.online")).toBeVisible({ timeout: 15_000 });

  // Someone writes to the new account from their phone.
  const me = await page.evaluate(() => (window as unknown as { __orbit: { device: { userId: string } } }).__orbit.device.userId);
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: me })).conversation.id as string;
  await bob.send(dm, { type: "text", text: "Welcome to Meldiq, Nadia" });
  await expect(page.getByRole("link", { name: /Bob Chen/ })).toBeVisible();

  // A second browser: sign in, set it up with the recovery key, and it reads the same conversation.
  const other = await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const second = await other.newPage();
  await second.goto("/");
  await signIn(second, email);
  await expect(second.getByRole("heading", { name: "Set up this browser" })).toBeVisible();
  await second.getByRole("tab", { name: "Use my recovery key" }).click();
  await second.getByLabel("Recovery key").fill(recovery.toLowerCase());
  await second.getByRole("button", { name: "Set up this browser" }).click();
  await expect(second.locator(".conn.online")).toBeVisible({ timeout: 15_000 });
  await bob.send(dm, { type: "text", text: "Both of your browsers get this" });
  for (const p of [page, second]) {
    await p.getByRole("link", { name: /Bob Chen/ }).click();
    await expect(p.getByText("Both of your browsers get this")).toBeVisible();
  }
  await other.close();
});

test("a wrong password and a forgotten password", async ({ page }) => {
  const email = `e2e.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/");
  await signIn(page, email);
  await expect(page.getByRole("alert")).toContainText("don't match an account");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByRole("button", { name: "Send code" }).click();
  // The same answer whether or not the address has an account.
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
});
