import crypto from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { expectSignedOut } from "./link";
import { emailedCode } from "./mail";
import { testAddress } from "./phone";

/**
 * 2026-10-28 round, stage 1: Settings › My Account (two-step sign-in, changing the email, bug reports), the Shortcuts
 * page and colour themes, in a real browser against the test server.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const PASSWORD = "a long enough password";

/** RFC 6238 (SHA-1, 6 digits, 30 s) from the base32 key the page shows, [offset] steps from now. */
function totp(base32: string, offset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of base32.replace(/\s/g, "")) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const mac = crypto.createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const o = mac[mac.length - 1] & 15;
  return ((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function newAccount(page: Page, name: string): Promise<string> {
  const email = `s1.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Code").fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "Set up encryption" }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq" }).click();
  await expect(page.locator(":is(.app[data-connection=online])").first()).toBeVisible({ timeout: 15_000 });
  return email;
}

test("two-step sign-in: turn it on with an authenticator code, then a new browser's sign-in asks for one", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const email = await newAccount(page, "Tess Two");
  await page.goto("/settings/account");
  const card = page.locator(".setting-card").filter({ hasText: "Two-step sign-in" });
  await card.getByRole("button", { name: "Turn on" }).click();
  await expect(card.getByRole("note")).toContainText("Android app can't ask for these codes yet");
  await card.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const key = (await page.locator(".two-step-key").innerText()).trim();
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  await page.getByLabel("Then enter the 6-digit code it shows").fill(totp(key));
  await page.getByRole("button", { name: "Turn on", exact: true }).click();
  await expect(page.getByRole("list", { name: "Backup codes" }).getByRole("listitem")).toHaveCount(10);
  await page.getByRole("button", { name: "I've saved them" }).click();
  await expect(page.getByText("Two-step sign-in · On")).toBeVisible();

  const other = await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const second = await other.newPage();
  await second.goto("/");
  await expectSignedOut(second);
  await second.getByLabel("Email").fill(email);
  await second.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await second.getByRole("button", { name: "Sign in", exact: true }).click();
  const code = second.getByLabel("Code from your authenticator app");
  await expect(code).toBeVisible();
  await code.fill("000000");
  await second.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(second.getByRole("alert")).toContainText("isn't right");
  await code.fill(totp(key, 1));
  await second.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(second.getByRole("heading", { name: "Set up this browser" })).toBeVisible();
  await other.close();
});

test("change the email with a code, report a bug, and see standing", async ({ page }) => {
  test.setTimeout(120_000);
  await newAccount(page, "Ema Change");
  await page.goto("/settings/account");
  await expect(page.getByText("Your account is all good")).toBeVisible();

  const next = `s1.new.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await page.getByRole("button", { name: "Edit email" }).click();
  const dialog = page.getByRole("dialog", { name: "Change your email" });
  await dialog.getByLabel("New email").fill(next);
  await dialog.getByLabel("Current password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Send code" }).click();
  await dialog.getByLabel("Code").fill(await emailedCode(next, "verify"));
  await dialog.getByRole("button", { name: "Change email" }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator(".account-card").getByRole("button", { name: "Reveal" }).click();
  await expect(page.locator(".account-card")).toContainText(next);

  await page.getByRole("button", { name: "Report a bug" }).click();
  const bug = page.getByRole("dialog", { name: "Report a bug" });
  await bug.getByLabel("What's wrong, in a few words").fill("Menu stays open");
  await bug.getByLabel("What happened, and how to make it happen again").fill("Right-click a channel, press Escape: it stays.");
  await bug.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByRole("list", { name: "Your bug reports" })).toContainText("Menu stays open");
  await expect(page.getByRole("list", { name: "Your bug reports" })).toContainText("Open");
});

test("shortcuts can be changed, and colour themes tint the app", async ({ page }) => {
  await newAccount(page, "Kim Keys");
  await page.goto("/settings/shortcuts");
  await expect(page.getByRole("heading", { name: "Shortcuts", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /^Quick switcher/ }).click();
  await page.keyboard.press("ControlOrMeta+KeyP");
  await expect(page.getByRole("button", { name: /^Quick switcher/ })).toContainText("P");
  await page.getByRole("button", { name: "Back to conversations" }).click();
  await page.keyboard.press("ControlOrMeta+KeyP");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+Slash");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/settings/appearance");
  await page.getByRole("radio", { name: "Lagoon" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-vibe", "on");
  await page.getByRole("radio", { name: "None" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-vibe", "on");
});
