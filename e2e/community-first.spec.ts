import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone } from "./phone";

/**
 * The community-first redesign (docs/MELDIQ_COMMUNITY_FIRST_BRIEF.md): the mascot opens messages, Activity and Saved sit
 * in the top bar, round Create and Discover, the unread rule (one event: highlight; two or more: a count), the tab's
 * title count, and who reacted.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium: the rail and hover");

test("the mascot, the top bar, Create and Discover replace the old rail entries", async ({ page }) => {
  const alice = await newPhone("cfalice", "Alice Rahman");
  const bob = await newPhone("cfbob", "Bob Chen");
  await alice.req("POST", "/v1/orgs", { name: "First Lab" });
  await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId });
  await alice.connect();
  await link(page, alice);
  await page.goto("/home");

  const rail = page.getByRole("navigation", { name: "Home, communities, create and discover" });
  for (const old of [/^DMs/, /^Activity/, /^Later/]) await expect(rail.getByRole("link", { name: old })).toHaveCount(0);

  await rail.getByRole("link", { name: /^Home and messages/ }).click();
  await expect(page).toHaveURL(/\/dms$/);
  await expect(page.getByRole("complementary", { name: "Conversations" }).getByRole("heading", { name: "Direct messages" })).toBeVisible();

  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(page).toHaveURL(/\/activity$/);
  await page.getByRole("button", { name: /^Saved for later/ }).click();
  await expect(page).toHaveURL(/\/later$/);

  await rail.getByRole("button", { name: "Create a community" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await rail.getByRole("link", { name: "Discover communities" }).click();
  await expect(page).toHaveURL(/\/discover$/);
  await expect(page.getByRole("heading", { name: "Find your people" })).toBeVisible();
});

test("one unread event highlights a channel without a number; two show a count; the title counts DMs", async ({ page }) => {
  const alice = await newPhone("cualice", "Alice Rahman");
  const bob = await newPhone("cubob", "Bob Chen");
  const org = (await alice.req("POST", "/v1/orgs", { name: "Unread Lab" })).org.id;
  const code = (await alice.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await bob.req("POST", "/v1/invites/accept", { code });
  const quiet = (await alice.req("POST", `/v1/orgs/${org}/channels`, { name: "quiet", scope: "ORG", kind: "PRIVATE", memberIds: [bob.userId] })).channel.id;
  const busy = (await alice.req("POST", `/v1/orgs/${org}/channels`, { name: "busy", scope: "ORG", kind: "PRIVATE", memberIds: [bob.userId] })).channel.id;
  const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await page.goto("/home");

  await bob.send(quiet, { type: "text", text: "just one" });
  await bob.send(busy, { type: "text", text: "first" });
  await bob.send(busy, { type: "text", text: "second" });
  await bob.send(dm, { type: "text", text: "hi alice" });

  const sidebar = page.getByRole("complementary", { name: "Conversations" });
  const quietRow = sidebar.getByRole("link", { name: /quiet, 1 unread/ });
  const busyRow = sidebar.getByRole("link", { name: /busy, 2 unread/ });
  await expect(quietRow).toHaveClass(/unread/);
  await expect(quietRow.locator(".count")).toHaveCount(0);
  await expect(busyRow).toHaveClass(/unread/);
  await expect(busyRow.locator(".count")).toHaveText("2");
  await expect(page).toHaveTitle("(1) Meldiq");

  await busyRow.click();
  await expect(sidebar.getByRole("link", { name: /^Channel busy$/ })).not.toHaveClass(/unread/);
});

test("hovering a reaction shows who reacted", async ({ page }) => {
  const alice = await newPhone("cralice", "Alice Rahman");
  const bob = await newPhone("crbob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  const sent = await alice.send(dm, { type: "text", text: "react to me" }, "message", "m-react-1");
  expect(sent.serverTs).toBeGreaterThan(0);
  await page.goto(`/dms/c/${dm}`);
  await expect(page.getByText("react to me", { exact: true })).toBeVisible();
  await bob.send(dm, { type: "reaction", target: "m-react-1", emoji: "🎉", add: true }, "control");

  const chip = page.getByRole("button", { name: /^🎉 1, reacted by Bob Chen/ });
  await expect(chip).toBeVisible();
  await chip.hover();
  await expect(page.getByRole("tooltip")).toContainText("Reacted by Bob Chen");
});
