import { expect, type Page } from "@playwright/test";
import { approve, type Phone } from "./phone";

/** The signed-out screen: Orbit 2.0 sign-in (email and password). */
export async function expectSignedOut(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Sign in to Meldiq" })).toBeVisible();
}

/**
 * Links the page's browser to [phone]'s account through the real pairing flow (the older, phone-only way, offered from
 * the sign-in screen); checks the fingerprint matches.
 */
export async function link(page: Page, phone: Phone): Promise<void> {
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Link with your phone instead" }).click();
  await expect(page.getByRole("heading", { name: "Link this browser to your account" })).toBeVisible();
  const code = page.locator(".code-box .code");
  await expect(code).toHaveText(/^[A-Z0-9]{5} [A-Z0-9]{5}$/);
  const shownFingerprint = await page.getByLabel("Device key").textContent();
  const phoneFingerprint = await approve(phone, (await code.textContent())!);
  expect(shownFingerprint).toBe(phoneFingerprint);
  await expect(page.locator(".conn.online")).toBeVisible({ timeout: 15_000 });
}
