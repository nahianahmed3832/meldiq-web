import { expect, test } from "@playwright/test";
import { testAddress } from "./phone";

/**
 * The landing page (owner's brief, 2026-10-30): what a visitor sees before signing in. The headline, Explore and Join,
 * what Meldiq has, and the plans as the server's public catalog states them; no sideways scrolling at any width.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("the homepage is the logo, a picture of the app and signing in, nothing else", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".landing-brand img.brand-mark")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".landing-preview")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to Meldiq" })).toBeVisible();
  // The headline is for screen readers and search engines; no plans, prices or feature lists (owner, 2026-10-30).
  await expect(page.getByRole("heading", { level: 1, name: /Your communities, all in one place/ })).toBeAttached();
  await expect(page.getByText(/\/month|Mojo Plus|What's inside/)).toHaveCount(0);

  // Creating an account is in the sign-in card.
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your Meldiq account" })).toBeVisible();

  // Nothing wider than the screen, phone to desktop.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the page is the app's own design, and installs as an iPhone app", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator(".landing-preview")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".landing-brand img.brand-mark")).toBeVisible();
  // Home Screen: standalone, the iOS tags, and an opaque square icon.
  const head = page.locator("head");
  await expect(head.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(head.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "black-translucent");
  await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Meldiq", short_name: "Meldiq", start_url: "/", scope: "/", display: "standalone" });
  for (const icon of [...manifest.icons.map((i: { src: string }) => i.src), "/apple-touch-icon.png"]) {
    const r = await request.get(icon);
    expect(r.status(), icon).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
});
