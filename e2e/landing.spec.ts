import { expect, test } from "@playwright/test";
import { testAddress } from "./phone";

/**
 * The landing page (owner's brief, 2026-10-30): what a visitor sees before signing in. The headline, Explore and Join,
 * what Meldiq has, and the plans as the server's public catalog states them; no sideways scrolling at any width.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a visitor sees the headline, explores the features and the server's plans, and joins", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Your communities, all in one place/ })).toBeVisible({ timeout: 20_000 });
  // The sign-in card is on the page, not behind a click.
  await expect(page.getByRole("heading", { name: "Sign in to Meldiq" })).toBeVisible();

  await page.getByRole("link", { name: "Explore" }).click();
  await expect(page).toHaveURL(/#explore$/);
  const explore = page.getByRole("region", { name: "What's inside" });
  for (const feature of ["Chat", "Voice & video", "Screen sharing", "Communities", "Custom emoji", "Bots & apps"]) {
    await expect(explore.getByText(feature, { exact: true })).toBeVisible();
  }
  // The plans come from GET /v2/mojo/catalog: the numbers the server enforces.
  await expect(explore.getByText("8,000 characters per message")).toBeVisible();
  await expect(explore.getByText("Files up to 500 MB")).toBeVisible();
  await expect(explore.getByText("Screen share up to 2K (1440p) 60 fps")).toBeVisible();
  await expect(explore.getByText("$4.99")).toBeVisible();

  // Join opens creating an account (registration is open here) with the cursor in the form.
  await page.getByRole("button", { name: "Join Meldiq" }).click();
  await expect(page.getByRole("heading", { name: "Create your Meldiq account" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();

  // Nothing wider than the screen, phone to desktop.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the art is sized for the screen, not one image stretched", async ({ page }) => {
  await page.goto("/");
  const art = page.locator(".landing-art img");
  await expect(art).toBeVisible({ timeout: 20_000 });
  expect(await art.getAttribute("srcset")).toContain("gaming-280.webp 280w");
  const width = await art.evaluate((img) => img.getBoundingClientRect().width);
  const viewport = page.viewportSize()!.width;
  expect(width).toBe(viewport < 600 ? 140 : viewport < 1024 ? 220 : width);
  expect(width).toBeLessThanOrEqual(340);
});
