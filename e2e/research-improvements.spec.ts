import { expect, type Locator, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// Routing the held history request must reach Playwright rather than a service-worker fetch handler.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});
const listOf = (page: import("@playwright/test").Page) => page.getByRole("log", { name: "Messages" });
const bottomGap = (list: Locator) => list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
const visibleAnchor = (list: Locator) =>
  list.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const node = Array.from(el.querySelectorAll<HTMLElement>("[id^='msg-']")).find((m) => m.getBoundingClientRect().bottom > top)!;
    return { id: node.id, offset: node.getBoundingClientRect().top - top };
  });
async function expectAnchor(list: Locator, anchor: { id: string; offset: number }) {
  await expect
    .poll(() =>
      list.evaluate((el, saved) => {
        const node = Array.from(el.querySelectorAll<HTMLElement>("[id^='msg-']")).find((m) => m.id === saved.id);
        return node ? Math.abs(node.getBoundingClientRect().top - el.getBoundingClientRect().top - saved.offset) : 9999;
      }, anchor),
    )
    .toBeLessThanOrEqual(2);
}

test("opening always shows latest; active reading survives pagination, arrivals and late layout changes", async ({ page }) => {
  const alice = await newPhone("anchor", "Alice Anchor");
  const bob = await newPhone("reader", "Bob Reader");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  for (let i = 1; i <= 130; i++) await bob.send(dm, { type: "text", text: `Reading line ${i}: ${"A useful line of history. ".repeat(2 + (i % 3))}` });
  await page.goto(`/dms/c/${dm}`);
  const list = listOf(page);
  await expect(list.getByText("Reading line 130:", { exact: false })).toBeAttached();
  await expect(list).toHaveAttribute("aria-busy", "false");
  const latest = page.getByRole("button", { name: "Jump to latest", exact: true });
  if (await latest.isVisible()) await latest.click();
  await expect.poll(() => bottomGap(list)).toBeLessThan(40);

  // A control is available even before another message arrives.
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight - el.clientHeight - 350;
  });
  await expect(page.getByRole("button", { name: "Jump to latest", exact: true })).toBeVisible();
  await page.goto("/home");
  await page.goto(`/dms/c/${dm}`);
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect.poll(() => bottomGap(list)).toBeLessThan(2);
  await page.reload();
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect.poll(() => bottomGap(list)).toBeLessThan(2);

  // Hold the prepend until an incoming message has rendered, exercising both changes in the same reading window.
  let release!: () => void;
  let requested = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(/\/v2\/conversations\/[^/]+\/messages\?.*before=/, async (route) => {
    requested = true;
    await held;
    await route.continue();
  });
  await list.evaluate((el) => {
    el.scrollTop = 60;
  });
  const beforePrepend = await visibleAnchor(list);
  await expect.poll(() => requested).toBe(true);
  await bob.send(dm, { type: "text", text: "Arrived while reading older messages" });
  await expect(page.getByRole("button", { name: /1 new message/ })).toBeVisible();
  release();
  await expect(list.getByText("Reading line 11:", { exact: false })).toBeAttached();
  await expectAnchor(list, beforePrepend);

  // A message synced from another device of this account must also respect the active reader.
  await alice.send(dm, { type: "text", text: "Sent from my other device while reading" });
  await expect(list.getByText("Sent from my other device while reading")).toBeAttached();
  await expectAnchor(list, beforePrepend);

  // Media and fonts can expand a preceding message after the page has settled.
  await list.evaluate((el) => {
    const first = el.querySelector<HTMLElement>("[id^='msg-']")!;
    first.style.paddingBottom = "180px";
  });
  await expectAnchor(list, beforePrepend);
  // Older Safari has no scrollend event: finishing the smooth jump must still restore media following.
  await page.evaluate(() => window.addEventListener("scrollend", (event) => event.stopImmediatePropagation(), true));
  await page.getByRole("button", { name: /1 new message/ }).click();
  await list.evaluate((el) => {
    el.querySelector<HTMLElement>("[id^='msg-']")!.style.paddingBottom = "300px";
  });
  await expect.poll(() => bottomGap(list)).toBeLessThan(2);
  await list.evaluate((el) => {
    el.querySelector<HTMLElement>("[id^='msg-']")!.style.paddingBottom = "360px";
  });
  await expect.poll(() => bottomGap(list)).toBeLessThan(2);
  await expect(list.getByText("Arrived while reading older messages")).toBeVisible();
});

test("a distant search result stays separate from recent history and can return to latest", async ({ page, isMobile }) => {
  test.skip(isMobile, "The side search panel replaces the conversation at phone width.");
  const alice = await newPhone("search", "Alice Search");
  const bob = await newPhone("searchpeer", "Bob Search");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  for (let i = 1; i <= 150; i++) await bob.send(dm, { type: "text", text: i === 5 ? "Historic needle target" : `Search history line ${i}` });
  await page.goto(`/dms/c/${dm}/search`);
  await page.getByRole("textbox", { name: "Search in this conversation" }).fill("Historic needle");
  await page.getByRole("list", { name: "1 results" }).getByRole("button").click();
  const list = listOf(page);
  await expect(list.getByText("Historic needle target")).toBeVisible();
  await expect(list.getByText("Search history line 150", { exact: true })).toHaveCount(0);
  await bob.send(dm, { type: "text", text: "Newest after the search" });
  await expect(list.getByText("Newest after the search")).toHaveCount(0);
  await page.getByRole("button", { name: "Jump to latest", exact: true }).click();
  await expect(list.getByText("Newest after the search")).toBeVisible();
  await expect(list.getByText("Historic needle target")).toHaveCount(0);
  await expect.poll(() => bottomGap(list)).toBeLessThan(2);
});

test("settings search opens canonical pages, shows scope and handles no matches", async ({ page, isMobile }) => {
  const alice = await newPhone("settings", "Alice Settings");
  await link(page, alice);
  await page.goto(isMobile ? "/settings/you" : "/settings/profile");
  const search = page.getByRole("searchbox", { name: "Search settings" });
  await search.fill("microphone");
  const nav = page.getByRole("navigation", { name: "Settings pages" });
  await expect(nav.getByRole("group")).toHaveCount(1);
  await nav.getByRole("button", { name: /Microphone, speakers and voice controls/ }).click();
  await expect(page.locator(".settings-scope")).toContainText("This browser");
  if (isMobile) await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  await search.fill("something-with-no-matches");
  await expect(page.getByRole("status")).toContainText("No settings found");
  await page.getByRole("button", { name: "Clear settings search" }).click();
  await expect(nav.getByRole("button", { name: "My Profile", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "My Profile", exact: true }).click();
  const displayName = page.getByRole("textbox", { name: "Display name", exact: true });
  await expect(displayName).toHaveValue("Alice Settings");
  await displayName.fill("Unsaved profile preview");
  await page.getByRole("button", { name: "Reset unsaved changes" }).click();
  await expect(displayName).toHaveValue("Alice Settings");
});

test("the expression picker finds joined-community emoji and previews uploads without losing animation", async ({ page }) => {
  const alice = await newPhone("expressions", "Alice Expressions");
  const bob = await newPhone("expressionpeer", "Bob Expressions");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Expression Lab" })).org.id;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await alice.req("POST", `/v1/orgs/${org}/expressions?kind=emoji&name=party_parrot`, undefined, png);
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await page.getByRole("button", { name: "Insert emoji" }).click();
  const picker = page.getByRole("dialog", { name: "Emoji, GIFs and stickers" });
  await picker.getByRole("combobox", { name: "Expression community" }).selectOption(org);
  await picker.getByRole("searchbox", { name: "Search community expressions" }).fill("party parrot");
  await expect(picker.getByRole("button", { name: ":party_parrot:", exact: true })).toBeVisible();

  await expect(picker.getByRole("button", { name: "Upload an emoji", exact: true })).toBeVisible();
  const oversized = Buffer.alloc(256 * 1024 + 1);
  oversized.write("GIF89a");
  await picker.locator("input[type=file]").setInputFiles({ name: "animated.gif", mimeType: "image/gif", buffer: oversized });
  const upload = page.getByRole("dialog", { name: "Upload an emoji", exact: true });
  await expect(upload.getByText(/keep its animation/)).toBeVisible();
  await expect(upload.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await upload.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(picker).toBeVisible();
  await picker.locator("input[type=file]").setInputFiles({ name: "tiny_preview.png", mimeType: "image/png", buffer: png });
  await expect(upload.getByRole("img", { name: "Upload preview" })).toBeVisible();
  await expect(upload.getByText(/Original image kept/)).toBeVisible();
  await expect(upload.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await upload.getByRole("button", { name: "Save", exact: true }).click();
  await expect(upload).toHaveCount(0);
  await picker.getByRole("searchbox", { name: "Search community expressions" }).fill("tiny preview");
  await expect(picker.getByRole("button", { name: ":tiny_preview:", exact: true })).toBeVisible();
  await picker.getByRole("button", { name: ":tiny_preview:", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message Bob Expressions" })).toHaveValue(":tiny_preview: ");
});

test("opening unread history starts at latest and acknowledges only the visible fresh window", async ({ page }) => {
  const alice = await newPhone("unread", "Alice Unread");
  const bob = await newPhone("unreadpeer", "Bob Unread");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  for (let n = 1; n <= 70; n++) await bob.send(dm, { type: "text", text: `Unread line ${n}: ${"Unread content. ".repeat(12)}` });
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  const list = listOf(page);
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list.getByRole("separator", { name: "New messages" })).toBeAttached();
  await expect.poll(() => bottomGap(list)).toBeLessThan(2);
  await expect(list.getByText(/^Unread line 70:/)).toBeVisible();
  await expect
    .poll(async () => {
      const summaries = await alice.req("GET", "/v2/messages/summary");
      return summaries.conversations.find((c: { conversationId: string }) => c.conversationId === dm)?.unread;
    })
    .toBe(0);
});
