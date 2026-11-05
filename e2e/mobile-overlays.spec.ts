import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("community sheets keep nested actions, keyboard focus and every permitted settings destination", async ({ page }, info) => {
  const owner = await newPhone("mobowner", "Mobile Owner");
  await owner.req("POST", "/v1/orgs", { name: "Mobile Settings Lab" });
  await owner.connect();
  await link(page, owner);
  // New communities first open their lobby. Retapping Home returns to the rail and channel list.
  await expect(page.getByRole("region", { name: "Mobile Settings Lab lobby", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Sections", exact: true }).getByRole("button", { name: "Home", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Community: Mobile Settings Lab. Community menu" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "Mobile Settings Lab", exact: true });
  await expect(menu).toBeVisible();
  // Chrome also resizes the layout window when its keyboard opens; the sheet must stay usable.
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: /^Mute/ }).click();
  const submenu = page.locator(".menu-submenu");
  await expect(submenu).toBeVisible();
  await expect.poll(() => submenu.evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
  await submenu.getByRole("button", { name: "Back to previous menu" }).click();
  await expect(submenu).toHaveCount(0);
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Close Mobile Settings Lab menu" }).focus();
  await page.keyboard.press("Tab");
  expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await menu.getByRole("menuitem", { name: "Community settings", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Sections", exact: true })).toBeHidden();
  const chooser = page.getByRole("combobox", { name: "Community settings page", exact: true });
  await expect(chooser).toBeVisible();
  await expect(chooser.locator("option[value=roles]")).toBeAttached();
  await chooser.selectOption("roles");
  await expect(page).toHaveURL(/\/workspace\/roles$/);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(chooser).toBeVisible();
  await chooser.selectOption("channels");
  await expect(page).toHaveURL(/\/workspace\/channels$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile-community-settings.png") });
  await page.getByRole("button", { name: "Back to community", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("production PWA keeps its existing install assets, cached shell, session and network recovery", async ({ page, context, request }) => {
  test.skip(process.env.ORBIT_E2E_BUILD !== "1", "offline shell needs the production worker");
  const manifestResponse = await request.get("/manifest.webmanifest");
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const alice = await newPhone("pwamobile", "PWA Mobile");
  await alice.req("POST", "/v1/orgs", { name: "PWA community" });
  await alice.connect();
  await link(page, alice);
  await expect(page.getByRole("region", { name: "PWA community lobby", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/lobby$/);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.reload();
  await expect(page.locator(".app[data-connection=online]")).toBeVisible();
  await expect.poll(() => page.evaluate(async () => !!(await (await caches.open("meldiq-shell-v1")).match("/")))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".app[data-connection]")).toBeVisible();
  await expect(page.locator(".conn-banner")).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator(".app[data-connection=online]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".conn-banner")).toBeHidden();
});
