import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * Community parity, batch A (docs/MELDIQ_COMMUNITY_PARITY.md): the community menu in the reference's order with Lock,
 * and Community settings as the floating window with the reference's rail; old page links still open it.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test("community menu order, Lock popover, and the settings window's rail", async ({ page }) => {
  const alice = await newPhone("cpalice", "Alice Rahman");
  await alice.req("POST", "/v1/orgs", { name: "Parity Lab" });
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");

  const icon = page.getByRole("button", { name: /^Parity Lab/ }).first();
  await icon.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Parity Lab" });
  await expect(menu).toBeVisible();
  const labels = (await menu.getByRole("menuitem").allInnerTexts()).map((t) => t.split("\n")[0].trim());
  const order = ["Invite people", "Community settings", "Create channel", "Create category", "Lock community", "Mute community", "Notification settings", "Delete community"];
  const seen = labels.filter((l) => order.includes(l));
  expect(seen).toEqual(order.filter((o) => labels.includes(o)));
  expect(labels.at(-1)).toBe("Delete community");
  await shot(page, "menu");

  await menu.getByRole("menuitem", { name: "Lock community" }).hover();
  const lock = page.getByRole("menu", { name: "Lock community" });
  await expect(lock).toBeVisible();
  for (const item of ["15 minutes", "1 hour", "8 hours", "1 day", "Cancel"]) await expect(lock.getByRole("menuitem", { name: item })).toBeVisible();
  await shot(page, "lock");
  await lock.getByRole("menuitem", { name: "Cancel" }).click();

  await icon.click({ button: "right" });
  await page.getByRole("menu", { name: "Parity Lab" }).getByRole("menuitem", { name: "Community settings" }).click();
  const window = page.getByRole("dialog", { name: "Parity Lab settings" });
  await expect(window).toBeVisible();
  await expect(window.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  const rail = window.getByRole("navigation", { name: "Community settings" });
  await expect(rail.getByRole("group", { name: "Parity Lab" })).toBeVisible();
  await expect(rail.getByRole("group", { name: "People" }).getByRole("button", { name: "Members" })).toBeVisible();
  await expect(rail.getByRole("group", { name: "Moderation" }).getByRole("button", { name: "Audit log" })).toBeVisible();
  await shot(page, "window-profile");

  await rail.getByRole("button", { name: "Roles" }).click();
  await expect(window.getByRole("heading", { level: 1, name: "Roles" })).toBeVisible();
  await shot(page, "window-roles");
  await page.keyboard.press("Escape");
  await expect(window).toHaveCount(0);

  // An old Security actions link opens the window on Profile, at its safety section.
  await page.goto("/workspace/security");
  await expect(page.getByRole("dialog", { name: "Parity Lab settings" }).getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
  await shot(page, "window-security-link");

  // Phones: full screen, the rail a row of pages.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/roles");
  await expect(page.getByRole("heading", { level: 1, name: "Roles" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Community settings" }).getByRole("button", { name: "Members" })).toBeVisible();
  await shot(page, "phone-roles");
});
