import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("service inbox stays in account settings and the work area fills the remaining viewport", async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  const phone = await newPhone("inboxlayout", "Inbox Layout");
  let enabled = true;
  await page.route("**/v1/server-info", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.features = data.features.filter((feature: string) => feature !== "platform-operations");
    if (enabled) data.features.push("platform-operations");
    await route.fulfill({ json: data });
  });
  await page.route("**/v2/platform/notices", (route) => route.fulfill({ json: { items: [] } }));
  await link(page, phone);

  const check = async () => {
    const workspace = await page.locator(".workspace").boundingBox();
    const body = await page.locator(".workspace > .body").boundingBox();
    expect(workspace).not.toBeNull();
    expect(body).not.toBeNull();
    expect(body!.height).toBeGreaterThan(workspace!.height * 0.7);
    expect(Math.abs(body!.y + body!.height - workspace!.y - workspace!.height)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Service inbox", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };

  for (const path of ["/dms", "/discover"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Service inbox", exact: true })).toHaveCount(0);
    await check();
  }
  if (!isMobile) {
    await page.setViewportSize({ width: 820, height: 900 });
    await check();
  }
  await page.screenshot({ path: `/tmp/meldiq-service-inbox-layout-${info.project.name}.png` });
  enabled = false;
  await page.reload();
  await expect(page.locator(".app[data-connection=online]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Service inbox", exact: true })).toHaveCount(0);
  await check();
});
