import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * The Meldling round (community-first brief v2): Meldling as the brand, its typing indicator, the Discover page, Invite
 * people with a link, Import from Discord saying when it isn't set up, and a channel read in one browser clearing in the
 * person's other browser (an encrypted, self-only control).
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");

const typing = (phone: object, conversationId: string, on: boolean) => (phone as { ws: { send(s: string): void } }).ws.send(JSON.stringify({ t: "typing", c: conversationId, on }));

test("Meldling is the brand mark, and typing shows Meldling once with the real names for screen readers", async ({ page }) => {
  const alice = await newPhone("mlalice", "Alice Rahman");
  const bob = await newPhone("mlbob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await expect(page.locator('link[rel="icon"][sizes="192x192"]')).toHaveAttribute("href", "/meldling-192.png");
  await expect(page.locator(".rail-mascot")).toHaveAttribute("src", "/meldling-96.webp");

  await page.goto(`/dms/c/${dm}`);
  await bob.send(dm, { type: "text", text: "hello" });
  await expect(page.getByRole("log", { name: "Messages" }).getByText("hello", { exact: true })).toBeVisible();
  typing(bob, dm, true);
  const indicator = page.locator(".typing-meldling");
  await expect(indicator).toBeVisible();
  await expect(indicator).toContainText("Meldling");
  await expect(indicator.locator(".sr-only")).toHaveText("Bob Chen is typing");
  typing(bob, dm, false);
  await expect(indicator).toHaveCount(0, { timeout: 10_000 });
});

test("Discover is a page: search, cards from the server, and Join", async ({ page }) => {
  const alice = await newPhone("dsalice", "Alice Rahman");
  const bob = await newPhone("dsbob", "Bob Chen");
  const tag = Math.random().toString(36).slice(2, 8);
  await bob.req("POST", "/v1/orgs", { name: `Pixel Makers ${tag}`, description: "We draw tiny things", visibility: "public", joinPolicy: "open" });
  await alice.connect();
  await link(page, alice);
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Find your people" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search communities" }).fill(tag);
  const card = page.getByRole("article", { name: `Pixel Makers ${tag}` });
  await expect(card).toContainText("We draw tiny things");
  await expect(card).toContainText("1 member");
  await expect(page.getByText("Promoted")).toHaveCount(0);
  await card.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("navigation", { name: "Home, communities, create and discover" }).getByRole("button", { name: new RegExp(`^Pixel Makers ${tag}`) })).toBeVisible();
});

test("Invite people makes a link with an expiry and a use limit", async ({ page }) => {
  const alice = await newPhone("ivalice", "Alice Rahman");
  await alice.req("POST", "/v1/orgs", { name: "Invite Lab" });
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");
  await page
    .getByRole("navigation", { name: "Home, communities, create and discover" })
    .getByRole("button", { name: /^Invite Lab/ })
    .click();
  await page.getByRole("button", { name: "Community: Invite Lab. Community menu" }).click();
  await page.getByRole("menuitem", { name: "Invite people" }).click();
  const dialog = page.getByRole("dialog", { name: "Invite people to Invite Lab" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Expires after").selectOption({ label: "1 day" });
  await dialog.getByLabel("Max uses").selectOption({ label: "50 people" });
  await dialog.getByRole("button", { name: "Create invite link" }).click();
  await expect(dialog.getByLabel("Invitation link", { exact: true })).toHaveValue(/invite\/[A-Z0-9-]+|join\/[A-Z0-9-]+/);
  await expect(dialog).toContainText("up to 50 people");
  await expect(dialog.getByRole("button", { name: "Copy link" })).toBeVisible();
});

test("Import from Discord says plainly when this server has no Discord application", async ({ page }) => {
  const alice = await newPhone("dialice", "Alice Rahman");
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");
  await page.getByRole("navigation", { name: "Home, communities, create and discover" }).getByRole("button", { name: "Create a community" }).click();
  await page.getByRole("tab", { name: "Import from Discord" }).click();
  const dialog = page.getByRole("dialog", { name: "Import from Discord" });
  await expect(dialog).toContainText("isn't set up on this server yet");
  await expect(dialog).toContainText("Messages and history");
  await expect(dialog.getByRole("button", { name: "Connect Discord" })).toHaveCount(0);
});

test("a channel read in one browser clears in the person's other browser", async ({ page, browser }) => {
  const alice = await newPhone("rsalice", "Alice Rahman");
  const bob = await newPhone("rsbob", "Bob Chen");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Read Sync" })).org.id;
  const code = (await alice.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  const ch = (await alice.req("POST", `/v1/orgs/${org}/channels`, { name: "lobby", scope: "ORG", kind: "PRIVATE", memberIds: [bob.userId] })).channel.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const second = await other.newPage();
  await link(second, alice);
  for (const p of [page, second]) await p.goto("/home");

  await bob.send(ch, { type: "text", text: "anyone here?" });
  const row = (p: typeof page) => p.getByRole("complementary", { name: "Conversations" }).getByRole("link", { name: /lobby/ });
  for (const p of [page, second]) await expect(row(p)).toHaveClass(/unread/);
  await row(page).click();
  await expect(page.getByText("anyone here?", { exact: true })).toBeVisible();
  await expect(row(second)).not.toHaveClass(/unread/, { timeout: 15_000 });
  await other.close();
});
