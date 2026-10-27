import { expect, test } from "@playwright/test";
import { expectSignedOut } from "./link";
import { testAddress } from "./phone";

/**
 * The launch screen (docs/MELDIQ_WEB_LAUNCH.md): Meldling from the first paint, gone as soon as the app shows something,
 * never in front of sign-in; its breathing only where motion is welcome.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("Meldling shows at once and makes way for sign-in", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator('#splash img[src="/launch/meldling-launch.png"]')).toBeAttached();
  await expectSignedOut(page);
  await expect(page.locator("#splash")).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("with reduced motion, Meldling stays still", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL: "http://127.0.0.1:5181", extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "commit" });
  const img = page.locator("#splash img");
  await expect(img).toBeAttached();
  expect(await img.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await expectSignedOut(page);
  await context.close();
});
