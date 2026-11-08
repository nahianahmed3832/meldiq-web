import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("community settings save through the existing API and show the quoted offers", async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || !["chromium", "webkit"].includes(browserName), "desktop settings window");
  const owner = await newPhone("communityref", "Community Reference Owner");
  const { org } = await owner.req("POST", "/v1/orgs", { name: "Reference Room" });
  const shots = process.env.ORBIT_E2E_SHOTS;
  const screenshot = async (name: string) => {
    if (shots && browserName === "chromium") await page.screenshot({ path: path.join(shots, name + ".png"), animations: "disabled" });
  };
  await link(page, owner);
  await page.goto("/workspace/overview");
  const settings = page.getByRole("dialog", { name: "Reference Room settings" });
  const rail = settings.getByRole("navigation", { name: "Community settings" });
  await expect(settings.getByRole("heading", { name: "Server profile" })).toBeVisible();
  await expect(settings.getByRole("complementary", { name: "Server profile preview" })).toContainText("Reference Room");
  await screenshot("overview");

  await rail.getByRole("button", { name: "Theme", exact: true }).click();
  await settings.getByRole("textbox", { name: "Accent color as hexadecimal" }).fill("#8458e8");
  await settings.getByRole("textbox", { name: "Background tint as hexadecimal" }).fill("#14b8a6");
  await screenshot("theme");
  await settings.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => owner.req("GET", `/v1/orgs/${org.id}/settings`)).toMatchObject({ accent: "#8458e8", background: "#14b8a6" });

  await rail.getByRole("button", { name: "Channels", exact: true }).click();
  const arranger = settings.getByRole("region", { name: "Arrange channels" });
  for (const name of ["First category", "Second category"]) {
    await arranger.getByRole("button", { name: "Create category" }).click();
    const create = page.getByRole("dialog", { name: "Create category" });
    await create.getByRole("textbox", { name: "Category name" }).fill(name);
    await create.getByRole("button", { name: "Create category" }).click();
    await expect(create).toBeHidden();
    await expect(arranger.getByText(name, { exact: true })).toBeVisible();
  }
  await arranger.getByRole("button", { name: "Move Second category up" }).click();
  const names = () => arranger.locator(".ws-order-section strong").allTextContents();
  await expect.poll(async () => (await names()).slice(-2)).toEqual(["Second category", "First category"]);
  await arranger.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await names()).slice(-2)).toEqual(["First category", "Second category"]);
  await screenshot("channels");

  await rail.getByRole("button", { name: "Emoji", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "No emojis yet" })).toBeVisible();
  await expect(settings.getByText("0 / 50 used")).toBeVisible();
  await screenshot("emoji");
  await rail.getByRole("button", { name: "Stickers", exact: true }).click();
  await expect(settings.getByRole("heading", { name: "No stickers yet" })).toBeVisible();

  await rail.getByRole("button", { name: "Supercharge", exact: true }).click();
  await expect(settings.getByText("$5.98/month", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: /Level 2/ }).click();
  await expect(settings.getByText("$20.93/month", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: /Level 3/ }).click();
  await expect(settings.getByText("$41.86/month", { exact: true })).toBeVisible();
  await expect(settings.getByRole("button", { name: /Get Supercharge/ })).toBeDisabled();
  await screenshot("supercharge");
  await rail.getByRole("button", { name: "Promote", exact: true }).click();
  await expect(settings.locator(".promote-price")).toHaveText([/\$3\.99/, /\$7\.99/, /\$12\.99/, /\$29\.99/]);
  await expect(settings.getByRole("button", { name: "Get Mega Boost", exact: true })).toBeDisabled();
  await screenshot("promote");

  await settings.getByRole("button", { name: "Close settings" }).click();
  await expect(settings).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/sparks");
  await expect(page.getByRole("heading", { name: "Supercharge Reference Room" })).toBeVisible();
  const dimensions = await page.locator(".community-supercharge").evaluate((node) => ({ client: node.clientWidth, content: node.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.client);
  await screenshot("supercharge-phone");
});
