import path from "node:path";
import { test, expect } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("comfort controls persist across reload and mobile layouts", async ({ page }) => {
  const alice = await newPhone("comfort", "Comfort Reader");
  await link(page, alice);
  await page.goto("/settings/appearance");
  await page.getByLabel("Message density", { exact: true }).selectOption("compact");
  await page.getByLabel("Line spacing", { exact: true }).selectOption("relaxed");
  await page.getByLabel("Reduce motion", { exact: true }).selectOption("on");
  await page.getByRole("switch", { name: "Higher contrast" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  if (process.env.ORBIT_E2E_SHOTS) await page.screenshot({ path: path.join(process.env.ORBIT_E2E_SHOTS, `comfort-${test.info().project.name}.png`) });
  await page.reload();
  await expect(page.getByLabel("Message density", { exact: true })).toHaveValue("compact");
  await expect(page.locator("html")).toHaveAttribute("data-line-spacing", "relaxed");
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Reset comfort controls" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "system");
});

test("custom expressions support synced favorites, recent use and source removal", async ({ page }) => {
  const alice = await newPhone("favorite", "Expression Reader");
  const bob = await newPhone("favpeer", "Expression Peer");
  const org = (await bob.req("POST", "/v1/orgs", { name: "Favorites Lab" })).org.id;
  const invite = (await bob.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await alice.req("POST", "/v1/invites/accept", { code: invite });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  const expression = await bob.req("POST", `/v1/orgs/${org}/expressions?kind=emoji&name=happy_wave`, undefined, png);
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  await page.goto("/settings/appearance");
  await page.getByLabel("Reduce motion", { exact: true }).selectOption("on");
  await page.goto(`/dms/c/${dm}`);
  const open = () => page.getByRole("button", { name: "Insert emoji" }).click();
  await open();
  const picker = page.getByRole("dialog", { name: "Emoji, GIFs and stickers" });
  await expect(picker.locator("canvas")).toHaveCount(1);
  await picker.getByRole("button", { name: "Favorite happy_wave", exact: true }).click();
  await picker.getByRole("button", { name: "Favorites", exact: true }).click();
  await picker.getByRole("button", { name: ":happy_wave:", exact: true }).click();
  await expect.poll(async () => (await alice.req("GET", "/v1/me/preferences/personal")).prefs.expressionRecents?.length ?? 0).toBe(1);
  await page.reload();
  await open();
  await picker.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(picker.getByRole("button", { name: ":happy_wave:", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Recent", exact: true }).click();
  await expect(picker.getByRole("button", { name: ":happy_wave:", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Unfavorite happy_wave", exact: true }).click();
  await picker.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(picker.getByText("Star expressions to keep them here.")).toBeVisible();
  await alice.req("DELETE", `/v1/orgs/${org}/members/${alice.userId}`);
  await page.reload();
  await open();
  await picker.getByRole("button", { name: "Recent", exact: true }).click();
  await expect(picker.getByRole("button", { name: ":happy_wave:", exact: true })).toHaveCount(0);
  expect(expression).toBeTruthy();
});

test("profile links remain a draft through background updates and core conflicts are explicit", async ({ page }) => {
  const alice = await newPhone("drafts", "Profile Drafter");
  await link(page, alice);
  await page.goto("/settings/profile");
  await page.getByRole("button", { name: "+ Add link", exact: true }).click();
  await page.getByLabel("Link 1 name").fill("My site");
  await page.getByLabel("Link 1 address").fill("https://example.com/me");
  await alice.req("PUT", "/v1/users/me/profile-style", { themeColors: ["#123456"] });
  await expect(page.getByLabel("Link 1 name")).toHaveValue("My site");
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("My draft name");
  await alice.req("PATCH", "/v1/users/me", { aboutMe: "Changed on another device" });
  await expect(page.getByRole("alert").filter({ hasText: "Your profile changed on another device" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Display name", exact: true })).toHaveValue("My draft name");
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reload latest profile" }).click();
  await expect(page.getByRole("textbox", { name: "About me", exact: true })).toHaveValue("Changed on another device");
});

test("community profiles preview, apply and reset without changing global bio", async ({ page }) => {
  const alice = await newPhone("localprofile", "Community Persona");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Profile Club" })).org.id;
  await alice.req("PATCH", "/v1/users/me", { aboutMe: "Global biography", pronouns: "they/them" });
  await link(page, alice);
  await page.goto("/settings/profile");
  await page.getByLabel("Profile community", { exact: true }).selectOption(org);
  const input = page.getByLabel("Community about me", { exact: true });
  await expect(input).toHaveValue("Global biography");
  await page.locator("label").filter({ has: input }).getByRole("checkbox").uncheck();
  await input.fill("Only in Profile Club");
  await page.getByLabel("Community profile theme", { exact: true }).selectOption("ocean");
  await expect(page.getByLabel("Community profile preview")).toContainText("Only in Profile Club");
  await page.getByRole("button", { name: "Apply community profile", exact: true }).click();
  await expect.poll(async () => (await alice.req("GET", `/v1/orgs/${org}/members/${alice.userId}/profile`)).profile.aboutMe).toBe("Only in Profile Club");
  expect((await alice.req("GET", "/v1/users/me")).user.aboutMe).toBe("Global biography");
  await page.getByRole("button", { name: "Reset to global", exact: true }).click();
  await page.getByRole("button", { name: "Apply community profile", exact: true }).click();
  await expect.poll(async () => (await alice.req("GET", `/v1/orgs/${org}/members/${alice.userId}/profile`)).profile.aboutMe).toBeNull();
});

test("notification overview explains inheritance and syncs an account pause", async ({ page }) => {
  const alice = await newPhone("notifier", "Notification Reader");
  await alice.req("POST", "/v1/orgs", { name: "Quiet Club" });
  await link(page, alice);
  await page.goto("/settings/notifications");
  await expect(page.getByText("Notification overview", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause all for 1 hour", exact: true }).click();
  await expect(page.getByText(/^Paused until/)).toBeVisible();
  expect((await alice.req("GET", "/v1/users/me")).user.notificationsPausedUntil).toBeGreaterThan(Date.now());
  await page.getByRole("button", { name: "Resume all", exact: true }).click();
  await expect(page.getByText("Account notifications active", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("profile look changes preview until applied and can be undone", async ({ page }) => {
  const alice = await newPhone("lookdraft", "Look Drafter");
  await link(page, alice);
  await page.goto("/settings/profile");
  const look = page.getByLabel("Look", { exact: true });
  await look.getByRole("group", { name: "Theme presets" }).getByRole("button", { name: "Ocean", exact: true }).click();
  await expect(look.getByText("Unsaved look preview", { exact: true })).toBeVisible();
  expect((await alice.req("GET", "/v1/users/me")).user.profileStyle?.themeColors ?? null).toBeNull();
  await look.getByRole("button", { name: "Undo look change", exact: true }).click();
  await expect(look.getByRole("button", { name: "Apply look", exact: true })).toBeDisabled();
  await look.getByRole("group", { name: "Theme presets" }).getByRole("button", { name: "Ocean", exact: true }).click();
  await look.getByRole("button", { name: "Apply look", exact: true }).click();
  await expect.poll(async () => (await alice.req("GET", "/v1/users/me")).user.profileStyle?.themeColors).toEqual(["#2193b0", "#6dd5ed"]);
});
