import { expect, test } from "@playwright/test";

/**
 * A new release reaches open tabs (reported 2026-10-23: a deploy showed only after a manual refresh). The production
 * build only: a development server has no release id. The new release is simulated by answering the tab's check with a
 * page of another build.
 */
test.skip(process.env.ORBIT_E2E_BUILD !== "1", "needs the production build (a development server has no release id)");
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "one engine is enough for the release check");

test("an open tab offers a new release and Reload opens it", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 25_000 });
  const running = await page.evaluate(() => (window as unknown as { __NEXT_DATA__: { buildId: string } }).__NEXT_DATA__.buildId);
  expect(running).not.toBe("development");

  // The server now has another release.
  const root = `${baseURL}/`;
  await page.route(root, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(`"buildId":"${running}"`, `"buildId":"${running}-next"`);
    await route.fulfill({ response: res, body });
  });
  // Coming back to the tab checks for a new release.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const notice = page.getByRole("status").filter({ hasText: "A new version of Meldiq is ready." });
  await expect(notice).toBeVisible();

  await page.unroute(root);
  await notice.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 25_000 });
  await expect(notice).toHaveCount(0);
});
