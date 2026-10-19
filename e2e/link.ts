import { expect, type Page } from "@playwright/test";
import { approve, type Phone } from "./phone";

/** Links the page's browser to [phone]'s account through the real pairing flow; checks the fingerprint matches. */
export async function link(page: Page, phone: Phone): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Link this browser to your account" })).toBeVisible();
  const code = page.locator(".code-box .code");
  await expect(code).toHaveText(/^[A-Z0-9]{5} [A-Z0-9]{5}$/);
  const shownFingerprint = await page.getByLabel("Device key").textContent();
  const phoneFingerprint = await approve(phone, (await code.textContent())!);
  expect(shownFingerprint).toBe(phoneFingerprint);
  await expect(page.locator(".conn.online")).toBeVisible({ timeout: 15_000 });
}
