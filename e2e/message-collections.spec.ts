import crypto from "node:crypto";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// WebKit bypasses Playwright route interception for requests controlled by a service worker.
// These tests inject a temporary API outage; offline worker behavior has its own suites.
test.use({ serviceWorkers: "block" });

async function go(page: Page, href: string) {
  await page.evaluate((href) => {
    const link = document.createElement("a");
    link.href = href;
    document.body.append(link);
    link.click();
    link.remove();
  }, href);
  await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
}

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a busy thread cannot displace the main conversation timeline", async ({ page }) => {
  const alice = await newPhone("main", "Main Alice");
  const bob = await newPhone("mainpeer", "Main Bob");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const root = crypto.randomUUID();
  await alice.req("POST", "/v2/messages", { conversationId: dm, messageId: root, cls: "message", sentAt: Date.now(), payload: { type: "text", text: "Main timeline stays available" } });
  for (let i = 0; i < 125; i++)
    await bob.req("POST", "/v2/messages", {
      conversationId: dm,
      messageId: crypto.randomUUID(),
      cls: "message",
      sentAt: Date.now(),
      payload: { type: "text", text: `Thread traffic ${i}`, threadRoot: root },
    });
  await link(page, alice);
  await go(page, `/dms/c/${dm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Main timeline stays available");
  await expect(page.getByRole("button", { name: "125 replies", exact: true })).toBeVisible();
  await expect(page.getByRole("log", { name: "Messages" })).not.toContainText("Thread traffic");
});

test("media and files remain accessible after their messages leave the active history window", async ({ page }, info) => {
  test.setTimeout(150_000);
  const alice = await newPhone("files", "Files Alice");
  const bob = await newPhone("filespeer", "Files Bob");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await link(page, alice);
  await go(page, `/dms/c/${dm}`);
  const input = page.locator(".composer input[type=file]");
  await input.setInputFiles({ name: "collection-receipt.txt", mimeType: "text/plain", buffer: Buffer.from("A real collection download") });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("collection-receipt.txt");
  await input.setInputFiles(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: /Open image/ })).toBeVisible();
  for (let i = 0; i < 110; i++)
    await bob.req("POST", "/v2/messages", { conversationId: dm, messageId: crypto.randomUUID(), cls: "message", sentAt: Date.now(), payload: { type: "text", text: `Newer message ${i}` } });
  await page.reload();
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Newer message 109");
  await expect(page.getByRole("log", { name: "Messages" })).not.toContainText("collection-receipt.txt");
  await go(page, `/dms/c/${dm}/details`);
  const details = page.getByRole("complementary", { name: "Details", exact: true });
  await details.getByRole("tab", { name: /^Files/ }).click();
  await expect(details.getByRole("tabpanel", { name: "Files", exact: true })).toContainText("collection-receipt.txt");
  const downloading = page.waitForEvent("download");
  await details.getByRole("button", { name: /^Download collection-receipt.txt/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("collection-receipt.txt");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe("A real collection download");
  await details.getByRole("tab", { name: /^Media/ }).click();
  await expect(details.locator(".gallery-cell")).toHaveCount(1);
  await details.getByRole("button", { name: /Open image/ }).click();
  await expect(page.locator(".lightbox img")).toBeVisible();
  await page.screenshot({ path: info.outputPath("older-media.png"), fullPage: true });
});

test("pins and threads page beyond loaded history, preserve counts, and recover from errors", async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const alice = await newPhone("collections", "Collection Alice");
  const bob = await newPhone("collectionpeer", "Collection Bob");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const send = async (payload: unknown, cls = "message") => {
    const messageId = crypto.randomUUID();
    await alice.req("POST", "/v2/messages", { conversationId: dm, messageId, cls, sentAt: Date.now(), payload });
    return messageId;
  };
  const roots: string[] = [];
  for (let i = 0; i < 53; i++) {
    const root = await send({ type: "text", text: `Archived topic ${String(i).padStart(2, "0")}` });
    roots.push(root);
    await send({ type: "text", text: `Reply in topic ${i}`, threadRoot: root });
    await send({ type: "pin", target: root, pinned: true }, "control");
  }
  for (let i = 0; i < 70; i++) await send({ type: "text", text: `Deep reply ${i}`, threadRoot: roots[0] });
  for (let i = 0; i < 110; i++) await send({ type: "text", text: `Recent timeline ${i}` });
  await link(page, alice);
  await go(page, `/dms/c/${dm}/pinned`);
  const pins = page.getByRole("complementary", { name: "Pinned messages", exact: true });
  await expect(pins.locator(".pinned-row")).toHaveCount(50);
  await pins.getByRole("button", { name: "Next page" }).click();
  await expect(pins.locator(".pinned-row")).toHaveCount(3);
  await expect(pins).toContainText("Archived topic 00");
  await expect(pins.getByRole("button", { name: "Next page" })).toBeDisabled();
  await pins.getByRole("button", { name: "Previous page" }).click();
  await expect(pins.locator(".pinned-row")).toHaveCount(50);
  let fail = true;
  await page.route("**/message-collections?kind=pins*", async (route) => {
    if (fail) {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable", message: "Please retry the collection" }) });
    }
    return route.continue();
  });
  await pins.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(pins.getByRole("alert")).toBeVisible();
  fail = false;
  await pins.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(pins.locator(".pinned-row")).toHaveCount(50);
  await page.unroute("**/message-collections?kind=pins*");

  await go(page, `/dms/c/${dm}/threads`);
  const threads = page.getByRole("complementary", { name: "Threads", exact: true });
  await expect(threads.locator(".list-row")).toHaveCount(50);
  await expect(threads.getByRole("button", { name: /Archived topic 00/ })).toContainText("71 replies");
  await threads.getByRole("button", { name: "Next page" }).click();
  await expect(threads.locator(".list-row")).toHaveCount(3);
  await threads.getByRole("button", { name: "Previous page" }).click();
  await threads.getByRole("button", { name: /Archived topic 00/ }).click();
  const thread = page.getByRole("complementary", { name: "Thread", exact: true });
  await expect(thread.getByRole("log", { name: "Messages" })).toContainText("Deep reply 69");
  await expect(thread.getByRole("log", { name: "Messages" })).not.toContainText("Reply in topic 0");
  await thread.getByRole("button", { name: "Next page" }).click();
  await expect(thread.getByRole("log", { name: "Messages" })).toContainText("Reply in topic 0");
  await expect(thread.getByRole("log", { name: "Messages" })).not.toContainText("Deep reply 69");
  await expect(thread).toContainText("Page 2");
  await page.screenshot({ path: info.outputPath("thread-history.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
