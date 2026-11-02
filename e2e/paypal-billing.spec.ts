import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// Keep the explicit payment API doubles at the page boundary in every browser.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/v2/billing/sync", (route) => route.fulfill({ json: { checked: 1 } }));
});

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
          plan: { key: "plus", name: "Meldiq Plus" },
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

for (const approved of [false, true]) {
  test(`${approved ? "approved unpaid renewal can be canceled" : "unapproved checkout is not a subscription"} while the free signup trial stays separate`, async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
    const alice = await newPhone("billingtrial", "Trial Billing Tester");
    const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
    catalog.onSale = { mode: "live", go: null, plus: { currency: "USD", amountMinor: 399 }, spark: null, botsPlus: null, gifts: false };
    await page.route("**/v2/mojo/catalog", (route) => route.fulfill({ json: catalog }));
    const me = await alice.req("GET", "/v2/mojo/me");
    const end = Date.now() + 7 * 86400000;
    let canceled = false;
    let cancelCalls = 0;
    await page.route("**/v2/mojo/me", (route) => route.fulfill({ json: { ...me, plan: "plus", perks: catalog.plans.find((p: { key: string }) => p.key === "plus") } }));
    await page.route("**/v2/billing/account", (route) =>
      route.fulfill({
        json: {
          available: true,
          provider: "paypal",
          mode: "live",
          portal: false,
          freePeriod: { source: "signup_trial", planKey: "plus", endsAt: end },
          subscription: canceled
            ? null
            : {
                plan: { key: "plus", name: "Meldiq Plus" },
                status: "incomplete",
                standing: "not_entitled",
                currentPeriodEnd: null,
                trialEnd: approved ? end : null,
                approvalPending: !approved,
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
              id: "sub_personal_owned",
              product: "plus",
              providerRef: "I-PENDING",
              status: canceled ? "canceled" : "incomplete",
              approvalPending: !approved,
              billingStartAt: approved ? end : null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: canceled,
              createdAt: Date.now(),
            },
          ],
        },
      }),
    );
    await page.route("**/v2/billing/paypal/cancel", async (route) => {
      cancelCalls++;
      expect(route.request().postDataJSON()).toEqual({ confirm: true, subscriptionId: "sub_personal_owned" });
      canceled = true;
      await route.fulfill({ json: { confirmed: true, accessUntil: null, status: "canceled" } });
    });
    await alice.connect();
    await link(page, alice);
    await page.goto("/settings/billing");
    const current = page.getByRole("region", { name: "Current subscription" });
    if (approved) {
      await current.getByRole("button", { name: "Cancel renewal", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Cancel Plus renewal?" });
      await expect(dialog).not.toContainText("Not available yet");
      await expect(dialog).toContainText("free Plus time stays available");
      await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText("PayPal confirmed cancellation. No future payments are scheduled.", { exact: false })).toBeVisible();
      await expect(current).toContainText("Free signup trial");
      expect(cancelCalls).toBe(1);
    } else {
      await expect(current).toContainText("Free signup trial");
      await expect(current).toContainText("It does not renew or charge you");
      await expect(page.getByRole("region", { name: "Unfinished Plus checkout" })).toContainText("No paid Plus subscription or recurring payment has been authorized");
      await expect(page.getByRole("button", { name: "Return to checkout" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel renewal", exact: true })).toHaveCount(0);
      expect(cancelCalls).toBe(0);
    }
    await expect(page.getByRole("heading", { name: "Meldiq Plus", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (!approved) {
      await page.route("**/v2/billing/paypal/config", (route) => route.fulfill({ json: { provider: "paypal", environment: "live", clientId: "public-test", cards: false, subscriptions: true } }));
      await page.route("https://www.paypal.com/sdk/js?**", (route) =>
        route.fulfill({ contentType: "application/javascript", body: "window[document.currentScript.getAttribute('data-namespace')]={Buttons:()=>({isEligible:()=>false})};" }),
      );
      let reads = 0;
      let creates = 0;
      await page.route("**/v2/billing/paypal/checkouts/chk_pending", (route) => {
        reads++;
        return route.fulfill({
          json: {
            id: "chk_pending",
            product: "plus",
            providerRef: "I-PENDING",
            status: "open",
            confirmed: false,
            currency: "USD",
            amountMinor: 399,
            interval: "month",
            expiresAt: Date.now() + 3600000,
          },
        });
      });
      await page.route("**/v2/billing/paypal/checkouts", (route) => {
        creates++;
        return route.abort();
      });
      const requestKey = await page.evaluate((userId) => {
        const requestKey = crypto.randomUUID();
        sessionStorage.setItem(`meldiq.paypal.sandbox.${userId}`, JSON.stringify({ draft: { product: "plus" }, requestKey, purchaseId: "chk_pending", completed: false }));
        return requestKey;
      }, alice.userId);
      await page.getByRole("button", { name: "Return to checkout", exact: true }).click();
      await expect(page).toHaveURL(/\/settings\/checkout$/);
      await expect(page.getByRole("heading", { name: "Make room for more." })).toBeVisible();
      await expect.poll(() => reads).toBeGreaterThan(0);
      await expect(page.getByRole("radio", { name: /Debit or credit card/ })).toBeDisabled();
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(await page.evaluate((userId) => JSON.parse(sessionStorage.getItem(`meldiq.paypal.sandbox.${userId}`)!), alice.userId)).toMatchObject({
        draft: { product: "plus" },
        requestKey,
        purchaseId: "chk_pending",
      });
      expect(creates).toBe(0);
      expect(cancelCalls).toBe(0);
    }
  });
}

test("unapproved Bots+ returns to the selected community checkout without creating a purchase", async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const alice = await newPhone("botsreturn", "Bots Checkout Tester");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Bots Return Lab" });
  const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
  await page.route("**/v2/mojo/catalog", (route) =>
    route.fulfill({
      json: { ...catalog, onSale: { mode: "live", go: null, plus: { currency: "USD", amountMinor: 399 }, botsPlus: { currency: "USD", amountMinor: 399 }, spark: null, gifts: false } },
    }),
  );
  await page.route("**/v2/billing/account", (route) => route.fulfill({ json: { available: true, provider: "paypal", mode: "live", portal: false, subscription: null } }));
  await page.route("**/v2/billing/paypal/history", (route) =>
    route.fulfill({
      json: {
        transactions: [],
        history: [],
        subscriptions: [
          {
            id: "sub_bots_pending",
            product: "bots_plus",
            orgId: org.id,
            providerRef: "I-PENDING-BOTS",
            status: "incomplete",
            approvalPending: true,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            createdAt: Date.now(),
          },
        ],
      },
    }),
  );
  await page.route("**/v2/billing/paypal/config", (route) =>
    route.fulfill({ json: { provider: "paypal", environment: "live", clientId: "public-test", cards: false, subscriptions: true, botsPlus: true } }),
  );
  await page.route("https://www.paypal.com/sdk/js?**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "window[document.currentScript.getAttribute('data-namespace')]={Buttons:()=>({isEligible:()=>false})};" }),
  );
  let creates = 0;
  await page.route("**/v2/billing/paypal/checkouts", (route) => {
    creates++;
    return route.abort();
  });
  await alice.connect();
  await link(page, alice);
  await page.goto("/settings/billing");
  const bots = page.getByRole("region", { name: "Bots+ subscription" });
  await expect(bots).toContainText("Bots Return Lab");
  await page.evaluate(
    (userId) =>
      sessionStorage.setItem(`meldiq.paypal.sandbox.${userId}`, JSON.stringify({ draft: { product: "plus" }, requestKey: crypto.randomUUID(), purchaseId: "chk_personal", completed: false })),
    alice.userId,
  );
  await bots.getByRole("button", { name: "Return to Bots+ checkout", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/checkout$/);
  await expect(page.getByRole("heading", { name: "Meldiq Bots+", exact: true })).toBeVisible();
  await expect(page.locator(".checkout-title")).toContainText("Bots Return Lab");
  await expect(page.getByRole("radio", { name: /Debit or credit card/ })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate((userId) => JSON.parse(sessionStorage.getItem(`meldiq.paypal.sandbox.${userId}`)!), alice.userId)).toMatchObject({
    draft: { product: "bots_plus", orgId: org.id },
    purchaseId: null,
  });
  expect(creates).toBe(0);
});
