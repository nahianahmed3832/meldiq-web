import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { zMojoCatalog, zMojoMe } from "../src/api/mojoSchemas";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

const catalogJson: unknown = JSON.parse(readFileSync(new URL("../test/contract-fixtures/http/GET_v2_mojo_catalog.json", import.meta.url), "utf8"));
const meJson: unknown = JSON.parse(readFileSync(new URL("../test/contract-fixtures/http/GET_v2_mojo_me.json", import.meta.url), "utf8"));

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("a familiar free user gets an optional support notice with real pricing, cooldown and opt-out", async ({ page }, info) => {
  await page.clock.install({ time: Date.now() });
  const alice = await newPhone("support", "Independent Support");
  const catalog = zMojoCatalog.parse(catalogJson);
  catalog.onSale = { ...catalog.onSale, mode: "live", plus: { currency: "USD", amountMinor: 399 } };
  const me = zMojoMe.parse(meJson);
  me.plan = "free";
  me.perks = catalog.plans.find((p) => p.key === "free")!;
  await page.route("**/v1/server-info", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.features = [...new Set([...data.features, "mojo"])];
    await route.fulfill({ json: data });
  });
  await page.route("**/v2/mojo/catalog", (route) => route.fulfill({ json: catalog }));
  await page.route("**/v2/mojo/me", (route) => route.fulfill({ json: me }));
  await page.route("**/v2/billing/account", (route) => route.fulfill({ json: { available: true, provider: "paypal", subscription: null, portal: false } }));
  await link(page, alice);
  await page.goto("/dms");
  await page.bringToFront();
  await expect(page.locator(".mojo-promo")).toContainText("Keep Meldiq independent");
  const now = Date.now();
  const seed = async () =>
    page.evaluate(
      async ({ userId, now }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("orbit-web");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const days = [2, 1, 0].map((daysAgo) => new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10));
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put({ userId, days, activeMs: 600_000, lastShownAt: null, snoozedUntil: 0 }, "plusSupport");
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        } finally {
          db.close();
        }
      },
      { userId: alice.userId, now },
    );
  await seed();
  const activeTime = async () =>
    page.evaluate(async () => {
      const engine = (window as unknown as { __orbit: { store: { getValue(key: string): Promise<{ activeMs: number } | undefined> } } }).__orbit;
      return (await engine.store.getValue("plusSupport"))?.activeMs ?? 0;
    });
  const activeVisit = async () => {
    await expect(page.locator(".app[data-connection=online]").first()).toBeVisible();
    await expect(page.locator(".mojo-promo")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    for (let i = 0; i < 5; i++) {
      const before = await activeTime();
      await page.clock.runFor(15_000);
      await expect.poll(activeTime).toBeGreaterThan(before);
    }
  };
  await activeVisit();
  const notice = page.getByRole("status", { name: "Help keep Meldiq independent" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("corporate investment");
  await expect(notice).toContainText("3.99/month");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/meldiq-plus-support-${info.project.name}.png` });
  await notice.getByRole("button", { name: "Remind me in 30 days" }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await page.bringToFront();
  await activeVisit();
  await expect(notice).toHaveCount(0);
  // A deliberate new eligibility window exercises permanent opt-out without waiting a month.
  await seed();
  await page.reload();
  await page.bringToFront();
  await activeVisit();
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Don’t show again" }).click();
  await page.goto("/settings/notifications");
  await expect(page.getByRole("switch", { name: "Support Meldiq reminders", exact: true })).not.toBeChecked();
});

test("community entry opens its last text channel and removes the old dashboard", async ({ page, isMobile }, info) => {
  const alice = await newPhone("landing", "Channel Landing");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Channel Landing Community" });
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
