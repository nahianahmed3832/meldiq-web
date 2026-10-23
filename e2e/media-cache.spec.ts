import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Photos download once per browser and only when scrolled near (reported 2026-10-23: every photo was downloaded again
 * on every visit, all at once). The ciphertext is kept in the browser's media cache and decrypted on each open.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "one engine is enough for caching and loading on scroll");
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a photo isn't downloaded again after a reload, and one far up loads only when scrolled to", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await bob.connect();
  await link(page, alice);
  const downloads: string[] = [];
  page.on("request", (r) => /\/(v1|media)\/attachments\/[^/?]+$/.test(new URL(r.url()).pathname) && r.method() === "GET" && downloads.push(r.url()));

  // Alice sends a photo from this browser.
  await page.goto(`/dms/c/${dm}`);
  await page.locator(".composer input[type=file]").setInputFiles(path.join(import.meta.dirname, "../public/launch/meldiq-launch.jpg"));
  await page.getByRole("button", { name: "Send" }).click();
  const photo = page.locator(".msg .att-image img");
  await expect(photo).toBeVisible({ timeout: 20_000 });

  // After a reload it shows again without being downloaded again.
  await expect.poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const beforeReload = downloads.length;
  await page.reload();
  await expect(photo).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const afterReload = downloads.length;
  expect(afterReload, "the photo was downloaded again after a reload").toBe(beforeReload);
  expect(await page.evaluate(async () => (await (await caches.open("meldiq-media-v1")).keys()).length)).toBeGreaterThan(0);

  // Far up the conversation (many messages below it) and not kept: nothing downloads until it's scrolled to.
  for (let i = 0; i < 40; i++) await bob.send(dm, { type: "text", text: `Message ${i}\n${"line\n".repeat(4)}` });
  await expect(page.locator(".msg").getByText("Message 39")).toBeVisible();
  await page.evaluate(async () => void (await caches.delete("meldiq-media-v1")));
  await page.reload();
  await expect(page.locator(".msg").getByText("Message 39")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(downloads.length, "a photo far above the screen was downloaded").toBe(afterReload);
  await expect(async () => {
    await page.locator(".messages").evaluate((el) => (el.scrollTop = 0));
    await expect(photo).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  expect(downloads.length, "scrolled to, the photo downloads once").toBe(afterReload + 1);
});
