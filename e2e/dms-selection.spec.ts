import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Direct messages belong to no community (reported 2026-10-23: in DMs the community stayed selected in the rail and its
 * header topped the list, and clicking the community kept you in DMs). As on Discord: in DMs no community is selected
 * and the list has its own heading; a community in the rail opens its channels.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium only: the rail is hidden on phones");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("in DMs no community is selected, and a community in the rail opens its channels", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  await alice.req("POST", "/v1/orgs", { name: "Rail Lab" });
  await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId });
  await alice.connect();
  await link(page, alice);

  const community = page.getByRole("button", { name: /^Rail Lab/ });
  const selected = page.locator('.rail-org[aria-current="true"]');
  const sidebar = page.getByRole("complementary", { name: "Conversations" });

  await page.goto("/home");
  await expect(selected).toHaveCount(1);
  await expect(sidebar).toContainText("Rail Lab");

  // As on Discord: no Home button beside a community, and the logo opens the direct messages.
  const rail = page.getByRole("navigation", { name: "Workspaces and sections" });
  await expect(rail.getByRole("link", { name: /^Home/ })).toHaveCount(0);
  await rail.getByRole("link", { name: "Direct messages" }).click();
  await expect(page).toHaveURL(/\/dms$/);
  await expect(selected).toHaveCount(0);
  await page.goto("/home");

  await page.getByRole("link", { name: /^DMs/ }).click();
  await expect(page).toHaveURL(/\/dms$/);
  await expect(selected).toHaveCount(0);
  await expect(sidebar.getByRole("heading", { name: "Direct messages" })).toBeVisible();
  await expect(sidebar).not.toContainText("Rail Lab");
  await expect(sidebar).toContainText("Bob Chen");

  await community.click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(selected).toHaveCount(1);
  await expect(sidebar).toContainText("Rail Lab");
  await expect(sidebar.getByRole("heading", { name: "Direct messages" })).toHaveCount(0);
});
