import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Profile photos in the chat: someone who set one shows it beside their messages, in the conversation's header and
 * start, not only in the conversation list. Photos need the session, so the page loads them through the API.
 */
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for where photos show");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** There's a picture, and every one has really loaded. */
const loaded = (els: Element[]) => els.length > 0 && els.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0);

test("a person's profile photo shows beside their messages and in the conversation, not only in the list", async ({ page, isMobile }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const jpeg = fs.readFileSync(path.join(import.meta.dirname, "../public/launch/meldiq-launch.jpg"));
  await bob.req("PUT", "/v1/users/me/photo", undefined, jpeg);
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();

  await link(page, alice);
  await bob.send(dm, { type: "text", text: "Here's my new photo" });
  await page.goto(`/dms/c/${dm}`);
  await expect(page.locator(".msg").getByText("Here's my new photo")).toBeVisible();

  for (const [where, selector] of [
    ["beside the message", ".msg .avatar-photo"],
    ["in the header", ".conv-head .avatar-photo"],
    ["at the conversation's start", ".conv-start .avatar-photo"],
    ["in the conversation list", ".side-item .avatar-photo"],
  ] as const) {
    await expect.poll(() => page.locator(selector).evaluateAll(loaded), { message: `Bob's photo ${where}`, timeout: 10_000 }).toBe(true);
  }

  // Home's recent direct messages (reported 2026-10-23: initials only); phones show the conversation list there instead.
  if (isMobile) return;
  await page.goto("/dms");
  await expect(page.getByRole("heading", { name: "Recent direct messages" })).toBeVisible();
  await expect.poll(() => page.locator("section.main .list-row .avatar-photo").evaluateAll(loaded), { message: "Bob's photo on Home", timeout: 10_000 }).toBe(true);
});
