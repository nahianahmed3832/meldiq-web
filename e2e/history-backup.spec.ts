import { expect, test } from "@playwright/test";
import { expectSignedOut, link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * The owner, 2026-10-28: "after log out from browser … my all chat history vanished … it should be always stay whenever
 * user login". The browser backs its chats up into the account's encrypted history, so signing out and in again brings
 * them back, even when no phone backed them up (the test phones don't).
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a browser's chats come back after signing out and in again", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  const composer = page.getByLabel("Message Bob Chen");
  await composer.fill("Typed in the browser, kept for good");
  await composer.press("Enter");
  await bob.connect();
  await bob.send(dm, { type: "text", text: "Bob's answer, kept too" });
  await expect(page.locator(".msg-text", { hasText: "Bob's answer, kept too" })).toBeVisible({ timeout: 15_000 });

  // Backed up by the browser itself: the account's history holds both, end-to-end encrypted.
  await expect.poll(async () => ((await alice.req("GET", "/v1/history/summary")) as { items: number }).items, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

  await page.goto("/settings/security");
  await expect(page.getByText("All of this browser's chats are backed up")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign out of this browser?" });
  await expect(dialog).toContainText("come back when you sign in again");
  await dialog.getByRole("button", { name: "Sign out" }).click();
  await expectSignedOut(page);

  // Signed in again (a new device of the account): the chats are back.
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await expect(page.locator(".msg-text", { hasText: "Typed in the browser, kept for good" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".msg-text", { hasText: "Bob's answer, kept too" })).toBeVisible();
  await bob.disconnect();
});
