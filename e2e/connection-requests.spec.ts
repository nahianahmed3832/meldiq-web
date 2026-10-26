import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Connection requests reach the person asked (reported 2026-10-23: they were never told, and had nowhere obvious to
 * accept): a notice when one arrives, a count on DMs and Connection requests, and Accept or Decline in the DM.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium only: the rail is hidden on phones");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a connection request is announced, counted, and accepted from the DM", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id as string;
  await link(page, alice);
  await page.goto("/home");
  await expect(page.locator(".conv-head, .view, .sidebar").first()).toBeVisible();

  // Bob asks while Alice has the page open: the server's frame reaches it.
  expect((await bob.req("POST", "/v1/connections", { userId: alice.userId })).state).toBe("pending");
  await expect(page.locator(".notice")).toContainText("Bob Chen sent you a connection request");
  await expect(page.getByRole("link", { name: /^Home and messages, 1 unread/ })).toBeVisible();

  await page.getByRole("link", { name: /^Home and messages/ }).click();
  await expect(page.getByRole("button", { name: "Connection requests, 1 waiting" })).toBeVisible();

  // A reload doesn't announce it again, but still counts it.
  await page.reload();
  await expect(page.getByRole("button", { name: "Connection requests, 1 waiting" })).toBeVisible();
  await expect(page.locator(".notice")).toHaveCount(0);

  // In the DM with Bob: Accept.
  await page.goto(`/dms/c/${dm}`);
  const banner = page.locator(".conv-banners .banner").filter({ hasText: "Bob Chen wants to connect with you." });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator(".notice")).toContainText("You're connected with Bob Chen.");
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connection requests, 1 waiting" })).toHaveCount(0);
  const lists = await bob.req("GET", "/v1/connections");
  expect(lists.connected.map((u: { id: string }) => u.id)).toContain(alice.userId);
});
