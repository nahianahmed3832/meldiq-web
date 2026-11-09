import { expect, test, type Page } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// The authenticated app and catalog are real; the PayPal REST boundary and SDK are explicit UI test doubles.
const fakeSdk = `
customElements.define('paypal-button', class extends HTMLElement {
  connectedCallback() { this.innerHTML = '<button type="button" style="width:100%;padding:16px;background:#ffc439;color:#003087;border:0;border-radius:10px;font-weight:700">PayPal Subscribe</button>'; }
});
window.paypal = { version:'6.0.0', createInstance: async () => ({
  findEligibleMethods: async () => ({ isEligible: () => true }),
  createPayPalSubscriptionPaymentSession: (callbacks) => ({ start: async (_, purchase) => { await purchase; if (window.paypalCancel) callbacks.onCancel({}); else await callbacks.onApprove({ subscriptionId: 'I-UNTRUSTED-BROWSER' }); }, destroy() {} }),
  createPayPalOneTimePaymentSession: (callbacks) => ({ start: async (_, purchase) => { await purchase; await callbacks.onApprove({ orderId: 'UNTRUSTED-BROWSER' }); }, destroy() {} })
}) };
`;
async function checkout(page: Page, { deferred = false, longTermsAvailable = true, monthlyAmount = 499 }: { deferred?: boolean; longTermsAvailable?: boolean; monthlyAmount?: number | null } = {}) {
  const alice = await newPhone("paypalcheckout", "Checkout Tester");
  await alice.connect();
  await link(page, alice);
  const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
  await page.route("**/v2/mojo/catalog", async (route) => {
    catalog.plusTerms = [
      { key: "monthly", months: 1, amountMinor: 499, currency: "USD", interval: "month", billingFrequency: 1, savingsMinor: 0, monthlyEquivalentMinor: 499, savingsPercent: 0, available: true },
      {
        key: "quarterly",
        months: 3,
        amountMinor: 1299,
        currency: "USD",
        interval: "month",
        billingFrequency: 3,
        savingsMinor: 198,
        monthlyEquivalentMinor: 433,
        savingsPercent: 13.23,
        available: longTermsAvailable,
      },
      {
        key: "yearly",
        months: 12,
        amountMinor: 4999,
        currency: "USD",
        interval: "year",
        billingFrequency: 1,
        savingsMinor: 989,
        monthlyEquivalentMinor: 417,
        savingsPercent: 16.52,
        available: longTermsAvailable,
      },
    ];
    catalog.onSale = {
      mode: "live",
      go: null,
      plus: monthlyAmount === null ? null : { currency: "USD", amountMinor: monthlyAmount },
      spark: { currency: "USD", amountMinor: 299 },
      gifts: true,
    };
    await route.fulfill({ json: catalog });
  });
  await page.route("**/v2/billing/account", (route) => route.fulfill({ json: { available: true, provider: "paypal", subscription: null, portal: false } }));
  await page.route("**/v2/billing/paypal/config", (route) =>
    route.fulfill({ json: { provider: "paypal", environment: "live", clientId: "public-live-test", billingStartAt: deferred ? Date.now() + 7 * 86400000 : null, subscriptions: true, cards: false } }),
  );
  await page.route("https://www.paypal.com/web-sdk/v6/core", (route) => route.fulfill({ contentType: "application/javascript", body: fakeSdk }));
  const purchase = {
    id: "chk_test",
    product: "plus",
    providerRef: "I-SERVER-OWNED",
    status: "open",
    confirmed: false,
    currency: "USD",
    amountMinor: 499,
    interval: "month",
    expiresAt: Date.now() + 3600000,
  };
  await page.route("**/v2/billing/paypal/checkouts", (route) => route.fulfill({ json: purchase }));
  await page.route("**/v2/billing/paypal/checkouts/chk_test", (route) => route.fulfill({ json: purchase }));
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) => route.fulfill({ json: purchase }));
  await page.goto("/settings/checkout");
  await expect(page.getByRole("heading", { name: "Make room for more." })).toBeVisible();
  return { purchase, userId: alice.userId };
}
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});
test.skip(({ browserName }) => browserName !== "chromium", "Chromium desktop and phone layouts");

test("branded review, official payment control, backend-only confirmation and refresh recovery", async ({ page }, info) => {
  const { purchase: p } = await checkout(page);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator(".checkout-total")).toContainText("4.99");
  await expect(page.getByText("Included for communities: 1 Meldiq Spark")).toBeVisible();
  await expect(page.getByText("Sandbox", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No real money is taken.", { exact: false })).toHaveCount(0);
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await expect(page.locator("paypal-button")).toBeVisible();
  await page.screenshot({ path: info.outputPath("checkout-review.png"), fullPage: true });
  await page.locator("paypal-button").click();
  await expect(page.getByText("Your payment is still awaiting confirmation.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Check purchase status" })).toBeVisible();
  await page.route("**/v2/billing/paypal/checkouts/chk_test", (route) => route.fulfill({ json: { ...p, status: "active", confirmed: true } }));
  await page.getByRole("button", { name: "Check purchase status" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("PayPal cancellation and interrupted verification keep the purchase pending", async ({ page }) => {
  await checkout(page);
  await page.evaluate(() => {
    (window as unknown as { paypalCancel: boolean }).paypalCancel = true;
  });
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect(page.getByText("You closed PayPal checkout.", { exact: false })).toBeVisible();
  await page.route("**/v2/billing/paypal/checkouts/chk_test", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Check purchase status" }).click();
  await expect(page.getByRole("alert")).toContainText("Can't reach the server");
  await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toHaveCount(0);
});

for (const choice of [
  { term: "quarterly", months: 3, amountMinor: 1299, interval: "month", billingFrequency: 3, saving: "$1.98", percent: "13.23%" },
  { term: "yearly", months: 12, amountMinor: 4999, interval: "year", billingFrequency: 1, saving: "$9.89", percent: "16.52%" },
]) {
  test(`${choice.months}-month Plus review uses the full recurring charge and resets consent`, async ({ page }) => {
    const { purchase } = await checkout(page);
    let starts = 0;
    await page.route("**/v2/billing/paypal/checkouts", async (route) => {
      starts++;
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ product: "plus", term: choice.term });
      expect(body).not.toHaveProperty("amountMinor");
      await route.fulfill({ json: { ...purchase, amountMinor: choice.amountMinor, interval: choice.interval, billingFrequency: choice.billingFrequency } });
    });
    await page.getByRole("checkbox").check();
    await page.getByRole("radio", { name: new RegExp(`^${choice.months} months`) }).check();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(page.locator(".checkout-total")).toContainText((choice.amountMinor / 100).toFixed(2));
    await expect(page.locator(".checkout-renewal")).toContainText(`every ${choice.months} months until you cancel`);
    await expect(page.locator(".plus-term-option.selected")).toContainText(choice.percent);
    await expect(page.locator(".plus-support-summary")).toContainText(`You save ${choice.saving}`);
    await page.getByRole("checkbox").check();
    await page.locator("paypal-button").click();
    await expect.poll(() => starts).toBe(1);
    await expect(page.getByRole("button", { name: "Check purchase status" })).toBeVisible();
  });
}

test("small-screen order review remains readable", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await checkout(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("checkout-360.png"), fullPage: true });
});

test("Plus settings and checkout show the same prices and mark unavailable terms", async ({ page }) => {
  await checkout(page, { longTermsAvailable: false, monthlyAmount: 599 });
  await page.goto("/settings/mojo");
  const terms = page.getByRole("region", { name: "Billing", exact: true });
  await expect(terms.getByRole("listitem").filter({ has: page.getByText("Monthly", { exact: true }) })).toContainText("$5.99 billed every month");
  for (const [term, price] of [
    ["3 months", "$12.99"],
    ["12 months", "$49.99"],
  ]) {
    const row = terms.getByRole("listitem").filter({ has: page.getByText(term, { exact: true }) });
    await expect(row).toContainText(`${price} billed every ${term}`);
    await expect(row).toContainText("Not available for purchase yet");
  }
  await expect(page.getByText("Included for communities: 1 Spark")).toBeVisible();
  await expect(page.getByText("$2.99 per Spark", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole("button", { name: /Get Meldiq Plus for \$5\.99/ })
    .first()
    .click();
  await expect(page.getByRole("radio", { name: /^Monthly/ })).toBeChecked();
  await expect(page.locator(".plus-term-option.selected")).toContainText("$5.99 billed every month");
  await expect(page.getByRole("radio", { name: /^3 months/ })).toBeDisabled();
  await expect(page.getByRole("radio", { name: /^12 months/ })).toBeDisabled();
});

test("Plus settings open an available billing interval when monthly checkout is unavailable", async ({ page }) => {
  await checkout(page, { monthlyAmount: null });
  await page.goto("/settings/mojo");
  await page.getByRole("button", { name: "Choose your billing interval" }).first().click();
  await expect(page.getByRole("radio", { name: /^3 months/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /^Monthly/ })).toBeDisabled();
  await expect(page.locator(".checkout-total")).toContainText("$12.99");
});

test("live approval schedules renewal after existing free time without claiming payment", async ({ page }) => {
  const { purchase: p } = await checkout(page, { deferred: true });
  await expect(page.locator(".checkout-total")).toContainText("0.00");
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) => route.fulfill({ json: { ...p, approved: true } }));
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect(page.getByRole("heading", { name: "Your Plus renewal is scheduled." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toHaveCount(0);
  await expect(page.getByText("PayPal has confirmed your approval.", { exact: false })).toBeVisible();
});

for (const { product, resumed, total } of [
  { product: "spark", resumed: false, total: 598 },
  { product: "spark", resumed: true, total: 198 },
  { product: "bots_plus", resumed: false, total: 399 },
] as const) {
  test(`${product}${resumed ? " (resumed)" : ""} is reviewed separately and only server-confirmed payment completes it`, async ({ page }, info) => {
    const { userId } = await checkout(page);
    const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
    await page.route("**/v2/mojo/catalog", async (route) => {
      catalog.onSale = {
        mode: "live",
        go: null,
        plus: { currency: "USD", amountMinor: 499 },
        spark: { currency: "USD", amountMinor: 299 },
        botsPlus: { currency: "USD", amountMinor: 399 },
        gifts: false,
      };
      await route.fulfill({ json: catalog });
    });
    await page.route("**/v2/billing/paypal/config", (route) =>
      route.fulfill({ json: { provider: "paypal", environment: "live", clientId: "public-live-test", subscriptions: true, sparks: true, botsPlus: true, cards: false } }),
    );
    const p = {
      id: `checkout_${product}`,
      product,
      orgId: product === "bots_plus" ? "org_owned" : null,
      quantity: product === "spark" ? 2 : undefined,
      providerRef: product === "spark" ? "ORDER-OWNED" : "I-OWNED",
      status: "pending",
      confirmed: false,
      currency: "USD",
      amountMinor: total,
      interval: product === "spark" ? "one_time" : "month",
      expiresAt: Date.now() + 3600000,
    };
    await page.route("**/v2/billing/paypal/checkouts", async (route) => {
      expect(resumed).toBe(false);
      expect(route.request().postDataJSON()).toMatchObject(product === "spark" ? { product, quantity: 2 } : { product });
      await route.fulfill({ json: p });
    });
    await page.route(`**/v2/billing/paypal/checkouts/${p.id}`, (route) => route.fulfill({ json: p }));
    await page.route(`**/v2/billing/paypal/checkouts/${p.id}/confirm`, (route) => route.fulfill({ json: p }));
    if (product === "spark" && !resumed) {
      await page.goto("/settings/spark");
      await page.getByRole("button", { name: "One more" }).click();
      await page.getByRole("button", { name: "Buy for $5.98 once" }).click();
    } else {
      await page.evaluate(
        ({ kind, id, purchaseId }) => {
          const draft = kind === "spark" ? { product: kind, quantity: 2 } : { product: kind, orgId: "org_owned" };
          sessionStorage.setItem(`meldiq.paypal.sandbox.${id}`, JSON.stringify({ draft, requestKey: crypto.randomUUID(), purchaseId, completed: false }));
        },
        { kind: product, id: userId, purchaseId: resumed ? p.id : null },
      );
      await page.reload();
    }
    await expect(page.locator(".checkout-total")).toContainText((total / 100).toFixed(2));
    if (product === "spark") await expect(page.getByText(resumed ? "$0.99" : "$2.99", { exact: true })).toBeVisible();
    await expect(page.getByText(/No Meldiq Plus subscription is required|purchased separately from Meldiq Plus/).first()).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(page.locator("paypal-button")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${product}${resumed ? "-resumed" : ""}-review.png`), fullPage: true });
    const confirmation = page.waitForResponse((response) => response.url().endsWith(`/v2/billing/paypal/checkouts/${p.id}/confirm`) && response.request().method() === "POST");
    await page.locator("paypal-button").click();
    expect(await (await confirmation).json()).toMatchObject({ confirmed: false });
    await expect(page.getByRole("button", { name: "Check payment status" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Your Sparks are ready|Bots\+ is active/ })).toHaveCount(0);
    p.confirmed = true;
    p.status = product === "spark" ? "paid" : "active";
    await page.getByRole("button", { name: "Check payment status" }).click();
    await expect(page.getByRole("heading", { name: /Your Sparks are ready|Bots\+ is active/ })).toBeVisible();
  });
}

for (const term of [
  { key: "quarterly", months: 3, amountMinor: 1299, interval: "month", billingFrequency: 3, saving: "1.98" },
  { key: "yearly", months: 12, amountMinor: 4999, interval: "year", billingFrequency: 1, saving: "9.89" },
]) {
  test(`${term.months}-month checkout shows the whole charge, savings and recurring cadence`, async ({ page }) => {
    const { purchase: p } = await checkout(page);
    await page.getByRole("radio", { name: new RegExp(`^${term.months} months`) }).check();
    await expect(page.locator(".checkout-total")).toContainText((term.amountMinor / 100).toFixed(2));
    await expect(page.locator(".checkout-total")).toContainText(`Renews every ${term.months} months`);
    await expect(page.locator(".plus-support-summary")).toContainText(term.saving);
    await page.route("**/v2/billing/paypal/checkouts", (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ product: "plus", term: term.key });
      return route.fulfill({ json: { ...p, ...term } });
    });
    await page.getByRole("checkbox").check();
    await page.locator("paypal-button").click();
    await expect(page.getByRole("button", { name: "Check purchase status" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toHaveCount(0);
  });
}
