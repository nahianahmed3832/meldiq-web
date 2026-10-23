import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Community controls from Meldiq Android (2026-10-23): a text channel's header bell (mute for a while, the level),
 * channel permissions' Basic view (Private, who can access), and creating an event in three steps with a preview.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium is enough for these controls");
test.describe.configure({ timeout: 150_000 });
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("channel bell, Basic permissions and a three-step event", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Control Lab" });
  const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
  await bob.req("POST", "/v1/invites/accept", { code: invite.code });
  const { role } = await alice.req("POST", `/v1/orgs/${org.id}/roles`, { name: "Staff", color: "#e67e22", permissions: [] });
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string | null; voice: boolean; format: string | null; kind: string }[];
  const channel = channels.find((c) => c.orgId === org.id && !c.voice && c.format !== "forum" && c.kind !== "ANNOUNCEMENT")!;
  await link(page, alice);

  // The bell: mute for an hour, then unmute; then only @mentions.
  await page.goto(`/home/c/${channel.id}`);
  const bell = page.locator(".conv-head").getByRole("button", { name: /^Notification settings|^Notifications muted/ });
  await bell.click();
  await shot(page, "bell-menu");
  await page.getByRole("menuitem", { name: "For 1 hour" }).click();
  await expect(bell).toHaveAccessibleName(/^Notifications muted until/);
  await bell.click();
  await page.getByRole("menuitem", { name: "Unmute" }).click();
  await expect(bell).toHaveAccessibleName("Notification settings");
  await bell.click();
  await page.getByRole("menuitemradio", { name: "Only @mentions" }).click();
  await bell.click();
  await expect(page.getByRole("menuitemradio", { name: "Only @mentions" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  // Permissions, Basic view: make it private, then give the Staff role access.
  await page.goto(`/home/c/${channel.id}/details`);
  await page.getByRole("button", { name: /Manage channel access/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("group", { name: "Permissions view" }).getByRole("button", { name: "Basic" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("switch", { name: "Private channel" }).click();
  await expect(dialog.getByText(/Only owners and admins can see this channel now/)).toBeVisible();
  await dialog.getByRole("button", { name: "+ @Staff" }).click();
  await expect(dialog.getByRole("region", { name: "Who can access" })).toContainText("@Staff");
  await shot(page, "permissions-basic");
  const ow = await alice.req("GET", `/v1/conversations/${channel.id}/overwrites`);
  const of = (s: string) => ow.overwrites.find((o: { subject: string }) => o.subject === s);
  expect(of("everyone").deny).toContain("channels.view");
  expect(of(role.id).allow).toContain("channels.view");
  await page.keyboard.press("Escape");

  // An event in three steps: where, what and when, then the preview.
  await page.goto("/workspace/meetings");
  await page
    .getByRole("button", { name: /Schedule/ })
    .first()
    .click();
  const ev = page.getByRole("dialog");
  await expect(ev.getByRole("list", { name: "Steps" })).toBeVisible();
  await ev.getByRole("button", { name: "Next" }).click(); // a voice room is picked already
  await expect(ev.getByRole("button", { name: "Next" })).toBeDisabled(); // no title yet
  await ev.getByPlaceholder("e.g. Weekly sync").fill("Launch party");
  await ev.getByRole("button", { name: "Next" }).click();
  await expect(ev.getByLabel("Preview")).toContainText("Launch party");
  await shot(page, "event-preview");
  await ev.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByText("Launch party")).toBeVisible();

  // Member actions go from least to most severe: Report before Ban.
  await page.goto("/workspace/people");
  await page.getByRole("button", { name: "Manage Bob Chen" }).click();
  const items = await page.getByRole("menu").getByRole("menuitem").allInnerTexts();
  expect(items.findIndex((t) => t.startsWith("Report"))).toBeLessThan(items.findIndex((t) => t.startsWith("Ban")));
});
