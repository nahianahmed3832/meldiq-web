import { expect, test } from "@playwright/test";
import { expectSignedOut, link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Brief v4 §13: the old account system's "move an existing account" and safety numbers are gone from Meldiq Web;
 * signing in, encryption and the review of a changed security key are not.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("no account moving at sign-in, and no safety numbers in a conversation", async ({ page }) => {
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Having trouble signing in?" }).click();
  await expect(page.getByRole("button", { name: /I forgot my password/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Move an existing account/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to sign in" }).click();

  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await link(page, alice);
  await bob.send(dm, { type: "text", text: "hello there" });
  await page.goto(`/dms/c/${encodeURIComponent(dm)}`);
  await expect(page.getByRole("log", { name: "Messages" }).getByText("hello there")).toBeVisible();

  // The details the name opens: no safety number card, still end-to-end encryption.
  await page.getByRole("button", { name: /Bob Chen: details/ }).click();
  await expect(page.getByText("End-to-end encrypted on your devices")).toBeVisible();
  await expect(page.getByText(/Safety number/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Mark as verified/ })).toHaveCount(0);

  // The conversation menu's Encryption sheet: what protects it, nothing to compare.
  await page.locator(".conv-head").getByRole("button", { name: /^More/ }).click();
  await page.getByRole("menuitem", { name: /^Encryption/ }).click();
  await expect(page.getByRole("dialog", { name: "Security" })).toContainText("Messages are end-to-end encrypted");
  await expect(page.getByRole("dialog", { name: "Security" })).not.toContainText(/safety number/i);
});
