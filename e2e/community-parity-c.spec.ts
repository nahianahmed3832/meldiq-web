import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Community parity, batch C (docs/MELDIQ_COMMUNITY_PARITY.md §1): a webhook's post with boxes and buttons, Edit
 * channel › Webhooks and "Make a post", the message menu's Reaction roles…, and tickets (the switch, the menu's
 * Open a Ticket, the ticket channel's Close). Needs a server with channel-webhooks, reaction-roles and community-tickets.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium");
test.describe.configure({ timeout: 180_000 });
const SHOTS = process.env.ORBIT_E2E_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("webhook posts, Make a post, reaction roles and tickets", async ({ page }) => {
  const alice = await newPhone("cpcalice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Posting Lab" });
  const features: string[] = (await alice.req("GET", "/v1/server-info")).features ?? [];
  test.skip(!["channel-webhooks", "reaction-roles", "community-tickets"].every((f) => features.includes(f)), "server without batch C");
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; name: string; orgId: string | null; voice: boolean; format: string | null; kind: string }[];
  const channel = channels.find((c) => c.orgId === org.id && !c.voice && c.format !== "forum" && c.kind !== "ANNOUNCEMENT")!;
  await alice.req("POST", `/v1/orgs/${org.id}/roles`, { name: "Gamer", color: "#3ba55d", permissions: [] });

  // A webhook posts through its secret address, the way an outside app does.
  const made = await alice.req("POST", `/v1/orgs/${org.id}/channels/${channel.id}/webhooks`, { name: "Plucky Puffin" });
  const res = await fetch(`${process.env.ORBIT_E2E_API}/v1/webhooks/${made.webhook.id}/${made.token}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": testAddress() },
    body: JSON.stringify({
      content: "New here? Start below.",
      embeds: [{ title: "Welcome to Posting Lab", description: "Say **hi** and read the [rules](https://example.com/rules).\n- Be kind\n- No spam", color: 0x5865f2, footer: { text: "The mods" } }],
      buttons: [{ label: "Guidelines", emoji: "🛡️", url: "https://example.com/guidelines" }],
    }),
  });
  expect(res.status).toBeLessThan(300);

  await link(page, alice);
  await page.goto(`/home/c/${channel.id}`);
  const box = page.locator(".embed").filter({ hasText: "Welcome to Posting Lab" });
  await expect(box).toBeVisible();
  await expect(page.locator(".msg").filter({ has: box }).locator(".webhook-name")).toContainText("Plucky Puffin");
  await expect(
    page
      .locator(".msg")
      .filter({ has: box })
      .getByRole("link", { name: /Guidelines/ }),
  ).toBeVisible();
  await shot(page, "webhook-post");

  // Reaction roles… on that post.
  await box.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reaction roles…" }).click();
  const rr = page.getByRole("dialog", { name: "Reaction roles" });
  await rr.getByRole("button", { name: "Add 🎮" }).click();
  await rr.getByRole("combobox", { name: "Role for 🎮" }).selectOption({ label: "Gamer" });
  await shot(page, "reaction-roles");
  await rr.getByRole("button", { name: "Save" }).click();
  await expect(rr).toHaveCount(0);

  // Edit channel › Webhooks, then Make a post.
  await page
    .getByRole("link", { name: new RegExp(channel.name) })
    .first()
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit channel…" }).click();
  const edit = page.getByRole("dialog", { name: new RegExp(`Edit #${channel.name}`) });
  await edit.getByRole("tab", { name: "Webhooks" }).click();
  await expect(edit.getByText("1 of 10")).toBeVisible();
  await shot(page, "webhooks-tab");
  await edit.getByRole("button", { name: "New webhook" }).click();
  await expect(edit.getByText("Copy it now, you won't see it again.")).toBeVisible();
  await expect(edit.getByText("2 of 10")).toBeVisible();
  await shot(page, "webhook-url-once");
  await edit.getByRole("button", { name: "Make a post" }).click();
  const builder = page.getByRole("dialog", { name: "Make a post" });
  await expect(builder.getByRole("region", { name: "Preview" }).locator(".embed")).toHaveCount(2);
  await page.waitForTimeout(400); // the dialog's opening animation
  await shot(page, "make-a-post");
  await builder.getByRole("button", { name: "Post", exact: true }).click();
  await expect(builder).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("article", { name: "Rules", exact: true })).toBeVisible();

  // Tickets: switch on in Profile, add a panel, then open one from the community menu.
  await page.goto("/workspace/overview");
  const tickets = page.getByRole("region", { name: "Tickets" });
  await tickets.getByRole("button", { name: "Add a panel" }).click();
  await tickets.getByLabel("Name").fill("Support");
  await tickets.getByLabel("Post the panel in").selectOption({ label: `#${channel.name}` });
  await tickets.getByRole("button", { name: "Save" }).click();
  await expect(tickets.getByText("Saved.")).toBeVisible();
  await tickets.getByRole("switch", { name: "Let members open tickets" }).click();
  await expect(tickets.getByRole("button", { name: "Post the panel" })).toBeVisible();
  await shot(page, "tickets-settings");
  await page.goto(`/home/c/${channel.id}`);

  await page
    .getByRole("button", { name: /^Posting Lab/ })
    .first()
    .click({ button: "right" });
  // The items that depend on permissions arrive a moment after the menu opens; click once they have.
  await expect(page.getByRole("menuitem", { name: "Create channel" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Open a Ticket" }).click();
  const open = page.getByRole("dialog", { name: "Open a ticket" });
  await open.getByLabel("What is it about?").fill("Someone keeps spamming my DMs");
  await expect(open.getByRole("button", { name: "Open ticket" })).toBeDisabled();
  await open.getByRole("checkbox").check();
  await shot(page, "open-ticket");
  await open.getByRole("button", { name: "Open ticket" }).click();
  await expect(page.locator(".conv-head").getByRole("button", { name: "Close" })).toBeVisible();
  await shot(page, "ticket-channel");
  await page.locator(".conv-head").getByRole("button", { name: "Close" }).click();
  await page.getByRole("dialog", { name: "Close this ticket?" }).getByRole("button", { name: "Close ticket" }).click();
  await expect(page.locator(".conv-head").getByText("Archived")).toBeVisible();
});
