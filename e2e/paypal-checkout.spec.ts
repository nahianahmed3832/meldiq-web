import { expect, test, type Page } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// Keep the explicit payment API doubles at the page boundary in every browser.
test.use({ serviceWorkers: "block" });

// The authenticated app and catalog are real; the PayPal REST boundary and SDK are explicit UI test doubles.
const fakeSdk = `
customElements.define('paypal-button', class extends HTMLElement {
  connectedCallback() { this.innerHTML = '<button type="button" style="width:100%;padding:16px;background:#ffc439;color:#003087;border:0;border-radius:10px;font-weight:700">' + (this.getAttribute('type') === 'subscribe' ? 'PayPal Subscribe' : 'Pay with PayPal') + '</button>'; }
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
    catalog.onSale = { mode: "live", go: null, plus: { currency: "USD", amountMinor: 399 }, spark: null, gifts: true };
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
    amountMinor: 399,
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
test.skip(({ browserName }) => browserName === "firefox", "Payment review covers Chromium, Safari and phone layouts");

test("branded review, official payment control, backend-only confirmation and refresh recovery", async ({ page }, info) => {
  const { purchase: p } = await checkout(page);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator(".checkout-total")).toContainText("3.99");
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

async function addonCheckout(page: Page, product: "spark" | "bots_plus") {
  const { userId } = await checkout(page);
  const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
  await page.route("**/v2/mojo/catalog", async (route) => {
    catalog.onSale = {
      mode: "live",
      go: null,
      plus: { currency: "USD", amountMinor: 399 },
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
    ({ kind, userId }) => {
      const draft = kind === "spark" ? { product: kind, quantity: 2 } : { product: kind, orgId: "org_owned" };
      sessionStorage.setItem(`meldiq.paypal.sandbox.${userId}`, JSON.stringify({ draft, requestKey: crypto.randomUUID(), purchaseId: null, completed: false }));
    },
    { kind: product, userId },
  );
  await page.reload();
  return p;
}

for (const product of ["spark", "bots_plus"] as const) {
  test(`${product} is reviewed separately and only server-confirmed payment completes it`, async ({ page }, info) => {
    const p = await addonCheckout(page, product);
    await expect(page.locator(".meldiq-checkout")).toContainText(product === "spark" ? "1.98" : "3.99");
    await expect(page.getByText(/No Mojo subscription is required|purchased separately from Mojo Plus/).first()).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(page.locator("paypal-button")).toBeVisible();
    await expect(page.locator("paypal-button")).toHaveAttribute("type", product === "spark" ? "pay" : "subscribe");
    await page.locator(".checkout-brand").scrollIntoViewIfNeeded();
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

test("Spark checkout retries an interrupted SDK and uses the published legal links", async ({ page }) => {
  await addonCheckout(page, "spark");
  await page.route("https://www.paypal.com/web-sdk/v6/core", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body:
        fakeSdk +
        `
    const originalCreate = window.paypal.createInstance;
    window.paypal.createInstance = async (...args) => {
      if (!window.interruptedSdk) { window.interruptedSdk = true; throw new Error('Temporary SDK interruption'); }
      return originalCreate(...args);
    };`,
    }),
  );
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "https://meldiq.app/legal/terms");
  await expect(page.getByRole("link", { name: "payment terms" })).toHaveAttribute("href", "https://meldiq.app/legal/billing");
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("alert")).toContainText("Temporary SDK interruption");
  await page.getByRole("button", { name: "Retry checkout" }).click();
  await expect(page.locator("paypal-button")).toBeVisible();
});

test("pending Spark payment stays within the status request budget and can be checked manually", async ({ page }) => {
  const p = await addonCheckout(page, "spark");
  let reads = 0;
  await page.route(`**/v2/billing/paypal/checkouts/${p.id}`, async (route) => {
    reads++;
    await route.fulfill({ json: p });
  });
  await page.getByRole("checkbox").check();
  await expect(page.locator("paypal-button")).toBeVisible();
  await page.clock.install();
  await page.locator("paypal-button").click();
  await expect(page.getByText("Waiting for payment confirmation…")).toBeVisible();
  for (let n = 1; n <= 6; n++) {
    await page.clock.runFor(5000);
    await expect.poll(() => reads).toBe(n);
    await expect(page.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  }
  await page.clock.runFor(35000);
  expect(reads).toBeLessThan(10);
  await expect(page.getByRole("heading", { name: "Your Sparks are ready." })).toHaveCount(0);
  p.confirmed = true;
  p.status = "paid";
  await page.getByRole("button", { name: "Check payment status" }).click();
  await expect(page.getByRole("heading", { name: "Your Sparks are ready." })).toBeVisible();
});

for (const changed of ["amount", "interval"] as const) {
  test(`Spark checkout blocks a changed ${changed} before payment confirmation`, async ({ page }) => {
    const p = await addonCheckout(page, "spark");
    let confirmations = 0;
    await page.route("**/v2/billing/paypal/checkouts", (route) => route.fulfill({ json: { ...p, ...(changed === "amount" ? { amountMinor: 399 } : { interval: "month" }) } }));
    await page.route(`**/v2/billing/paypal/checkouts/${p.id}/confirm`, async (route) => {
      confirmations++;
      await route.fulfill({ json: { ...p, confirmed: true } });
    });
    await page.getByRole("checkbox").check();
    await page.locator("paypal-button").click();
    await expect(page.getByRole("alert")).toContainText("The order changed");
    expect(confirmations).toBe(0);
    await expect(page.getByRole("heading", { name: "Your Sparks are ready." })).toHaveCount(0);
  });
}
