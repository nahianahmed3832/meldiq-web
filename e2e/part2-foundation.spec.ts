import { openPrivacyPolicy } from "./privacy";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { emailedCode } from "./mail";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
const screenshots = process.env.MELDIQ_PART2_SCREENSHOTS ?? "/tmp/meldiq-part2/browser";

test("fresh registration enforces consent, verifies email, and resumes real profile/preferences setup", async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  const email = `foundation.${crypto.randomBytes(5).toString("hex")}@example.test`;
  let registrations = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/v2/auth/register") registrations++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Foundation Explorer");
  await page.getByLabel("Email", { exact: true }).fill(email);
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("synthetic local test password 42");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Read and accept");
  expect(registrations).toBe(0);
  const consent = page.getByRole("checkbox", { name: /I am 13 or older/ });
  const privacy = page.locator(".auth-consent").getByRole("link", { name: "Privacy", exact: true });
  await expect(consent).toBeDisabled();
  await expect(privacy).toBeFocused();
  await openPrivacyPolicy(page, true);
  await expect(consent).toBeEnabled();
  await expect(consent).not.toBeChecked();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  expect(registrations).toBe(0);
  await consent.check();
  await page.getByRole("button", { name: "Create account", exact: true }).dblclick();
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
  expect(registrations).toBe(1);
  await expect(page.getByRole("button", { name: /Send a new code in/ })).toBeDisabled();
  const oldCode = await emailedCode(email, "verify");
  const resend = page.getByRole("button", { name: "Send a new code", exact: true });
  await expect(resend).toBeEnabled({ timeout: 35_000 });
  await resend.click();
  await expect(page.getByRole("button", { name: /Send a new code in/ })).toBeDisabled();
  await expect.poll(() => emailedCode(email, "verify")).not.toBe(oldCode);
  await page.getByLabel("Code", { exact: true }).fill(oldCode);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.", { exact: true }).check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your profile", exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("Foundation Explorer");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "meldiq");
  await expect(page.locator(".welcome-story .meldling-art")).toHaveAttribute("src", "/meldling-128.png");
  const brandScreenshots = process.env.MELDIQ_BRANDING_SCREENSHOTS ?? "/tmp/meldiq-part2/branding";
  fs.mkdirSync(brandScreenshots, { recursive: true });
  await page.screenshot({ path: path.join(brandScreenshots, `welcome-default-${info.project.name}.jpg`), animations: "disabled" });
  await page.getByLabel("Display name", { exact: true }).fill("My Meldiq Space");
  await page.locator(".welcome-avatar input[type=file]").setInputFiles(path.resolve("e2e/fixtures/photo.jpg"));
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "App preferences", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "Indigo", exact: true }).click();
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "বাংলা", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await page.locator(".welcome-card .lang-picker").click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.reload();
  await expect(page.getByRole("heading", { name: "App preferences", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  if (isMobile) expect((await page.locator(".welcome-story .meldling-art").boundingBox())?.width).toBeLessThan(100);
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, `welcome-${info.project.name}.jpg`), animations: "disabled" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start exploring", exact: true }).click();
  await expect(page.locator(".app[data-connection=online]")).toBeVisible();
  await page.reload();
  await expect(page.locator(".app[data-connection=online]")).toBeVisible();
  await expect(page.locator(".welcome-layout")).toHaveCount(0);
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue("My Meldiq Space");
});

test("sign-in capabilities have an actionable failure and retry without inventing signup availability", async ({ page }) => {
  let failed = false;
  let logins = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/v2/auth/login") logins++;
  });
  await page.route("**/v1/server-info", async (route) => {
    if (!failed) {
      failed = true;
      return route.fulfill({ status: 503, json: { error: "unavailable", message: "Synthetic local outage" } });
    }
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Sign-in options could not be loaded");
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(logins).toBe(0);
  await expect(page.locator(".app[data-connection=online]")).toHaveCount(0);
});

test("profile section drafts preview, save and reload without dropping hidden sections or prior audience rules", async ({ page }, info) => {
  const owner = await newPhone("layout", "Layout Explorer");
  await owner.req("PATCH", "/v1/users/me", { aboutMe: "A synthetic profile biography", links: [{ label: "Project", url: "https://example.test/project" }] });
  await link(page, owner);
  await page.goto("/settings/profile");
  const section = page.getByRole("region", { name: "Profile sections", exact: true });
  await expect(section).toBeVisible();
  await section.getByRole("switch", { name: "About me", exact: true }).click();
  await section.getByRole("button", { name: "Move Connections up", exact: true }).click();
  await section.getByRole("button", { name: "Move Connections up", exact: true }).click();
  await expect(page.locator(".profile-preview .profile-about")).toHaveCount(0);
  expect((await owner.req("GET", "/v1/users/me")).user.profileStyle?.layout).toBeUndefined();
  await section.getByRole("button", { name: "Save sections", exact: true }).click();
  await expect(section.getByRole("button", { name: "Save sections", exact: true })).toBeDisabled();
  await page.reload();
  await expect(section.getByRole("switch", { name: "About me", exact: true })).not.toBeChecked();
  await expect(section.locator("li").first()).toHaveAttribute("data-section", "connections");
  expect((await owner.req("GET", "/v1/users/me")).user.aboutMe).toBe("A synthetic profile biography");
  const peer = await newPhone("layoutpeer", "Layout Peer");
  const viewed = (await peer.req("GET", `/v1/users/${owner.userId}`)).user;
  expect(viewed.aboutMe).toBeUndefined();
  expect(viewed.links).toHaveLength(1);
  await section.getByRole("switch", { name: "About me", exact: true }).click();
  await section.getByRole("button", { name: "Reset section changes", exact: true }).click();
  await expect(section.getByRole("switch", { name: "About me", exact: true })).not.toBeChecked();
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, `profile-${info.project.name}.jpg`), animations: "disabled" });
});

test("settings keyboard search, nested modal focus and all target widths remain usable", async ({ page, isMobile }, info) => {
  const owner = await newPhone("foundationnav", "Navigation Explorer");
  await link(page, owner);
  await page.goto("/settings/you");
  const search = page.getByRole("searchbox", { name: "Search settings", exact: true });
  await search.fill("microphone");
  await search.press("ArrowDown");
  await expect(page.locator('[data-settings-key="calls"]')).toBeFocused();
  await search.focus();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/settings\/calls$/);
  await page.goto("/settings/language");
  const picker = page.locator(".settings-page").getByRole("button", { name: "Language", exact: true });
  await picker.click();
  await expect(page.getByRole("searchbox", { name: "Search languages", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(picker).toBeFocused();
  if (!isMobile) await expect(page.getByRole("dialog", { name: "Settings", exact: true })).toBeVisible();
  const viewports = isMobile
    ? [
        [390, 844],
        [844, 390],
      ]
    : [
        [1920, 1080],
        [1440, 900],
        [1280, 800],
        [1024, 768],
        [768, 1024],
      ];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/settings/you");
    await expect(page.getByRole("navigation", { name: "Settings pages", exact: true })).toBeVisible();
    expect(await page.locator(".settings").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await page.goto("/home");
  const skip = page.getByRole("button", { name: "Skip to main content", exact: true });
  await skip.focus();
  await skip.press("Enter");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toMatch(/^H[12]$/);
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, `home-${info.project.name}.jpg`), animations: "disabled" });
});
