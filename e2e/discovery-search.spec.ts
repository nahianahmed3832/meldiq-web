import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("public communities load, search and recover from no matches with Meldiq artwork", async ({ page }) => {
  test.setTimeout(120_000);
  const owner = await newPhone("discoverowner", "Discovery Owner");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Creative Makers", visibility: "public", joinPolicy: "open" });
  await owner.req("PUT", `/v1/orgs/${org.id}/discovery`, { description: "Art and community projects", tags: ["design"] });
  for (let i = 0; i < 4; i++) {
    const member = await newPhone(`discovermember${i}`, "Community Member");
    await member.req("POST", `/v1/communities/${org.id}/join`);
  }
  await owner.req("POST", "/v1/orgs", { name: "Private Makers", visibility: "private" });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await owner.req("PUT", `/v1/orgs/${org.id}/photo`, undefined, png);
  const visitor = await newPhone("discovervisitor", "Discovery Visitor");
  await link(page, visitor);
  await page.goto("/discover");
  const card = page.locator(`.discover-card[aria-labelledby="dc-${org.id}"]`);
  await expect(card).toBeVisible();
  await expect.poll(() => card.locator(".avatar-photo").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const search = page.getByRole("searchbox", { name: "Search communities" });
  for (const query of ["Creative", "projects", "design"]) {
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/v1/discover" && new URL(response.url()).searchParams.get("q") === query && response.ok()),
      search.fill(query),
    ]);
    await expect(card).toBeVisible();
  }
  await search.fill("no-community-matches-this");
  await expect(card).toHaveCount(0);
  await expect(page.locator(".discover-empty-art img")).toHaveAttribute("src", "/meldling-192.webp");
  await expect(page.locator('img[src="/meldling/confused.webp"]')).toHaveCount(0);
  await page.getByRole("region", { name: "Discover", exact: true }).getByRole("button", { name: "All communities", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(card).toBeVisible();
  await search.fill("Private Makers");
  await expect(card).toHaveCount(0);
  await expect(page.locator(".discover-card")).toHaveCount(0);
  await expect(page.locator(".discover-empty-art")).toBeVisible();
});
