import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { emailedCode } from "./mail";
import { link, expectSignedOut } from "./link";
import { newPhone, testAddress } from "./phone";
import { serverDir } from "../test/support/serverDir";

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("authenticator sign-in unlocks the real encrypted backup without another email code", async ({ page, browser }) => {
  const email = `linear.${crypto.randomBytes(5).toString("hex")}@example.test`;
  const password = "a long enough password";
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Linear Sign In");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  await page.getByLabel("Code").fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
  // The real API enables TOTP and the browser's automatic password-encrypted backup remains untouched.
  const headers = { "content-type": "application/json", "x-orbit-test-ip": testAddress() };
  const base = process.env.ORBIT_E2E_API!;
  const grant = await (await fetch(`${base}/v2/auth/login`, { method: "POST", headers, body: JSON.stringify({ email, password }) })).json();
  const auth = { ...headers, authorization: `Bearer ${grant.accessToken}` };
  const setup = await (await fetch(`${base}/v2/account/totp/setup`, { method: "POST", headers: auth, body: JSON.stringify({ password }) })).json();
  const modulePath = path.join(serverDir(), "src/modules/accounts/totp.ts");
  const { fromBase32, stepAt, totpCode } = await import(/* @vite-ignore */ modulePath);
  const enabled = await fetch(`${base}/v2/account/totp/enable`, { method: "POST", headers: auth, body: JSON.stringify({ code: totpCode(fromBase32(setup.secret), stepAt(Date.now())) }) });
  expect(enabled.ok).toBe(true);
  const mailDir = path.join(process.env.ORBIT_E2E_DATA!, "mail");
  const unlockMails = () =>
    fs.readdirSync(mailDir).filter((file) => {
      const mail = fs.readFileSync(path.join(mailDir, file), "utf8");
      return mail.includes(`To: ${email}`) && /Subject:.*code to set up Meldiq on a new device/i.test(mail);
    }).length;
  const before = unlockMails();
  const context = await browser.newContext({ extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  try {
    await context.addInitScript(() => localStorage.setItem("meldiq.introSeen", "1"));
    const other = await context.newPage();
    await other.goto("/");
    await expectSignedOut(other);
    await other.getByRole("button", { name: "Continue with email", exact: true }).click();
    await other.getByLabel("Email").fill(email);
    await other.getByLabel("Password", { exact: true }).fill(password);
    await other.getByRole("button", { name: "Sign in", exact: true }).click();
    const field = other.locator('input[autocomplete="one-time-code"]');
    await field.fill(totpCode(fromBase32(setup.secret), stepAt(Date.now() + 30000)));
    await other.getByRole("button", { name: "Verify and sign in", exact: true }).click();
    await expect(other.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 20000 });
    expect(unlockMails()).toBe(before);
    await expect(other.getByLabel("Verification code")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("original photo upload and exact download, with distinct owner rows", async ({ page, browserName, isMobile }) => {
  const owner = await newPhone("smoothowner", "Community Owner");
  const member = await newPhone("smoothmember", "Community Member");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Smooth Community" });
  const { invite } = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" });
  await member.req("POST", "/v1/invites/accept", { code: invite.code });
  const { conversations } = await owner.req("GET", "/v1/conversations");
  const channel = conversations.find((c: { orgId: string; voice: boolean; kind: string; format: string }) => c.orgId === org.id && !c.voice && c.format !== "forum" && c.kind !== "ANNOUNCEMENT");
  await link(page, owner);
  await page.goto(`/home/c/${channel.id}`);
  await page.locator(".composer input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  await expect(page.getByText("Photo quality", { exact: false })).toBeVisible();
  await page.getByPlaceholder(/^Message #/).fill("Automatic photo");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const message = page.locator(".msg").filter({ hasText: "Automatic photo" });
  await message.getByRole("button", { name: /Open image/ }).click({ timeout: 20000 });
  const download = page.waitForEvent("download");
  await page
    .locator(".lightbox")
    .getByRole("button", { name: /Download/ })
    .first()
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("photo.jpg");
  const downloaded = await file.path();
  expect(downloaded).not.toBeNull();
  expect(crypto.createHash("sha256").update(fs.readFileSync(downloaded!)).digest("hex")).toBe(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg")))
      .digest("hex"),
  );
  await page.keyboard.press("Escape");
  if (isMobile) {
    await page.getByRole("button", { name: /^#.*: details$/ }).click();
    await page.getByRole("button", { name: "Members", exact: true }).click();
  }
  const badge = page.getByTitle("Community owner");
  await expect(badge).toBeVisible();
  const rows = page.locator(".member-list .member-row");
  if ((await rows.count()) >= 2) {
    const a = await rows.nth(0).boundingBox();
    const b = await rows.nth(1).boundingBox();
    expect(b!.y - (a!.y + a!.height)).toBeGreaterThanOrEqual(10);
  }
  if (browserName === "chromium" && !isMobile) await page.screenshot({ path: "/tmp/meldiq-smooth-member-upload.png" });
});
