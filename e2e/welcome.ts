import { expect, type Page } from "@playwright/test";

/** Existing feature suites finish the real new-account welcome flow before testing their own domain. */
export async function finishWelcome(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Create your profile", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "App preferences", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await expect(page.locator(".app[data-connection=online]")).toBeVisible();
}
