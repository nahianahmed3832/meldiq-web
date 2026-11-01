import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectSignedOut, link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("profile editor previews drafts and account actions are available without security settings", async ({ page, isMobile }, info) => {
  const alice = await newPhone("settingslook", "Meldiq Explorer");
  await link(page, alice);
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "My Profile", exact: true })).toBeVisible();
  if (!isMobile) {
    const nav = page.getByRole("navigation", { name: "Settings pages" });
    await expect(nav.getByRole("button", { name: "Log out", exact: true })).toBeInViewport();
    await page.getByRole("searchbox", { name: "Search settings" }).fill("microphone");
    await expect(nav.getByRole("button", { name: /Voice & Audio/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search settings" }).press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search settings" })).toHaveValue("");
  }
  await page.getByRole("button", { name: "Browse frames" }).click();
  await expect(page.getByRole("dialog", { name: "Change avatar decoration" })).toBeVisible();
  await page.getByRole("dialog", { name: "Change avatar decoration" }).getByRole("button", { name: "Close", exact: true }).click();
  const preview = page.getByRole("complementary", { name: "Preview", exact: true });
  await expect(preview).toContainText("Meldiq Explorer");
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("My new look");
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("my_preview_handle");
  await expect(preview).toContainText("My new look");
  await expect(preview).toContainText("@my_preview_handle");
  expect((await alice.req("GET", "/v1/users/me")).user.displayName).toBe("Meldiq Explorer");
  await page.getByRole("button", { name: "Reset unsaved changes" }).click();
  await expect(preview).toContainText("Meldiq Explorer");
  await expect(preview).not.toContainText("@my_preview_handle");
  expect(await page.locator(".settings-page").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.locator(".settings-page").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: path.join("/tmp", `meldiq-settings-redesign-${info.project.name}.png`) });

  if (isMobile) {
    await page.getByRole("button", { name: "Back to settings", exact: true }).click();
    await page.getByRole("button", { name: "Switch account", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Close settings", exact: true }).click();
    await page.getByRole("button", { name: "Account options", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Log out", exact: true })).toBeVisible();
    await page.screenshot({ path: path.join("/tmp", `meldiq-account-options-${info.project.name}.png`) });
    await page.getByRole("menuitem", { name: "Switch account", exact: true }).click();
  }
  const switcher = page.getByRole("dialog", { name: "Switch account", exact: true });
  await expect(switcher).toContainText("Your accounts stay signed in");
  await switcher.getByRole("button", { name: "Close", exact: true }).click();
  await expect(switcher).toHaveCount(0);
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Log out", exact: true }).click();
  else {
    await page.getByRole("button", { name: "Account options", exact: true }).click();
    await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  }
  await page.getByRole("dialog", { name: "Log out of Meldiq?" }).getByRole("button", { name: "Log out", exact: true }).click();
  await expectSignedOut(page);
});

test("adding an account can be canceled without signing out", async ({ page, isMobile }) => {
  const alice = await newPhone("switchaccount", "Account Switcher");
  await link(page, alice);
  if (isMobile) {
    await page.goto("/settings/you");
    await page.getByRole("button", { name: "Switch account", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Account options", exact: true }).click();
    await page.getByRole("menuitem", { name: "Switch account", exact: true }).click();
  }
  await page.getByRole("dialog", { name: "Switch account", exact: true }).getByRole("button", { name: "Add account" }).click();
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Cancel adding account", exact: true }).click();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
});
