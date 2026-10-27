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
  await expect(page.locator('link[rel="icon"][sizes="192x192"]').first()).toHaveAttribute("href", /\/favicon-(light|dark)-192\.png$/);
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
  const dialog = page.getByRole("dialog", { name: "Invite friends to Invite Lab" });
  await expect(dialog).toBeVisible();
  // The link isn't made until asked, and says how long it lasts before it is.
  await expect(dialog).toContainText("Your link will expire after 7 days");
  await dialog.getByRole("button", { name: "Change" }).click();
  await dialog.getByLabel("Expires after").selectOption({ label: "1 day" });
  await dialog.getByLabel("Max uses").selectOption({ label: "50 people" });
  await dialog.getByRole("button", { name: "Create link" }).click();
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

test("a community's accent and banner: set in Appearance, kept after a reload, shown on its channel list only", async ({ page }) => {
  const alice = await newPhone("bralice", "Alice Rahman");
  const bob = await newPhone("brbob", "Bob Chen");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Brand Lab" })).org.id;
  await alice.req("POST", "/v1/orgs", { name: "Plain Lab" });
  const code = (await alice.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");
  const rail = page.getByRole("navigation", { name: "Home, communities, create and discover" });
  await rail.getByRole("button", { name: /^Brand Lab/ }).click();
  await page.goto("/workspace/overview");

  const card = page.getByRole("region", { name: "Appearance" });
  await expect(card.getByRole("button", { name: "Meldiq's colours" })).toHaveAttribute("aria-pressed", "true");
  // A typed colour must be #rrggbb before it can be saved.
  await card.getByLabel("Accent colour as #rrggbb").fill("#12");
  await expect(card.getByRole("alert")).toContainText("six hex digits");
  await card.getByRole("button", { name: "Pink" }).click();
  await card.getByRole("button", { name: "Save appearance" }).click();
  await expect(card.getByRole("status")).toContainText("Saved");

  await page.reload();
  await page.goto("/home");
  await rail.getByRole("button", { name: /^Brand Lab/ }).click();
  const sidebar = page.getByRole("complementary", { name: "Conversations" });
  await expect(sidebar).toHaveClass(/c-accent/);
  expect(await sidebar.evaluate((e) => getComputedStyle(e).getPropertyValue("--c-accent").trim())).toBe("#ec4899");
  // Another community keeps Meldiq's colours.
  await rail.getByRole("button", { name: /^Plain Lab/ }).click();
  await expect(sidebar).not.toHaveClass(/c-accent/);
  expect((await alice.req("GET", "/v1/orgs")).orgs.find((o: { id: string }) => o.id === org).accent).toBe("#ec4899");
});

test("members who can't edit a community see its appearance without the controls", async ({ page }) => {
  const alice = await newPhone("bmalice", "Alice Rahman");
  const bob = await newPhone("bmbob", "Bob Chen");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Look Lab" })).org.id;
  await alice.req("PATCH", `/v1/orgs/${org}`, { accent: "#22c55e" });
  const code = (await alice.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  await bob.connect();
  await link(page, bob);
  await page.goto("/home");
  await page
    .getByRole("navigation", { name: "Home, communities, create and discover" })
    .getByRole("button", { name: /^Look Lab/ })
    .click();
  await page.goto("/workspace/overview");
  const card = page.getByRole("region", { name: "Appearance" });
  await expect(card).toContainText("Only owners and admins can change");
  await expect(card.getByRole("button", { name: "Save appearance" })).toHaveCount(0);
});
