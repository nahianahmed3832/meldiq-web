import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// Keep the explicit payment API doubles at the page boundary in every browser.
test.use({ serviceWorkers: "block" });

test("Bots+ renewal targets its own subscription and preserves personal Plus", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const alice = await newPhone("paypalbilling", "Billing Tester");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Bots Billing Lab" });
  const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
  const me = await alice.req("GET", "/v2/mojo/me");
  const until = Date.now() + 28 * 86400000;
  let canceled = false;
  let cancelBody: unknown;
  await page.route("**/v2/mojo/catalog", (route) =>
    route.fulfill({
      json: {
        ...catalog,
        onSale: { mode: "live", plus: { currency: "USD", amountMinor: 399 }, botsPlus: { currency: "USD", amountMinor: 399 }, spark: { currency: "USD", amountMinor: 99 }, go: null, gifts: false },
      },
    }),
  );
  await page.route("**/v2/mojo/me", (route) => route.fulfill({ json: { ...me, plan: "plus", perks: catalog.plans.find((p: { key: string }) => p.key === "plus") } }));
  await page.route("**/v2/billing/account", (route) =>
    route.fulfill({
      json: {
        available: true,
        provider: "paypal",
        mode: "live",
        portal: false,
        subscription: {
          plan: { key: "plus", name: "Mojo Plus" },
          status: "active",
          standing: "paid",
          currentPeriodEnd: until,
          trialEnd: null,
          cancelAtPeriodEnd: false,
          currency: "USD",
          amountMinor: 399,
        },
      },
    }),
  );
  await page.route("**/v2/billing/paypal/history", (route) =>
    route.fulfill({
      json: {
        transactions: [],
        history: [],
        subscriptions: [
          {
            id: "sub_bots_owned",
            product: "bots_plus",
            orgId: org.id,
            providerRef: "I-OWNED-BOTS",
            status: canceled ? "active" : "past_due",
            currentPeriodEnd: until,
            cancelAtPeriodEnd: canceled,
            createdAt: Date.now(),
          },
        ],
      },
    }),
  );
  await page.route("**/v2/billing/paypal/cancel", async (route) => {
    cancelBody = route.request().postDataJSON();
    canceled = true;
    await route.fulfill({ json: { confirmed: true, accessUntil: until, status: "active" } });
  });
  await alice.connect();
  await link(page, alice);
  await page.goto("/settings/billing");
  const bots = page.getByRole("region", { name: "Bots+ subscription" });
  await expect(bots).toContainText("Bots Billing Lab");
  await expect(bots.getByRole("link", { name: "Update your payment method in PayPal" })).toHaveAttribute("href", "https://www.paypal.com/myaccount/autopay/");
  await bots.getByRole("button", { name: "Cancel Bots+ renewal" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel Bots+ renewal?" });
  await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(dialog).toHaveCount(0);
  expect(cancelBody).toEqual({ confirm: true, subscriptionId: "sub_bots_owned" });
  await expect(bots).toContainText("Renewal cancelled");
  await expect(page.getByRole("region", { name: "Current subscription" }).getByRole("button", { name: "Cancel renewal", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
