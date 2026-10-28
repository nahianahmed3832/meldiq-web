import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * The owner's 2026-10-28 round: Friends as the Messages home, rail folders by dragging, Meldiq's menu on a photo (no
 * browser menu) and the media viewer above everything, the Black theme.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** A mouse drag through real pointer events, in small steps (as a hand would move). */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  await page.mouse.up();
}

test("Friends is the Messages home, with pending requests to accept", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  await alice.connect();
  await link(page, alice);
  await bob.req("POST", "/v1/connections", { userId: alice.userId });
  await page.goto("/dms");
  const friends = page.locator("section.friends");
  await expect(friends.getByRole("tab", { name: "Online" })).toHaveAttribute("aria-selected", "true");
  for (const t of ["All", "Pending", "Blocked", "Suggested", "Add Friend"]) await expect(friends.getByRole("tab", { name: new RegExp(`^${t}`) })).toBeVisible();
  await friends.getByRole("tab", { name: /^Pending/ }).click();
  await expect(friends).toContainText("Bob Chen");
  await friends.getByRole("button", { name: "Accept Bob Chen" }).click();
  await friends.getByRole("tab", { name: /^All/ }).click();
  await expect(friends).toContainText("Bob Chen");
  await friends.getByRole("tab", { name: "Add Friend" }).click();
  await expect(friends.getByRole("button", { name: "Send Friend Request" })).toBeVisible();
});

test("dragging one community onto another makes a folder that opens and keeps after a reload", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  for (const name of ["Fold One", "Fold Two", "Fold Three"]) await alice.req("POST", "/v1/orgs", { name });
  await alice.connect();
  await link(page, alice);
  await page.goto("/dms");
  const rail = page.getByRole("navigation", { name: "Home, communities, create and discover" });
  const one = (await rail.getByRole("button", { name: /^Fold One/ }).boundingBox())!;
  const two = (await rail.getByRole("button", { name: /^Fold Two/ }).boundingBox())!;
  await drag(page, { x: one.x + one.width / 2, y: one.y + one.height / 2 }, { x: two.x + two.width / 2, y: two.y + two.height / 2 });
  const folder = rail.getByRole("button", { name: /^Folder / });
  await expect(folder).toBeVisible();
  await expect(folder).toHaveAccessibleName(/2 communities/);
  await page.reload();
  await expect(folder).toBeVisible({ timeout: 20_000 });
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(rail.locator(".rail-folder-members").getByRole("button", { name: /^Fold One/ })).toBeVisible();
});

test("a photo's right-click is Meldiq's menu, and the viewer opens above everything with Download", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await page.locator(".composer input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  await page.getByRole("button", { name: "Send" }).click();
  const photo = page.locator(".msg .att-image img");
  await expect(photo).toBeVisible({ timeout: 20_000 });

  // The right-click is Meldiq's own menu (a browser menu can't be seen here, but the page cancelled it).
  const cancelled = page.evaluate(
    () => new Promise<boolean>((resolve) => document.addEventListener("contextmenu", (e) => setTimeout(() => resolve(e.defaultPrevented)), { once: true, capture: true })),
  );
  await photo.click({ button: "right" });
  expect(await cancelled).toBe(true);
  const menu = page.getByRole("menu", { name: "Message" });
  await expect(menu.getByRole("menuitem", { name: "Download photo" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy image" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Open photo" }).click();

  const viewer = page.getByRole("dialog", { name: /photo/ });
  await expect(viewer.getByRole("button", { name: "Download photo" })).toBeVisible();
  // No message menu behind it.
  await expect(page.getByRole("menu", { name: "Message" })).toHaveCount(0);
  await viewer.locator("img").click({ button: "right" });
  await expect(page.getByRole("menu").getByRole("menuitem", { name: "Download photo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("the Black theme makes the background black, and dark is the default", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  await alice.connect();
  await link(page, alice);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/settings/appearance");
  await page.getByRole("button", { name: "Black", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "black");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(0, 0, 0)");
});
