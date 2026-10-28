import fs from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Discord-like side panels and look (2026-10-23): the community's photo in the rail; a channel's member list beside the
 * messages (people by role while here, then offline) and a DM's profile, both open by default and hidden from the
 * header; the Meldiq navy theme; and Discord-sized message toolbar and reactions. ORBIT_E2E_SHOTS=<folder> keeps screenshots.
 */
// Desktop Chromium only: one engine is enough for these panels, and touch screens have no hover toolbar (a long press opens the menu).
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium only");
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};
const loaded = (els: Element[]) => els.length > 0 && els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0);

test("community photos in the rail, a member list in channels and a profile in DMs, open by default and hidden from the header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const carol = await newPhone("carol", "Carol Diaz");
  const jpeg = fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg"));

  const { org } = await alice.req("POST", "/v1/orgs", { name: "Panel Lab" });
  await alice.req("PUT", `/v1/orgs/${org.id}/photo`, undefined, jpeg);
  for (const p of [bob, carol]) {
    const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
    await p.req("POST", "/v1/invites/accept", { code: invite.code });
  }
  // Bob is staff: a role shown separately, so he heads his own group while he's here.
  const { role } = await alice.req("POST", `/v1/orgs/${org.id}/roles`, { name: "Staff", color: "#e67e22", hoist: true, permissions: [] });
  await alice.req("PUT", `/v1/roles/${role.id}/members/${bob.userId}`);
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string | null; voice: boolean }[];
  const channel = channels.find((c) => c.orgId === org.id && !c.voice)!;
  for (const p of [bob, carol]) await p.req("POST", `/v1/conversations/${channel.id}/join`).catch(() => undefined);
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect(); // Bob is here; Carol never connects, so she's offline.

  await link(page, alice);
  await expect.poll(() => page.locator(".rail-org .avatar-photo").evaluateAll(loaded), { message: "the community's photo in the rail" }).toBe(true);

  // The Meldiq navy palette by default (community-first design; charcoal and indigo stay available in Appearance), in
  // the dark theme, the default since 2026-10-28.
  expect(await page.evaluate(() => document.documentElement.dataset.palette)).toBe("meldiq");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await page.locator(".app").evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("rgb(7, 11, 24)");

  // A channel: the member list beside the messages, Staff first, then Online, then Offline.
  await page.goto(`/home/c/${channel.id}`);
  const list = page.locator("aside.member-list");
  await expect(list).toBeVisible();
  await expect(list.locator(".member-group")).toHaveText([/^Staff — 1$/i, /^Online — 1$/i, /^Offline — 1$/i]);
  await expect(list.locator("section").nth(0)).toContainText("Bob Chen");
  await expect(list.locator("section").nth(1)).toContainText("Alice Rahman");
  await expect(list.locator("section").nth(2)).toContainText("Carol Diaz");
  await expect(list.locator(".member-row").filter({ hasText: "Bob Chen" }).locator(".member-name .sname")).toHaveCSS("color", "rgb(230, 126, 34)");
  await shot(page, "channel-members");

  // Hidden from the header, and it stays hidden (every channel) until shown again.
  await page.getByRole("button", { name: "Hide the member list" }).first().click();
  await expect(list).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".conv-head")).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByRole("button", { name: "Show the member list" }).click();
  await expect(list).toBeVisible();

  // A DM: the other person's profile beside the messages, hidden and shown from the header.
  await bob.send(dm, { type: "text", text: "Hi Alice, react to this" });
  await page.goto(`/dms/c/${dm}`);
  const profile = page.locator("aside.profile-panel");
  await expect(profile).toBeVisible();
  await expect(profile.locator("h2")).toHaveText("Bob Chen");
  await expect(profile).toContainText(`@${bob.username}`);
  await shot(page, "dm-profile");
  await page.getByRole("button", { name: "Hide the profile" }).first().click();
  await expect(profile).toHaveCount(0);
  await page.getByRole("button", { name: "Show the profile" }).click();
  await expect(profile).toBeVisible();

  // Discord-sized message toolbar and reactions.
  const msg = page.locator(".msg").filter({ hasText: "Hi Alice, react to this" });
  await msg.hover();
  const tool = msg.locator(".msg-actions");
  await expect(tool).toBeVisible();
  await expect(tool.getByRole("button", { name: "Forward" })).toBeVisible();
  expect((await tool.getByRole("button", { name: "Reply", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(36);
  await tool.getByRole("button", { name: "React 👍" }).click();
  const chip = msg.locator(".reaction").first();
  await expect(chip).toBeVisible();
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  expect(await chip.locator(".reaction-emoji").evaluate((el) => getComputedStyle(el).fontSize)).toBe("20px");
  await msg.hover();
  await shot(page, "dm-toolbar-reaction");
  if (SHOTS) {
    await page.emulateMedia({ colorScheme: "dark" });
    await msg.hover();
    await shot(page, "dm-dark");
    await page.goto(`/home/c/${channel.id}`);
    await expect(list.locator(".member-group")).toHaveCount(3);
    await page.waitForTimeout(1500); // the launch screen fades out after a reload
    await shot(page, "channel-dark");
    await page.emulateMedia({ colorScheme: "light" });
  }

  // Narrower screens keep the messages wide: nothing beside them until asked, then the panel opens over them.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`/home/c/${channel.id}`);
  await expect(page.locator(".conv-head")).toBeVisible();
  await expect(list).toHaveCount(0);
  await page.getByRole("button", { name: "Show the member list" }).click();
  await expect(list).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/home/c/${channel.id}/members$`));
  await shot(page, "narrow-members");
});
