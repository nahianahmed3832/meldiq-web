import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * The interface language (2026-10-23): picked on the sign-in screens before signing in or up, kept in this browser, and
 * changed again in Settings › Appearance. English, 简体中文 and বাংলা, as on Meldiq Android.
 */
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for the interface language");
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("the language is chosen before signing in, kept after a reload, and changed in Settings", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Meldiq" })).toBeVisible({ timeout: 25_000 });

  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.getByRole("heading", { name: "登录 Meldiq" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("zh-CN");
  await shot(page, `sign-in-zh${isMobile ? "-phone" : ""}`);

  // Sign-up is in the chosen language too, and so is the page after a reload.
  await page.getByRole("button", { name: "创建账户" }).click();
  await expect(page.getByRole("heading", { name: "创建你的 Meldiq 账户" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "登录 Meldiq" })).toBeVisible({ timeout: 25_000 });

  await page.getByLabel("语言").selectOption("bn");
  await expect(page.getByRole("heading", { name: "Meldiq-এ সাইন ইন করুন" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("bn");
  await shot(page, `sign-in-bn${isMobile ? "-phone" : ""}`);

  // Inside Meldiq: the navigation follows, and Settings › Appearance changes it back.
  const alice = await newPhone("alice", "Alice Rahman");
  await page.getByLabel("ভাষা").selectOption("en");
  await link(page, alice);
  await page.goto("/settings/appearance");
  await page.getByLabel("Language").selectOption("bn");
  await expect(page.getByRole("heading", { name: "চেহারা" })).toBeVisible();
  if (!isMobile) await expect(page.getByRole("navigation", { name: "Settings pages" })).toContainText("নোটিফিকেশন");
  await page.getByLabel("ভাষা").selectOption("system");
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
});
