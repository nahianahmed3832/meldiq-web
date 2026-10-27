import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * Continuation brief v3: the composer's picker in the order Emoji → GIFs → Stickers (GIFs saying plainly when no
 * provider is set up), Meldiq's own right-click menu on messages (the browser's stays on the message box), invitation
 * links that open in a fresh browser, and a message link opened in a new tab.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");

test("the composer's picker: Emoji, GIFs, Stickers in that order; a sticker sends; GIFs say when they aren't set up", async ({ page }) => {
  const alice = await newPhone("xpalice", "Alice Rahman");
  const bob = await newPhone("xpbob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  const composer = page.getByRole("textbox", { name: /Message/ });
  await expect(composer).toBeVisible();

  const order = await page.locator(".composer-wrap button[aria-haspopup='dialog']").evaluateAll((els) => els.map((e) => e.getAttribute("title")));
  expect(order).toEqual(["Emoji", "GIFs", "Stickers"]);

  await page.getByRole("button", { name: "GIFs" }).click();
  const picker = page.getByRole("dialog", { name: "Emoji, GIFs and stickers" });
  await expect(picker.getByRole("tab", { name: "GIFs" })).toHaveAttribute("aria-selected", "true");
  await expect(picker).toContainText("GIFs aren't set up on this server yet");
  await expect(picker.getByRole("tab")).toHaveText(["Emoji", "GIFs", "Stickers"]);

  await picker.getByRole("tab", { name: "Stickers" }).click();
  await picker
    .getByRole("button", { name: /^Send sticker:/ })
    .first()
    .click();
  await expect(picker).toHaveCount(0);
  await expect.poll(() => bob.received.some((m) => !!(m.payload as { sticker?: unknown }).sticker), { timeout: 10_000 }).toBe(true);

  // Emoji go in where the caret is, and the draft stays.
  await composer.fill("hello world");
  await composer.press("Home");
  for (let i = 0; i < 5; i++) await composer.press("ArrowRight");
  await page.getByRole("button", { name: "Insert emoji" }).click();
  await page.getByRole("searchbox", { name: "Search emoji" }).fill("grinning face");
  await page.getByRole("menuitem", { name: "grinning face", exact: true }).click();
  await expect(composer).toHaveValue("hello😀 world");
});

test("right-click on a message opens Meldiq's menu at the pointer; the message box keeps the browser's", async ({ page }) => {
  const alice = await newPhone("cmalice", "Alice Rahman");
  const bob = await newPhone("cmbob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await bob.send(dm, { type: "text", text: "right click me" });
  const message = page.getByRole("article").filter({ hasText: "right click me" });
  await expect(message).toBeVisible();
  const box = (await message.boundingBox())!;
  await page.mouse.click(box.x + 200, box.y + box.height / 2, { button: "right" });
  const menu = page.getByRole("menu", { name: "Message" });
  await expect(menu).toBeVisible();
  const at = (await menu.boundingBox())!;
  expect(Math.abs(at.x - (box.x + 200))).toBeLessThan(260);
  await expect(menu.getByRole("menuitem", { name: /Reply/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  // The message box: no Meldiq menu (the browser's own, for paste and spelling).
  await page.getByRole("textbox", { name: /Message/ }).click({ button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  // The keyboard: Shift+F10 on the message opens it too.
  await message.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: "Message" })).toBeVisible();
});

test("an invitation link from Invite friends opens in a fresh browser, and a message link opens its conversation", async ({ page, browser }) => {
  const alice = await newPhone("ilalice", "Alice Rahman");
  const bob = await newPhone("ilbob", "Bob Chen");
  await alice.req("POST", "/v1/orgs", { name: "Link Lab" });
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await link(page, alice);
  await page.goto("/dms");
  // The Invite friends card on Home and messages names the community it invites to.
  await page.getByRole("button", { name: "Invite friends to Link Lab" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite friends to Link Lab" });
  await dialog.getByRole("button", { name: "Create link" }).click();
  const field = dialog.getByLabel("Invitation link", { exact: true });
  await expect(field).toHaveValue(/\/invite\//);
  const url = await field.inputValue();
  expect(url).toMatch(new RegExp(`^${test.info().project.use.baseURL}/invite/[A-Z0-9-]+$`));

  // A fresh browser, never signed in: the link loads and names the community.
  const fresh = await browser.newContext();
  const p2 = await fresh.newPage();
  await p2.goto(url);
  await expect(p2.getByRole("heading", { name: "Link Lab" })).toBeVisible();
  await expect(p2.getByRole("link", { name: "Join in Meldiq Web" })).toHaveAttribute("href", /^\/join\//);
  await fresh.close();

  // A message link loaded directly opens that conversation at the message.
  await bob.connect();
  const sent = await bob.send(dm, { type: "text", text: "link to me" }, "message", "m-link-1");
  void sent;
  await page.goto(`/m/${dm}/m-link-1`);
  await expect(page).toHaveURL(new RegExp(`/dms/c/${dm}`));
  await expect(page.getByRole("log", { name: "Messages" }).getByText("link to me")).toBeVisible();
});

test("a 60 MB file encrypts and uploads without freezing the page, shown above the message box until it's sent", async ({ page }) => {
  test.setTimeout(180_000);
  const alice = await newPhone("bigalice", "Alice Rahman");
  const bob = await newPhone("bigbob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await expect(page.getByRole("textbox", { name: /Message/ })).toBeVisible();
  // Watch the page's main thread: every task over 50 ms is recorded (PerformanceObserver "longtask").
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ type: "longtask", buffered: false });
  });
  const size = 60 * 1024 * 1024;
  const started = Date.now();
  const file = path.join(os.tmpdir(), `meldiq-big-${Date.now()}.bin`);
  fs.writeFileSync(file, Buffer.alloc(size, 7));
  await page.locator('.composer-wrap input[type="file"]').setInputFiles(file);
  await page.getByRole("button", { name: /Send/ }).click();
  await expect(page.getByRole("list", { name: "Files being sent" })).toBeVisible();
  await expect.poll(() => bob.received.some((m) => (m.payload as { attachments?: { size: number }[] }).attachments?.[0]?.size === size), { timeout: 150_000 }).toBe(true);
  const seconds = (Date.now() - started) / 1000;
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  const worst = long.length ? Math.max(...long) : 0;
  test.info().annotations.push({ type: "measurement", description: `60 MB: sent in ${seconds.toFixed(1)} s; ${long.length} long tasks, longest ${worst.toFixed(0)} ms` });
  expect(worst).toBeLessThan(500);
});
