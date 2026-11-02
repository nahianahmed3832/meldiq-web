import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Community parity E (docs/MELDIQ_COMMUNITY_PARITY.md §1): Discover's tags, Profile's Discovery and template cards, a
 * template link's preview and creating a community from it, Promote (with billing off: "Coming soon"), Bots › Community
 * bots and Developer › List in the directory. Needs a server with discovery-listing, template-links, bot-directory and
 * discovery-promote.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
test.describe.configure({ timeout: 240_000 });
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("Discover, Profile's Discovery and template, template links, Promote and the bot directory", async ({ page }) => {
  const alice = await newPhone("cpealice", "Alice Rahman");
  const features: string[] = (await alice.req("GET", "/v1/server-info")).features ?? [];
  test.skip(!["discovery-listing", "template-links", "bot-directory", "discovery-promote"].every((f) => features.includes(f)), "server without batch E");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Pixel Makers" });
  await alice.req("PATCH", `/v1/orgs/${org.id}`, { visibility: "public", joinPolicy: "open" });
  await alice.req("PUT", `/v1/orgs/${org.id}/discovery`, { description: "Pixel art, game jams and cosy critiques", tags: ["pixel art", "gamedev"] });
  for (const n of [1, 2, 3, 4]) {
    const p = await newPhone(`cpem${n}`, `Member ${n}`);
    await p.req("POST", `/v1/communities/${org.id}/join`);
  }
  // A listed community bot, made by someone else.
  const bob = await newPhone("cpebob", "Bob Karim");
  const made = await bob.req("POST", "/v2/developer/bots", { name: "Dicey" });
  await bob.req("PATCH", `/v2/developer/bots/${made.bot.id}`, { public: true });
  await bob.req("PUT", `/v2/developer/bots/${made.bot.id}/listing`, { listed: true, category: "games", description: "Rolls dice and flips coins." });

  await link(page, alice);

  // Discover: the card with its tags; a tag filters the list.
  await page.goto("/discover");
  const card = page.locator(".discover-card").filter({ hasText: "Pixel Makers" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Pixel art, game jams and cosy critiques")).toBeVisible();
  await shot(page, "discover");
  await card.getByRole("button", { name: "Show communities tagged gamedev" }).click();
  await expect(page.getByText("Tagged “gamedev”")).toBeVisible();
  await shot(page, "discover-tag");

  // Profile: Discovery (listed now) and Create template link.
  await page.goto("/workspace/overview");
  const discovery = page.getByRole("region", { name: "Discovery" });
  await expect(discovery.getByText("Listed in Discover now.")).toBeVisible();
  await expect(discovery.getByLabel("Tags")).toHaveValue("pixel art, gamedev");
  const tpl = page.getByRole("region", { name: "Community template" });
  await tpl.getByRole("button", { name: "Create template link" }).click();
  const link_ = tpl.locator(".template-link");
  await expect(link_).toContainText("/template/");
  await discovery.scrollIntoViewIfNeeded();
  await shot(page, "profile-discovery-template");
  const templateUrl = (await link_.textContent())!.trim();

  // Promote: rank, boosts, the Promoted row; buying says payments are being set up.
  await page.goto("/workspace/promote");
  await expect(page.getByRole("region", { name: "Discovery rank" })).toBeVisible();
  await expect(page.getByText("Most popular")).toBeVisible();
  await page.getByRole("button", { name: "Mega Boost for a week" }).click();
  await expect(page.getByText("Coming soon")).toBeVisible();
  await shot(page, "promote");
  await page.getByRole("region", { name: "Promoted row" }).scrollIntoViewIfNeeded();
  await shot(page, "promote-row");

  // Bots › Community bots: Dicey is listed under Games and can be added.
  await page.goto("/workspace/bots");
  const dir = page.getByRole("region", { name: "Community bots" });
  await dir.getByRole("radio", { name: "Games" }).click();
  const row = dir.locator(".bot-dir-row").filter({ hasText: "Dicey" });
  await expect(row).toBeVisible();
  await shot(page, "community-bots");
  await row.getByRole("button", { name: "Add" }).click();
  await expect(row.getByRole("button", { name: "Added" })).toBeVisible();

  // The template link: its preview, then a new community from it.
  await page.goto(new URL(templateUrl).pathname);
  const dialog = page.getByRole("dialog", { name: "Create a community from this template" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("From Pixel Makers")).toBeVisible();
  await shot(page, "template-preview");
  await dialog.getByLabel("Community name").fill("Pixel Makers Two");
  await dialog.getByRole("button", { name: "Create community" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Home, communities, create and discover" }).getByRole("button", { name: /^Pixel Makers Two/ })).toBeVisible();
});
