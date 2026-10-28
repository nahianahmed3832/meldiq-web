import { expect, test } from "@playwright/test";
import { expectSignedOut, link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * The owner, 2026-10-28: "no data will be in browser, all data must store in server". Since API 0.57.0 the server keeps
 * every message (docs/SERVER_MESSAGES.md), so signing out and in again brings the chats back with nothing kept or
 * backed up by the browser, and there's no backup to manage.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("chats come back from the server after signing out and in again", async ({ page }) => {
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

  // The server holds both.
  await expect.poll(async () => ((await alice.req("GET", `/v2/conversations/${dm}/messages`)) as { messages: unknown[] }).messages.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);

  // The browser keeps none of it: its database's old message stores stay empty (only the sign-in is on disk).
  const kept = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("orbit-web");
        req.onerror = () => resolve(-1);
        req.onsuccess = () => {
          const db = req.result;
          const stores = ["messages", "conversations", "outbox"].filter((n) => db.objectStoreNames.contains(n));
          if (!stores.length) return resolve(0);
          const tx = db.transaction(stores);
          let total = 0;
          let left = stores.length;
          for (const name of stores) {
            const count = tx.objectStore(name).count();
            count.onsuccess = () => {
              total += count.result;
              if (--left === 0) {
                db.close();
                resolve(total);
              }
            };
          }
        };
      }),
  );
  expect(kept).toBe(0);

  // No backup settings any more.
  await page.goto("/settings/security");
  await expect(page.getByText(/backed up/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign out of this browser?" });
  await expect(dialog).toContainText("all there when you sign in again");
  await dialog.getByRole("button", { name: "Sign out" }).click();
  await expectSignedOut(page);

  // Signed in again (a new device of the account): the chats are back, from the server.
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await expect(page.locator(".msg-text", { hasText: "Typed in the browser, kept for good" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".msg-text", { hasText: "Bob's answer, kept too" })).toBeVisible();
  await bob.disconnect();
});
