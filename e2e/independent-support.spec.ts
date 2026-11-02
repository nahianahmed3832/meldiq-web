import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { zMojoCatalog, zMojoMe } from "../src/api/mojoSchemas";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

const catalogJson: unknown = JSON.parse(readFileSync(new URL("../test/contract-fixtures/http/GET_v2_mojo_catalog.json", import.meta.url), "utf8"));
const meJson: unknown = JSON.parse(readFileSync(new URL("../test/contract-fixtures/http/GET_v2_mojo_me.json", import.meta.url), "utf8"));

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context, page }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  await page.route("**/v2/billing/promotions/preference", (route) => route.fulfill({ json: { optOut: false } }));
});

test("server-authorized support popup uses the reference design and stops after snooze", async ({ page }, info) => {
  await page.clock.install({ time: Date.now() });
  const alice = await newPhone("support", "Independent Support");
  const catalog = zMojoCatalog.parse(catalogJson);
  catalog.onSale = { ...catalog.onSale, mode: "live", plus: { currency: "USD", amountMinor: 499 } };
  const me = zMojoMe.parse(meJson);
  me.plan = "free";
  me.perks = catalog.plans.find((p) => p.key === "free")!;
  await page.route("**/v1/server-info", async (route) => {
    const r = await route.fetch();
    const data = await r.json();
    data.features = [...new Set([...data.features, "mojo"])];
    await route.fulfill({ json: data });
  });
  await page.route("**/v2/mojo/catalog", (route) => route.fulfill({ json: catalog }));
  await page.route("**/v2/mojo/me", (route) => route.fulfill({ json: me }));
  await page.route("**/v2/billing/account", (route) => route.fulfill({ json: { available: true, provider: "paypal", subscription: null, portal: false } }));
  let claimed = 0;
  const events: string[] = [];
  await page.route("**/v2/billing/promotions/activity", (route) => route.fulfill({ json: { recorded: true } }));
  await page.route("**/v2/billing/promotions/events", (route) => {
    events.push(route.request().postDataJSON().event);
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/v2/billing/promotions/claim", (route) => {
    claimed++;
    return route.fulfill({
      json: {
        promotion: {
          id: "imp_test",
          campaignId: "support",
          destination: "/settings/mojo",
          presentation: "modal",
          heading: "Help keep Meldiq running",
          description: "Plus helps pay for servers, storage and ongoing development.",
          cta: "Get Plus",
          amountMinor: 499,
          currency: "USD",
          interval: "month",
          expiresAt: Date.now() + 3600000,
          image: null,
        },
      },
    });
  });
  await page.route("**/v2/billing/promotions/imp_test", (route) => route.fulfill({ json: { active: true, expiresAt: Date.now() + 3600000 } }));
  await link(page, alice);
  await page.goto("/home");
  await page.bringToFront();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  await page.locator(".app").click({ position: { x: 250, y: 100 } });
  await page.clock.runFor(20_000);
  const popup = page.getByRole("dialog", { name: "Help keep Meldiq running" });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("$4.99/mo");
  await expect(popup).toContainText("Profile customization stays free");
  const copyBounds = await popup.locator(".plus-promotion-header p").boundingBox();
  const closeBounds = await popup.getByRole("button", { name: "Dismiss Plus promotion" }).boundingBox();
  expect(copyBounds!.x + copyBounds!.width).toBeLessThanOrEqual(closeBounds!.x - 4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("plus-support-popup.png") });
  await popup.getByRole("button", { name: "Not now", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect.poll(() => events.includes("snooze")).toBe(true);
  await page.clock.runFor(120_000);
  await expect(popup).toHaveCount(0);
  expect(claimed).toBe(1);
});

test("community entry opens its last text channel and removes the old dashboard", async ({ page, isMobile }, info) => {
  const alice = await newPhone("landing", "Channel Landing");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Channel Landing Community" });
  // This is a returning-member test. A first-time member is correctly sent to the unseen community lobby.
  await alice.req("POST", `/v1/orgs/${org.id}/lobby/seen`, {});
  const { conversations } = await alice.req("GET", "/v1/conversations");
  const channels = conversations.filter((c: { orgId: string; type: string; voice: boolean }) => c.orgId === org.id && c.type === "CHANNEL" && !c.voice);
  expect(channels.length).toBeGreaterThan(0);
  await link(page, alice);
  const selected = channels.at(-1);
  await page.goto(`/home/c/${selected.id}`);
  await expect(page.locator(".conversation .conv-head h1")).toBeVisible();
  await page.goto("/home");
  if (isMobile) {
    // Back to the channel list remains possible on a phone.
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("complementary", { name: "Conversations", exact: true })).toBeVisible();
  } else {
    await expect(page).toHaveURL(new RegExp(`/home/c/${selected.id}$`));
    await expect(page.locator(".conversation .conv-head h1")).toContainText(selected.name);
  }
  await expect(page.getByText("Drafts & sent", { exact: true })).toHaveCount(0);
  await expect(page.locator(".cards .stat")).toHaveCount(0);
  await page.screenshot({ path: `/tmp/meldiq-channel-landing-${info.project.name}.png` });
  await page.goto(`/home/c/${selected.id}`);
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/home/c/${selected.id}$`));
});

test("paid Plus users see one billing reminder with their agreed amount and never an upgrade popup", async ({ page }) => {
  await page.clock.install({ time: Date.now() });
  const alice = await newPhone("renewal", "Plus Subscriber"),
    catalog = zMojoCatalog.parse(catalogJson),
    me = zMojoMe.parse(meJson);
  catalog.onSale = { ...catalog.onSale, mode: "live", plus: { currency: "USD", amountMinor: 499 } };
  me.plan = "plus";
  me.perks = catalog.plans.find((p) => p.key === "plus")!;
  await page.route("**/v1/server-info", async (route) => {
    const r = await route.fetch(),
      d = await r.json();
    d.features = [...new Set([...d.features, "mojo"])];
    await route.fulfill({ json: d });
  });
  await page.route("**/v2/mojo/catalog", (route) => route.fulfill({ json: catalog }));
  await page.route("**/v2/mojo/me", (route) => route.fulfill({ json: me }));
  await page.route("**/v2/billing/account", (route) => route.fulfill({ json: { available: true, provider: "paypal", subscription: null, portal: false } }));
  let claimed = false,
    promos = 0;
  await page.route("**/v2/billing/promotions/claim", (route) => {
    promos++;
    return route.fulfill({ json: { promotion: null } });
  });
  await page.route("**/v2/billing/reminders/renewal", (route) => {
    const claim = route.request().postDataJSON().claim;
    const allow = claim ? !claimed : claimed;
    if (allow) claimed = true;
    return route.fulfill({
      json: { notice: allow ? { id: "reminder", autoRenew: true, amountMinor: 399, currency: "USD", months: 1, endsAt: Date.now() + 2 * 86400000, expiresAt: Date.now() + 3600000 } : null },
    });
  });
  await link(page, alice);
  await page.goto("/home");
  await page.bringToFront();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  await page.clock.runFor(10_000);
  const notice = page.getByRole("status", { name: "Plus billing reminder" });
  await expect(notice).toContainText("$3.99 every month");
  await expect(notice).toContainText("You don’t need to purchase again");
  expect(promos).toBe(0);
  await notice.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page.clock.runFor(60_000);
  await expect(notice).toHaveCount(0);
  await page.reload();
  await page.bringToFront();
  await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
  await page.clock.runFor(10_000);
  await expect(notice).toHaveCount(0);
  expect(promos).toBe(0);
});

test("Notifications reflects another device's persisted reminder choice", async ({ page }) => {
  const alice = await newPhone("prefs", "Reminder Preference");
  let optOut = true;
  await page.route("**/v2/billing/promotions/preference", (route) => {
    if (route.request().method() === "PUT") optOut = route.request().postDataJSON().optOut;
    return route.fulfill({ json: { optOut } });
  });
  await link(page, alice);
  await page.goto("/settings/notifications");
  const toggle = page.getByRole("switch", { name: "Support Meldiq reminders", exact: true });
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect.poll(() => optOut).toBe(false);
  await page.reload();
  await expect(toggle).toBeEnabled();
  await expect(toggle).toBeChecked();
});
