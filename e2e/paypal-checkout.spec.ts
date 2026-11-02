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
async function checkout(page: Page, deferred = false) {
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
        available: true,
      },
      { key: "yearly", months: 12, amountMinor: 4999, currency: "USD", interval: "year", billingFrequency: 1, savingsMinor: 989, monthlyEquivalentMinor: 417, savingsPercent: 16.52, available: true },
    ];
    catalog.onSale = { mode: "live", go: null, plus: { currency: "USD", amountMinor: 499 }, spark: null, gifts: true };
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

test("small-screen order review remains readable", async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await checkout(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("checkout-360.png"), fullPage: true });
});

test("live approval schedules renewal after existing free time without claiming payment", async ({ page }) => {
  const { purchase: p } = await checkout(page, true);
  await expect(page.locator(".checkout-total")).toContainText("0.00");
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) => route.fulfill({ json: { ...p, approved: true } }));
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect(page.getByRole("heading", { name: "Your Plus renewal is scheduled." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toHaveCount(0);
  await expect(page.getByText("PayPal has confirmed your approval.", { exact: false })).toBeVisible();
});

for (const product of ["spark", "bots_plus"] as const) {
  test(`${product} is reviewed separately and only server-confirmed payment completes it`, async ({ page }, info) => {
    const { userId } = await checkout(page);
    const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
    await page.route("**/v2/mojo/catalog", async (route) => {
      catalog.onSale = {
        mode: "live",
        go: null,
        plus: { currency: "USD", amountMinor: 499 },
        spark: { currency: "USD", amountMinor: 99 },
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
      amountMinor: product === "spark" ? 198 : 399,
      interval: product === "spark" ? "one_time" : "month",
      expiresAt: Date.now() + 3600000,
    };
    await page.route("**/v2/billing/paypal/checkouts", async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ product });
      await route.fulfill({ json: p });
    });
    await page.route(`**/v2/billing/paypal/checkouts/${p.id}`, (route) => route.fulfill({ json: p }));
    await page.route(`**/v2/billing/paypal/checkouts/${p.id}/confirm`, (route) => route.fulfill({ json: p }));
    await page.evaluate(
      ({ kind, id }) => {
        const draft = kind === "spark" ? { product: kind, quantity: 2 } : { product: kind, orgId: "org_owned" };
        sessionStorage.setItem(`meldiq.paypal.sandbox.${id}`, JSON.stringify({ draft, requestKey: crypto.randomUUID(), purchaseId: null, completed: false }));
      },
      { kind: product, id: userId },
    );
    await page.reload();
    await expect(page.locator(".meldiq-checkout")).toContainText(product === "spark" ? "1.98" : "3.99");
    await expect(page.getByText(/No Meldiq Plus subscription is required|purchased separately from Meldiq Plus/).first()).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(page.locator("paypal-button")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${product}-review.png`), fullPage: true });
    await page.locator("paypal-button").click();
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
    await page
      .getByRole("radio")
      .nth(term.months === 3 ? 1 : 2)
      .check();
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
