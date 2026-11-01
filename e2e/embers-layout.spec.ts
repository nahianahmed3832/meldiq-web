import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("compact account dock, contrasted settings and the Embers collection", async ({ page, isMobile }, info) => {
  const phone = await newPhone("emberlook", "Ember Explorer");
  await link(page, phone);
  if (!isMobile) {
    const dock = page.locator(".app > .user-panel");
    await expect(dock).toBeVisible();
    const box = await dock.boundingBox();
    const rail = await page.locator(".rail").boundingBox();
    expect(box!.height).toBeLessThanOrEqual(64);
    expect(Math.abs(box!.x - rail!.x)).toBeLessThanOrEqual(2);
    expect(box!.width).toBeGreaterThan(rail!.width + 250);
  }
  await page.goto("/settings/profile");
  if (!isMobile) {
    const nav = page.getByRole("navigation", { name: "Settings pages" });
    await expect(nav.getByRole("button", { name: "Storage", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "About", exact: true })).toHaveCount(0);
    const dialog = await page.locator(".settings-window").boundingBox();
    expect(dialog!.width / page.viewportSize()!.width).toBeCloseTo(0.84, 1);
    const colors = await page.evaluate(() => [".settings-nav", ".settings-page", ".app"].map((selector) => getComputedStyle(document.querySelector(selector)!).backgroundColor));
    expect(new Set(colors).size).toBe(3);
  }
  await page.goto("/settings/points");
  await expect(page.getByRole("heading", { name: "Embers", exact: true })).toBeVisible();
  await expect(page.locator(".quests .quest")).toHaveCount(19);
  await page.getByRole("tab", { name: /Achievements/ }).click();
  await expect(page.locator(".achievement-medal")).toHaveCount(26);
  const medal = page.getByRole("button", { name: /^First Ember,/ });
  await medal.click();
  await expect(page.locator(".achievement-details")).toContainText("First Ember");
  await expect(page.locator(".achievement-details")).toContainText("Progress counts automatically");
  expect(await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: `/tmp/meldiq-embers-${info.project.name}.png` });
  await page.goto("/settings/storage");
  await expect(page.getByRole("heading", { name: "My Profile", exact: true })).toBeVisible();
});
