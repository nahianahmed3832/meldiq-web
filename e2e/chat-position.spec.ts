import { expect, type Locator, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Brief v4 §15: a conversation opens at its newest message (first time, after a reload, coming back to it); a reader
 * looking at older messages keeps their place when something new arrives and gets a button to the newest; the DM list
 * is newest first and follows new messages; a community's categories never show in one order and then another.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const distanceFromBottom = (l: Locator) => l.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

async function expectAtNewest(page: Page, text: string): Promise<void> {
  const list = page.getByRole("log", { name: "Messages" });
  await expect(list.getByText(text)).toBeVisible();
  await expect.poll(() => distanceFromBottom(list)).toBeLessThan(40);
}

test("a conversation opens at its newest message and keeps a reader's place", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const carol = await newPhone("carol", "Carol Diaz");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  const other = (await alice.req("POST", "/v1/conversations/dm", { userId: carol.userId })).conversation.id;
  await alice.connect();
  // Linked first: messages are encrypted for the devices the account has when they're sent.
  await link(page, alice);
  for (let i = 1; i <= 90; i++) await bob.send(dm, { type: "text", text: `Line ${i} ${"of a long history ".repeat(1 + (i % 4))}` });
  await carol.send(other, { type: "text", text: "Carol was here first" });

  const sidebar = page.getByRole("complementary", { name: "Conversations" });
  await page.goto("/dms");
  // Newest activity first: Carol wrote last.
  const rows = sidebar.locator("a").filter({ hasText: /Bob Chen|Carol Diaz/ });
  await expect(rows.first()).toContainText("Carol Diaz");

  await sidebar.getByText("Bob Chen").first().click();
  await expectAtNewest(page, "Line 90 ");

  // After a reload, and after going elsewhere and coming back.
  await page.reload();
  await expectAtNewest(page, "Line 90 ");
  await sidebar.getByText("Carol Diaz").first().click();
  await expect(page.getByRole("log", { name: "Messages" }).getByText("Carol was here first")).toBeVisible();
  await sidebar.getByText("Bob Chen").first().click();
  await expectAtNewest(page, "Line 90 ");

  // At the bottom, a new message keeps the newest in view.
  await bob.send(dm, { type: "text", text: "Fresh at the bottom" });
  await expectAtNewest(page, "Fresh at the bottom");
  // Bob is now the most recent conversation.
  await expect(rows.first()).toContainText("Bob Chen");

  // Reading older messages: a new one doesn't move the reader; a button takes them to it.
  const list = page.getByRole("log", { name: "Messages" });
  await list.evaluate((el) => (el.scrollTop = 300));
  await page.waitForTimeout(200);
  const before = await list.evaluate((el) => el.scrollTop);
  await bob.send(dm, { type: "text", text: "While you were reading" });
  const jump = page.getByRole("button", { name: /1 new message/ });
  await expect(jump).toBeVisible();
  expect(Math.abs((await list.evaluate((el) => el.scrollTop)) - before)).toBeLessThan(40);
  await jump.click();
  await expectAtNewest(page, "While you were reading");
});

test("a community's categories show in their saved order from the first paint", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Order Lab" })).org.id;
  // Made in this order; alphabetical would be Archive, Projects, Welcome.
  for (const name of ["Welcome", "Projects", "Archive"]) {
    const categoryId = (await alice.req("POST", `/v1/orgs/${org}/categories`, { name })).category?.id ?? null;
    await alice.req("POST", `/v1/orgs/${org}/channels`, { name: `${name.toLowerCase()}-room`, scope: "ORG", kind: "PUBLIC", categoryId });
  }
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");
  const rail = page.getByRole("navigation", { name: "Home, communities, create and discover" });
  await rail.getByRole("button", { name: /^Order Lab/ }).click();
  await expect(page.getByRole("complementary", { name: "Conversations" })).toContainText("archive-room");

  // Record every order the category headings take while the page loads again.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __orders: string[] }).__orders = seen;
    const record = () => {
      const titles = Array.from(document.querySelectorAll(".side-scroll section.side-section")).map((e) => (e.getAttribute("aria-label") ?? "").trim().toLowerCase());
      const wanted = titles.filter((t) => ["welcome", "projects", "archive"].includes(t)).join(",");
      if (wanted && seen[seen.length - 1] !== wanted) seen.push(wanted);
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Conversations" })).toContainText("archive-room");
  await page.waitForTimeout(1500);
  const orders = await page.evaluate(() => (window as unknown as { __orders: string[] }).__orders);
  expect(orders.length).toBeGreaterThan(0);
  expect(new Set(orders)).toEqual(new Set(["welcome,projects,archive"]));
});
