import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Community parity, batch A wired to the server (community-permissions, community-safety, community-settings): the
 * Profile's safety section and lock, Roles with @everyone and the role editor's tabs, the Theme tint, Create channel's
 * options, and a member's view of a locked community and a read-only channel.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("owner: safety and lock, roles with @everyone, theme tint, create channel options", async ({ page }) => {
  const alice = await newPhone("paalice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Wiring Lab" });
  await alice.connect();
  await link(page, alice);
  await page.goto("/workspace/overview");
  const window = page.getByRole("dialog", { name: "Wiring Lab settings" });
  await expect(window.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();

  // Safety: lock for 15 minutes, then unlock; the verification level and the new-account gate.
  const raid = window.getByRole("region", { name: "Raid protection" });
  await raid.scrollIntoViewIfNeeded();
  await expect(window.getByLabel("Verification level")).toBeVisible();
  await expect(window.getByLabel("New accounts")).toBeVisible();
  await shot(page, "a-profile-safety");
  await raid.getByRole("button", { name: "Lock for 15 min" }).click();
  await expect(raid.getByText(/Locked: unlocks in/)).toBeVisible();
  await shot(page, "a-profile-locked");
  await raid.getByRole("button", { name: "Unlock" }).click();
  await expect(raid.getByRole("button", { name: "Lock for 1 hour" })).toBeVisible();
  await window.getByLabel("Verification level").selectOption("medium");
  await expect(window.getByText("Low, plus an account and a membership at least 5 minutes old.")).toBeVisible();
  await expect.poll(async () => (await alice.req("GET", `/v1/orgs/${org.id}/safety`)).verificationLevel).toBe("medium");

  // Roles: the @everyone row, then a new role with a gradient on the Display tab.
  await window.getByRole("navigation", { name: "Community settings" }).getByRole("button", { name: "Roles" }).click();
  await window.getByRole("button", { name: /Default permissions/ }).click();
  const everyone = page.getByRole("dialog", { name: /Default permissions/ });
  await expect(everyone.getByRole("textbox", { name: "Search permissions" })).toBeVisible();
  await shot(page, "a-roles-everyone");
  await everyone.getByRole("button", { name: "Cancel" }).click();
  await window.getByRole("button", { name: "Create role" }).click();
  await page.getByRole("menuitem", { name: "Blank role" }).click();
  const editor = page.getByRole("dialog", { name: "New role" });
  await editor.getByLabel("Role name").fill("Night Owls");
  await editor.getByRole("radiogroup", { name: "Fade into a second colour (optional)" }).getByRole("radio").nth(5).click();
  await editor.getByLabel("Let anyone mention this role").check({ force: true });
  await shot(page, "a-role-display");
  await editor.getByRole("tab", { name: "Permissions" }).click();
  await shot(page, "a-role-permissions");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor).toHaveCount(0);
  const roles = (await alice.req("GET", `/v1/orgs/${org.id}/roles`)).roles as { name: string; extras?: { color2: string | null; mentionable: boolean } }[];
  expect(roles.find((r) => r.name === "Night Owls")?.extras).toMatchObject({ mentionable: true });
  expect(roles.find((r) => r.name === "Night Owls")?.extras?.color2).toMatch(/^#/);
  await shot(page, "a-roles-list");

  // Theme: the background tint, saved to the community's settings.
  await window.getByRole("navigation", { name: "Community settings" }).getByRole("button", { name: "Theme" }).click();
  const tint = window.getByRole("region", { name: "Background tint" });
  await tint.getByRole("button", { name: "Teal" }).click();
  await shot(page, "a-theme-tint");
  await tint.getByRole("button", { name: "Save tint" }).click();
  await expect.poll(async () => (await alice.req("GET", `/v1/orgs/${org.id}/settings`)).background).toBe("#14b8a6");
  await page.keyboard.press("Escape");

  // Create channel: read-only with who can post, slowmode at create.
  await page.goto("/home");
  // Realtime/HMR traffic can remain active; wait for the actual connected shell and community control.
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Wiring Lab/ }).first()).toBeVisible();
  await page
    .getByRole("button", { name: /^Wiring Lab/ })
    .first()
    .click({ button: "right" });
  await page.getByRole("menu", { name: "Wiring Lab" }).getByRole("menuitem", { name: "Create channel" }).click();
  const create = page.getByRole("dialog", { name: /Create channel/ });
  await create.getByLabel("Name").fill("news");
  await create.getByLabel("Read-only").check({ force: true });
  await create.getByRole("group", { name: "Who can post" }).getByRole("button", { name: "@Night Owls" }).click();
  await shot(page, "a-create-channel");
  await create.getByRole("button", { name: "Create channel" }).click();
  await expect(create).toHaveCount(0);
  const chans = (await alice.req("GET", `/v1/orgs/${org.id}/channels`)).channels as { name: string; options?: { readOnly: boolean; posterRoleIds: string[] } }[];
  expect(chans.find((c) => c.name === "news")?.options).toMatchObject({ readOnly: true });
});

test("member: a locked community and a read-only channel hold the composer back", async ({ page }) => {
  const alice = await newPhone("pbalice", "Alice Rahman");
  const bob = await newPhone("pbbob", "Bob Chen");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Quiet Lab" });
  const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
  await bob.req("POST", "/v1/invites/accept", { code: invite.code });
  const { channel: news } = await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "news", scope: "ORG", kind: "PUBLIC", autoJoin: true, readOnly: true });
  const { channel: chat } = await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "chat", scope: "ORG", kind: "PUBLIC", autoJoin: true });
  await bob.connect();
  await link(page, bob);

  await page.goto(`/home/c/${news.id}`);
  await expect(page.getByRole("note").filter({ hasText: "read-only" })).toBeVisible();
  await shot(page, "a-member-read-only");

  await alice.req("PUT", `/v1/orgs/${org.id}/lock`, { duration: "1h" });
  await page.goto(`/home/c/${chat.id}`);
  await expect(page.getByRole("status").filter({ hasText: /is locked and unlocks in/ })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Only moderators can post" })).toBeVisible();
  await shot(page, "a-member-locked");
});
