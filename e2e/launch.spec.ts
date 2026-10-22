import { expect, test } from "@playwright/test";
import { expectSignedOut } from "./link";
import { testAddress } from "./phone";

/**
 * The launch screen (docs/MELDIQ_WEB_LAUNCH.md): the logo from the first paint, gone as soon as the app shows
 * something, never in front of sign-in; the animation only where motion is welcome; a failed download changes nothing.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("the logo shows at once and makes way for sign-in", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#splash img")).toBeAttached();
  await expectSignedOut(page);
  await expect(page.locator("#splash")).toHaveCount(0, { timeout: 5_000 });
  // Signed out, nothing waits for the 5-second animation.
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("with reduced motion, only the still logo: the animation isn't even downloaded", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL: "http://127.0.0.1:5181", extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const page = await context.newPage();
  const videos: string[] = [];
  page.on("request", (r) => r.url().includes("/launch/meldiq-launch.mp4") && videos.push(r.url()));
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#splash img")).toBeAttached();
  await expectSignedOut(page);
  expect(videos).toEqual([]);
  await context.close();
});

test("a failed animation download still opens Meldiq", async ({ page }) => {
  await page.route("**/launch/meldiq-launch.mp4", (r) => r.abort("failed"));
  await page.goto("/");
  await expectSignedOut(page);
  await expect(page.locator("#splash")).toHaveCount(0, { timeout: 5_000 });
});
