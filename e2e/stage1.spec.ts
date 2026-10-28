import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * 2026-10-28 round, stage 1: Meldiq's own right-click menus everywhere (the community icon's menu as the reference's
 * server menu, with a Mute community submenu; nothing from the browser on the rail's empty space), the user panel with
 * microphone and headphones, name styles and a community tag in the member list, and the invite page's icon.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");

/** A tiny but valid JPEG (1 × 1), for community icons. */
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

test("the community icon's menu: mark as read, invite, mute for a while, notifications, settings; Builder mode adds Copy ID", async ({ page }) => {
  const alice = await newPhone("s1alice", "Alice Rahman");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Menu Lab" })).org;
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");
  const icon = page.getByRole("button", { name: /^Menu Lab/ }).first();
  await icon.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Menu Lab" });
  await expect(menu).toBeVisible();
  for (const item of ["Mark as read", "Invite people", "Mute community", "Notification settings", "Community settings", "Create channel", "Copy community name"])
    await expect(menu.getByRole("menuitem", { name: new RegExp(`^${item}`) })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copy community ID" })).toHaveCount(0);
  await expect(menu.getByRole("menuitemcheckbox", { name: "Hide muted channels" })).toBeVisible();

  // Mute community opens its submenu beside it; picking a duration closes everything and the item becomes Unmute.
  await menu.getByRole("menuitem", { name: "Mute community" }).hover();
  const sub = page.getByRole("menu", { name: "Mute community" });
  await expect(sub).toBeVisible();
  await sub.getByRole("menuitem", { name: "For 1 hour" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await icon.click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Menu Lab" }).getByRole("menuitem", { name: /^Unmute community/ })).toBeVisible();
  await page.keyboard.press("Escape");
  // Every device agrees: the community's preferences document has the mute.
  await expect.poll(async () => (await alice.req("GET", `/v1/me/preferences/${org.id}`)).prefs.community?.mutedUntil ?? 0).toBeGreaterThan(Date.now());

  // Builder mode (Settings › Advanced) adds Copy community ID.
  await page.goto("/settings/advanced");
  await page.getByRole("switch", { name: "Builder mode" }).click();
  await page.goto("/home");
  await page
    .getByRole("button", { name: /^Menu Lab/ })
    .first()
    .click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Menu Lab" }).getByRole("menuitem", { name: "Copy community ID" })).toBeVisible();
});

test("the rail's Create button and Home have Meldiq's menus; empty space shows none", async ({ page }) => {
  const alice = await newPhone("s1rail", "Alice Rahman");
  await alice.connect();
  await link(page, alice);
  await page.goto("/dms");
  await page
    .getByRole("button", { name: /Create a community|Start a community|Create/ })
    .first()
    .click({ button: "right" });
  const create = page.getByRole("menu");
  await expect(create.getByRole("menuitem", { name: "Join with a code" })).toBeVisible();
  await page.keyboard.press("Escape");
  // Right-clicking the rail's empty space: the page cancels the browser's menu (and shows none of its own).
  const prevented = await page.evaluate(() => {
    const rail = document.querySelector(".rail") as HTMLElement;
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: window.innerHeight - 10 });
    rail.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("the user panel: microphone and headphones say how the next call starts, and name styles show in the member list", async ({ page }) => {
  const alice = await newPhone("s1style", "Alice Rahman");
  const bob = await newPhone("s1bob", "Bob Chen");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Style Lab" })).org;
  await alice.req("PATCH", `/v1/orgs/${org.id}`, { tag: "sl", accent: "#22c55e" });
  const code = (await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 5 })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  await bob.req("PUT", "/v1/users/me/profile-style", { nameFont: "pixel", nameColors: ["#ff00aa", "#22d3ee"], nameEffect: "glow", tagOrgId: org.id });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "lobby", scope: "ORG", kind: "PUBLIC" })).channel.id;
  await bob.req("POST", `/v1/conversations/${channel}/join`).catch(() => undefined);
  await alice.connect();
  await link(page, alice);

  const panel = page.locator(".user-panel:visible");
  await expect(panel.getByRole("button", { name: "Mute" })).toBeVisible();
  await panel.getByRole("button", { name: "Deafen" }).click();
  await expect(panel.getByRole("button", { name: "Undeafen" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("button", { name: "Unmute" })).toBeVisible();
  await panel.getByRole("button", { name: "Undeafen" }).click();
  await expect(panel.getByRole("button", { name: "Mute" })).toBeVisible();
  await panel.getByRole("button", { name: "Input device" }).click();
  await expect(page.getByRole("menu", { name: "Input device" }).getByRole("menuitemradio", { name: "System default" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await page.goto(`/home/c/${channel}`);
  const row = page.locator(".member-row").filter({ hasText: "Bob Chen" });
  await expect(row).toBeVisible();
  await expect(row.locator(".sname.nf-pixel.grad.ne-glow")).toHaveText("Bob Chen");
  await expect(row.locator(".wtag")).toContainText("SL");
});

test("the invitation page shows the community's own icon and the Android app's Play Store link", async ({ page, browser }) => {
  const alice = await newPhone("s1inv", "Alice Rahman");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Icon Lab" })).org;
  await alice.req("PUT", `/v1/orgs/${org.id}/photo`, undefined, JPEG);
  const code = (await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 5 })).invite.code;
  void page;
  const fresh = await browser.newContext();
  const p = await fresh.newPage();
  await p.goto(`/invite/${code}`);
  await expect(p.getByRole("heading", { name: "Icon Lab" })).toBeVisible();
  await expect(p.locator("#icon.photo img")).toHaveAttribute("src", new RegExp(`/v1/invites/${code}/photo$`));
  await expect(p.getByRole("link", { name: /Get Meldiq for Android/ })).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=com.meldiq.android");
  // On a computer "Open in the Meldiq app" can't work, so it isn't offered.
  await expect(p.getByRole("link", { name: "Open in the Meldiq app" })).toBeHidden();
  await fresh.close();
});
