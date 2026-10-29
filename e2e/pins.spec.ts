import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Profile pins and animated community images (API 0.64.0, server docs/PROFILE_PINS.md and COMMUNITY_BRANDING.md): an
 * owner makes a pin in Community settings › Pins and gives it to a member, who then wears it beside Meldiq's own on
 * their profile; an animated GIF banner is uploaded as it is and shown as a GIF.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium is enough for pins");
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("make a community pin, give it, see it on the profile; an animated banner stays a GIF", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const info = await alice.req("GET", "/v1/server-info");
  test.skip(!(info.features as string[]).includes("profile-pins"), `the server (${info.version}) has no profile pins (API 0.64.0)`);
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Pin Club" });
  const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
  await bob.req("POST", "/v1/invites/accept", { code: invite.code });
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation;
  await link(page, alice);

  await page.goto("/workspace/pins");
  const card = page.getByRole("region", { name: /^Pins · / });
  await expect(card).toContainText("No pins yet");
  await card.getByRole("button", { name: "Make a pin" }).click();
  const make = page.getByRole("dialog", { name: "Make a pin" });
  await make.locator("input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/decoration.png"));
  await make.getByLabel("Name").fill("Top helper");
  await make.getByLabel("What it's for (optional)").fill("Answered 100 questions");
  await make.getByRole("button", { name: "Make pin" }).click();
  await expect(make).toBeHidden();
  const row = card.locator(".pin-item").filter({ hasText: "Top helper" });
  await expect(row).toContainText("0 members have it");

  await row.getByRole("button", { name: "Give or take back" }).click();
  const holders = page.getByRole("dialog", { name: "Top helper" });
  await holders.locator(".pin-people li").filter({ hasText: "Bob Chen" }).getByRole("button", { name: "Give" }).click();
  await expect(holders.locator(".pin-people li").filter({ hasText: "Bob Chen" }).getByRole("button", { name: "Take back" })).toBeVisible();
  await holders.screenshot({ path: test.info().outputPath("holders.png") });
  await page.keyboard.press("Escape");
  await expect(row).toContainText("1 member has it");

  const pins = async () => ((await alice.req("GET", `/v1/users/${bob.userId}`)).user.pins ?? []) as { kind: string; name: string }[];
  await expect.poll(async () => (await pins()).map((p) => `${p.kind}:${p.name}`)).toEqual(["meldiq:Early member", "community:Top helper"]);

  // Bob's profile beside the DM shows both pins, and one says where it's from.
  await page.goto(`/dms/c/${dm.id}`);
  const panel = page.locator("aside.profile-panel");
  const row2 = panel.getByRole("list", { name: "Pins" });
  await expect(row2.locator("img")).toHaveCount(2);
  await row2.getByRole("button", { name: /Top helper/ }).click();
  await expect(panel.locator(".profile-pin-card")).toContainText("Given by Pin Club");
  await panel.screenshot({ path: test.info().outputPath("profile-pins.png") });

  // An animated banner goes up as it is.
  await page.goto("/workspace/overview");
  const appearance = page.getByRole("region", { name: "Appearance" });
  await appearance.locator("input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/banner.gif"));
  await appearance.getByRole("button", { name: "Save appearance" }).click();
  await expect(appearance.getByText("Saved")).toBeVisible();
  const banner: Buffer = await alice.req("GET", `/v1/orgs/${org.id}/banner`);
  expect(banner.subarray(0, 6).toString("latin1")).toBe("GIF89a");
});
