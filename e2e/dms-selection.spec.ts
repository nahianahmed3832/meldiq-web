import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
import { numericConversationPath } from "../src/application/conversationPaths";

/**
 * Direct messages belong to no community (reported 2026-10-23: in DMs the community stayed selected in the rail and its
 * header topped the list, and clicking the community kept you in DMs). As on Discord: in DMs no community is selected
 * and the list has its own heading; a community in the rail opens its channels.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium only: the rail is hidden on phones");
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

for (const lobbyEnabled of [true, false]) {
  test(`DMs clears community selection; the rail restores ${lobbyEnabled ? "the configured lobby" : "the first available channel"}`, async ({ page }) => {
    const alice = await newPhone("alice", "Alice Rahman");
    const bob = await newPhone("bob", "Bob Chen");
    const { org } = await alice.req("POST", "/v1/orgs", { name: "Rail Lab" });
    const server = await alice.req("GET", "/v1/server-info");
    expect(server.features).toContain("community-lobby");
    const lobbySettings = await alice.req("GET", `/v1/orgs/${org.id}/lobby/settings`);
    await alice.req("PUT", `/v1/orgs/${org.id}/lobby/settings`, { rev: lobbySettings.rev, enabled: lobbyEnabled });
    const { conversations } = await alice.req("GET", "/v1/conversations");
    const channel = conversations
      .filter((c: { orgId?: string; type: string; joined: boolean; voice?: boolean; archived?: boolean }) => c.orgId === org.id && c.type === "CHANNEL" && c.joined && !c.voice && !c.archived)
      .sort(
        (a: { categoryPosition?: number; position: number; id: string }, b: { categoryPosition?: number; position: number; id: string }) =>
          (a.categoryPosition ?? 0) - (b.categoryPosition ?? 0) || a.position - b.position || a.id.localeCompare(b.id),
      )[0];
    expect(channel).toBeTruthy();
    const channelPath = numericConversationPath("home", channel.id, org.id);
    await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId });
    await alice.connect();
    await link(page, alice);

    const rail = page.getByRole("navigation", { name: "Home, communities, create and discover" });
    const community = rail.getByRole("button", { name: /^Rail Lab/ });
    const selected = rail.locator('.rail-org[aria-current="true"]');
    const sidebar = page.getByRole("complementary", { name: "Conversations" });

    await page.goto("/home");
    await expect(selected).toHaveCount(1);
    await expect(sidebar).toContainText("Rail Lab");

    // As on Discord: the mascot at the top of the rail opens the direct messages; there's no separate DMs button.
    await expect(rail.getByRole("link", { name: /^DMs/ })).toHaveCount(0);
    await rail.getByRole("link", { name: /^Messages/ }).click();
    await expect(page).toHaveURL(/\/dms$/);
    await expect(selected).toHaveCount(0);
    await expect(sidebar.getByRole("heading", { name: "Direct messages", level: 2 })).toBeVisible();
    // No community's header or channels here; the invite card invites to Meldiq itself (a community's invitations are in
    // that community).
    await expect(sidebar.getByRole("button", { name: /^Community: Rail Lab/ })).toHaveCount(0);
    await expect(sidebar.getByRole("region", { name: "Invite friends to Meldiq" })).not.toContainText("Rail Lab");
    await expect(sidebar).toContainText("Bob Chen");

    await community.click();
    await expect(page).toHaveURL(lobbyEnabled ? /\/lobby$/ : channelPath);
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveAccessibleName(/^Rail Lab/);
    await expect(sidebar).toContainText("Rail Lab");
    await expect(sidebar.getByRole("heading", { name: "Direct messages", level: 2 })).toHaveCount(0);
    if (lobbyEnabled) {
      await expect(page.getByRole("region", { name: "Rail Lab lobby", exact: true }).getByRole("heading", { name: "Rail Lab", exact: true })).toBeVisible();
      await expect(sidebar.getByRole("button", { name: "Lobby", exact: true })).toHaveAttribute("aria-current", "page");
    } else {
      await expect(page.locator(".conv-head")).toContainText(channel.name);
      await expect(page.getByRole("log", { name: "Messages" })).toBeVisible();
    }

    // A visited text channel takes priority over a seen lobby on the next community entry.
    await page.goto(channelPath);
    await expect(page.locator(".conv-head")).toContainText(channel.name);
    await rail.getByRole("link", { name: /^Messages/ }).click();
    await expect(page).toHaveURL(/\/dms$/);
    await expect(selected).toHaveCount(0);
    await community.click();
    await expect(page).toHaveURL(channelPath);
    await expect(selected).toHaveAccessibleName(/^Rail Lab/);
    await expect(page.locator(".conv-head")).toContainText(channel.name);
    await expect(page.getByRole("log", { name: "Messages" })).toBeVisible();
    await alice.disconnect();
  });
}
