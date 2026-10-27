import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Profile changes reach every device live (reported 2026-10-23: a change showed elsewhere only after a refresh). The
 * server (API 0.28) sends user.updated; the browser fetches the profile again, so privacy still applies.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "one engine is enough for live profile changes");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const loaded = (els: Element[]) => els.length > 0 && els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0);

test("a name and photo changed on a phone show in an open browser without a reload", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const info = await alice.req("GET", "/v1/server-info");
  test.skip(!/^0\.(2[89]|[3-9]\d)\./.test(info.version), `the server (${info.version}) is older than live profile changes (API 0.28)`);
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await bob.connect();
  await link(page, alice);
  await bob.send(dm, { type: "text", text: "Hello from Bob" });
  await page.goto(`/dms/c/${dm}`);
  await expect(page.locator(".msg").getByText("Hello from Bob")).toBeVisible();
  const reloads: string[] = [];
  page.on("framenavigated", (f) => f === page.mainFrame() && reloads.push(f.url()));

  // Bob renames himself and sets a photo on his phone.
  await bob.req("PATCH", "/v1/users/me", { displayName: "Bobby Chen" });
  await bob.req("PUT", "/v1/users/me/photo", undefined, fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg")));
  await expect(page.locator(".conv-head h1")).toContainText("Bobby Chen");
  await expect(page.locator(".side-item").filter({ hasText: "Bobby Chen" })).toBeVisible();
  await expect.poll(() => page.locator(".conv-head .avatar-photo").evaluateAll(loaded), { message: "Bob's new photo in the header" }).toBe(true);

  // Alice renames herself on her phone: this browser (her own device) follows, on the open profile page too.
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Display name")).toHaveValue("Alice Rahman");
  const before = reloads.length;
  await alice.req("PATCH", "/v1/users/me", { displayName: "Alice R." });
  await expect(page.getByLabel("Display name")).toHaveValue("Alice R.");
  expect(reloads.length, "the page was reloaded").toBe(before);
});
