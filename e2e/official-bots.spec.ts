import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Community parity D (docs/MELDIQ_COMMUNITY_PARITY.md §1 Bots): Settings › Bots' official bots, a bot's window (switch,
 * look here, settings, Plus gating, Save), Welcomer's test, Helper answering in a channel with its BOT tag, the member
 * list's Bots group and the lobby's Levels board. Needs a server with community-bots.
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

test("official bots: turn on, rename, set up, test, and see them work", async ({ page }) => {
  const alice = await newPhone("obalice", "Alice Rahman");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Night Owls" });
  const features: string[] = (await alice.req("GET", "/v1/server-info")).features ?? [];
  test.skip(!features.includes("community-bots"), "server without official bots");
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; name: string; orgId: string | null; voice: boolean; format: string | null }[];
  const general = channels.find((c) => c.orgId === org.id && c.name === "general")!;
  await alice.connect();
  await link(page, alice);

  await page.goto("/workspace/bots");
  const settings = page.getByRole("dialog", { name: "Night Owls settings" });
  const official = settings.getByRole("region", { name: "Official bots" });
  await expect(official.getByText("Welcomer")).toBeVisible();
  await expect(official.getByText("Off · FREE · tap for details").first()).toBeVisible();
  await shot(page, "d-bots-page");

  // Welcomer: on, a name of its own here, a greeting with placeholders, Save, then a test.
  await official.getByRole("button", { name: "Welcomer: details" }).click();
  const welcomer = page.getByRole("dialog", { name: "Welcomer" });
  await expect(welcomer.getByText("Greets every newcomer by name")).toBeVisible();
  await welcomer.getByRole("switch", { name: "Welcomer on" }).click();
  await expect(welcomer.getByRole("region", { name: "Look in this server" })).toBeVisible();
  await welcomer.getByRole("button", { name: "Change" }).click();
  await welcomer.getByLabel("Name here").fill("Doorbell");
  await welcomer.getByRole("button", { name: "Save name" }).click();
  await expect(welcomer.getByRole("heading", { name: /Doorbell/ })).toBeVisible();
  await welcomer.getByRole("textbox", { name: "Greeting 1" }).fill("Hi {user}! {name} makes {count} of us in {server}.");
  await expect(welcomer.getByLabel("Preview")).toContainText(/makes \d+ of us in Night Owls/);
  await expect(welcomer.getByRole("button", { name: /Add a greeting/ })).toBeDisabled();
  await expect(welcomer.getByRole("textbox", { name: "Goodbye message" })).toBeDisabled();
  await shot(page, "d-welcomer-window");
  await welcomer.getByRole("button", { name: "Save" }).click();
  await expect(welcomer.getByRole("button", { name: "Saved" })).toBeVisible();
  await welcomer.getByRole("button", { name: "Send a test" }).click();
  await expect(welcomer.getByText(/^Sent/)).toBeVisible();
  await welcomer.scrollIntoViewIfNeeded();
  await shot(page, "d-welcomer-saved");
  await welcomer.getByRole("button", { name: "Close" }).click();

  // Levels: free settings, Plus fields locked with the upsell.
  await official.getByRole("button", { name: "Levels: details" }).click();
  const levels = page.getByRole("dialog", { name: "Levels" });
  await levels.getByRole("switch", { name: "Levels on" }).click();
  await expect(levels.getByRole("radio", { name: "1.5×" })).toBeDisabled();
  await levels.getByRole("button", { name: /Get Bots\+/ }).click();
  await expect(levels.getByText("Payments for Bots+ aren't set up yet. Coming soon.")).toBeVisible();
  await levels.getByRole("group", { name: /XP boost/ }).scrollIntoViewIfNeeded();
  await shot(page, "d-levels-plus-locked");
  await levels.getByRole("button", { name: "Close" }).click();

  // Helper on; Giveaways isn't running yet: read-only with the note.
  await official.getByRole("switch", { name: "Helper on" }).click();
  await expect(official.getByText("On · FREE · tap for details").first()).toBeVisible();
  await official.getByRole("button", { name: "Giveaways: details" }).click();
  const giveaways = page.getByRole("dialog", { name: "Giveaways" });
  await expect(giveaways.getByText(/coming soon/i).first()).toBeVisible();
  await expect(giveaways.getByRole("switch", { name: "Giveaways on" })).toBeDisabled();
  await shot(page, "d-giveaways-unavailable");
  await giveaways.getByRole("button", { name: "Close" }).click();
  await shot(page, "d-bots-page-on");

  // In #general: the welcome test (as Doorbell) and Helper's answer, each with the BOT tag.
  await alice.send(general.id, { type: "text", text: "!roll 2d6" });
  await alice.send(general.id, { type: "text", text: "hello owls, first message for some XP" });
  await page.goto(`/home/c/${general.id}`);
  const welcome = page.locator(".msg").filter({ hasText: "makes" });
  await expect(welcome.locator(".bot-tag")).toBeVisible();
  await expect(welcome).toContainText("Doorbell");
  await expect(
    page
      .locator(".msg")
      .filter({ hasText: /rolled/ })
      .locator(".bot-tag"),
  ).toBeVisible();
  await shot(page, "d-channel-bots");

  // Settings › Members: the bots on are members, with their name here and the BOT tag.
  await page.goto("/workspace/people");
  const doorbell = page.getByRole("dialog", { name: "Night Owls settings" }).locator(".ws-row").filter({ hasText: "Doorbell" });
  await expect(doorbell.locator(".bot-tag")).toBeVisible();
  await shot(page, "d-members-bots");

  // The lobby's Levels board fills in from Levels' XP.
  const current = await alice.req("GET", `/v1/orgs/${org.id}/lobby/settings`);
  await alice.req("PUT", `/v1/orgs/${org.id}/lobby/settings`, { rev: current.rev, enabled: true, leaderboards: ["levels"] });
  await page.goto("/lobby");
  await expect(page.getByText(/Level \d+ · \d+ XP/)).toBeVisible();
  await shot(page, "d-lobby-levels");
});
