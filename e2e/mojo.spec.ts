import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Meldiq Mojo (server docs/MOJO.md) against a server with no payment provider, as production runs until Mojo goes on
 * sale: the plans, their comparison and why subscriptions exist show, nothing can be bought, no limit is enforced, and a
 * community's Sparks open from its menu.
 */
test.skip(({ browserName }) => browserName !== "chromium", "Chromium");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("Settings › Meldiq Mojo shows the plans and their limits, and says it isn't on sale yet", async ({ page }) => {
  const alice = await newPhone("mojoalice", "Alice Rahman");
  await alice.connect();
  await link(page, alice);
  await page.goto("/settings/mojo");
  await expect(page.getByRole("heading", { name: "Meldiq Mojo", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Mojo isn't on sale yet")).toBeVisible();
  for (const plan of ["Free", "Mojo Go", "Mojo Plus"]) await expect(page.getByRole("region", { name: plan, exact: true })).toBeVisible();
  // Nothing can be bought: no dead button pretends to.
  await expect(page.getByRole("button", { name: /^Get Mojo/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Not on sale yet" }).first()).toBeDisabled();

  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Characters in a message 1,000 2,000 5,000/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Largest file you share 50 MB 200 MB 2 GB/ })).toBeVisible();
  // Bots aren't a benefit Meldiq can give yet: not listed.
  await expect(table.getByText(/bot/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Why subscriptions?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meldiq Spark", exact: true })).toBeVisible();
});

test("a community's menu opens its Sparks: its level and what a Spark would do", async ({ page }) => {
  const alice = await newPhone("mojospark", "Alice Rahman");
  await alice.req("POST", "/v1/orgs", { name: "Spark Lab" });
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");
  await page
    .getByRole("button", { name: /^Spark Lab/ })
    .first()
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: "Spark Lab" })
    .getByRole("menuitem", { name: /^Meldiq Sparks/ })
    .click();
  const dialog = page.getByRole("dialog", { name: "Sparks for Spark Lab" });
  await expect(dialog.getByText("No Spark level yet")).toBeVisible();
  await expect(dialog.getByText("2 more for Level 1", { exact: false })).toBeVisible();
  await expect(dialog.getByText("50 emoji slots")).toBeVisible();
  // No Sparks to give: it points to where they come from.
  await expect(dialog.getByRole("button", { name: /Get Sparks/ })).toBeVisible();
});
