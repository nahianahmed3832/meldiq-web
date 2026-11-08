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
  createCardFieldsOneTimePaymentSession: () => ({ createCardFieldsComponent: ({ type }) => { const input = document.createElement('input'); input.placeholder = type; input.destroy = () => input.remove(); return input; }, submit: async orderId => { window.embeddedOrderId = orderId; return { state: 'succeeded', data: { orderId: 'UNTRUSTED-EMBEDDED-ORDER' } }; }, destroy() {} }),
  createPayPalSubscriptionPaymentSession: (callbacks) => ({ start: async (_, purchase) => { await purchase; if (window.paypalCancel) callbacks.onCancel({}); else await callbacks.onApprove({ subscriptionId: 'I-UNTRUSTED-BROWSER' }); }, destroy() {} }),
  createPayPalOneTimePaymentSession: (callbacks) => ({ start: async (_, purchase) => { await purchase; await callbacks.onApprove({ orderId: 'UNTRUSTED-BROWSER' }); }, destroy() {} })
}) };
`;
const fakeCards = `
const namespace = document.currentScript.getAttribute('data-namespace');
window[namespace] = { FUNDING: { CARD: 'card' }, Buttons: (options) => {
  let button;
  return {
    isEligible: () => window.paypalCardsEligible !== false,
    render: async (root) => {
      button = document.createElement('button');
      button.textContent = 'Debit or Credit Card';
      button.type = 'button';
      button.onclick = async () => {
        try {
          window.cardPurchaseReference = await (options.createSubscription || options.createOrder)();
          window.cardPurchaseFlow = options.createSubscription ? 'subscription' : 'order';
          if (window.paypalCardCancel) options.onCancel({});
          else await options.onApprove({ orderID: 'UNTRUSTED-CARD-ORDER', subscriptionID: 'I-UNTRUSTED-CARD' });
        } catch { options.onError(new Error('Card interrupted')); }
      };
      root.append(button);
    },
    close: async () => button?.remove()
  };
} };
`;
async function checkout(page: Page, deferred = false, yearlyAvailable = false) {
  const alice = await newPhone("paypalcheckout", "Checkout Tester");
  await alice.connect();
  await link(page, alice);
  const catalog = await (await page.request.get("/v2/mojo/catalog")).json();
  await page.route("**/v2/mojo/catalog", async (route) => {
    catalog.onSale = { mode: "live", go: null, plus: { currency: "USD", amountMinor: 499 }, spark: null, gifts: true };
    if (yearlyAvailable) catalog.plusTerms = catalog.plusTerms.map((term: { key: string }) => (term.key === "yearly" ? { ...term, available: true } : term));
    await route.fulfill({ json: catalog });
  });
  await page.route("**/v2/billing/account", (route) => route.fulfill({ json: { available: true, provider: "paypal", subscription: null, portal: false } }));
  await page.route("**/v2/billing/paypal/config", (route) =>
    route.fulfill({ json: { provider: "paypal", environment: "live", clientId: "public-live-test", billingStartAt: deferred ? Date.now() + 7 * 86400000 : null, subscriptions: true, cards: false } }),
  );
  await page.route("https://www.paypal.com/web-sdk/v6/core", (route) => route.fulfill({ contentType: "application/javascript", body: fakeSdk }));
  await page.route("https://www.paypal.com/sdk/js?**", (route) => route.fulfill({ contentType: "application/javascript", body: fakeCards }));
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
  // Checkout replaces the settings rail; the payment column must retain usable width after settings redesigns.
  await expect.poll(() => page.locator(".checkout-payment").evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(240);
  return { purchase, userId: alice.userId };
}
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});
test.skip(({ browserName }) => browserName === "firefox", "Payment review covers Chromium, Safari and phone layouts");

test("branded review, official payment control, backend-only confirmation and refresh recovery", async ({ page }, info) => {
  const { purchase: p } = await checkout(page);
  await expect(page.getByRole("heading", { name: "Order summary" })).toBeVisible();
  await expect(page.locator(".checkout-total")).toContainText("4.99");
  await expect(page.getByText("Sandbox", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No real money is taken.", { exact: false })).toHaveCount(0);
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await page.getByRole("button", { name: "Review and pay with PayPal" }).click();
  await expect(page.getByRole("radio", { name: /^PayPal/ })).toBeChecked();
  await expect(page.getByRole("checkbox")).toBeFocused();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
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

test("a saved unavailable yearly draft can switch to monthly and approve a deferred PayPal renewal", async ({ page }) => {
  const { purchase, userId } = await checkout(page, true);
  const yearly = page.getByRole("radio", { name: /^12 months/ });
  await expect(yearly).toBeDisabled();
  await expect(page.getByRole("radio", { name: /^3 months/ })).toBeDisabled();
  await page.evaluate((id) => {
    sessionStorage.setItem(`meldiq.paypal.sandbox.${id}`, JSON.stringify({ draft: { product: "plus", term: "yearly" }, requestKey: crypto.randomUUID(), purchaseId: null, completed: false }));
  }, userId);
  await page.reload();
  await expect(yearly).toBeChecked();
  await expect(page.getByText("This offer is not available for purchase yet.")).toBeVisible();
  await expect(page.locator(".checkout-total")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue · Monthly" }).click();
  await expect(page.getByRole("radio", { name: /^Monthly/ })).toBeChecked();
  await expect(page.locator(".checkout-total")).toContainText("0.00");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.route("**/v2/billing/paypal/checkouts", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ product: "plus", term: "monthly" });
    await route.fulfill({ json: purchase });
  });
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) => route.fulfill({ json: { ...purchase, approved: true } }));
  await page.getByRole("button", { name: "Review and pay with PayPal" }).click();
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect(page.getByRole("heading", { name: "Your Plus renewal is scheduled." })).toBeVisible();
});

test("an available yearly offer uses its own quote and requires consent again", async ({ page }) => {
  const { purchase } = await checkout(page, false, true);
  await page.getByRole("checkbox").check();
  await page.getByRole("radio", { name: /^12 months/ }).check();
  await expect(page.locator(".checkout-total")).toContainText("49.99");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  const yearly = { ...purchase, interval: "year", amountMinor: 4999 };
  await page.route("**/v2/billing/paypal/checkouts", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ product: "plus", term: "yearly" });
    await route.fulfill({ json: yearly });
  });
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) => route.fulfill({ json: { ...yearly, confirmed: true } }));
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect(page.getByRole("heading", { name: "Welcome to Plus." })).toBeVisible();
});

test("gift checkout reviews the recipient and starts a one-time PayPal purchase", async ({ page }) => {
  const { purchase, userId } = await checkout(page);
  const gift = { product: "gift", recipient: { kind: "email", email: "recipient@example.test" }, months: 1, note: "" };
  await page.evaluate(
    ({ userId, draft }) => {
      sessionStorage.setItem(`meldiq.paypal.sandbox.${userId}`, JSON.stringify({ draft, requestKey: crypto.randomUUID(), purchaseId: null, completed: false }));
    },
    { userId, draft: gift },
  );
  await page.route("**/v2/billing/paypal/checkouts", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject(gift);
    await route.fulfill({ json: { ...purchase, product: "gift", providerRef: "GIFT-ORDER", interval: "one_time" } });
  });
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) =>
    route.fulfill({ json: { ...purchase, product: "gift", providerRef: "GIFT-ORDER", interval: "one_time", confirmed: true } }),
  );
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Order summary" })).toContainText(gift.recipient.email);
  await page.getByRole("button", { name: "Review and pay with PayPal" }).click();
  await expect(page.getByRole("checkbox")).toBeFocused();
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await expect(page.locator("paypal-button")).toHaveAttribute("type", "pay");
  await page.locator("paypal-button").click();
  await expect(page.getByRole("heading", { name: "A little more Meldiq Plus, gifted." })).toBeVisible();
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

test("card subscription uses the owned purchase and preserves deferred Plus time", async ({ page }, info) => {
  const { purchase } = await checkout(page, true);
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await expect(page.getByRole("button", { name: "Debit or Credit Card", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox").check();
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("card-choice.png"), fullPage: true });
  await page.getByRole("button", { name: "Debit or Credit Card", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { cardPurchaseReference: string }).cardPurchaseReference)).toBe(purchase.providerRef);
  await expect(page.getByRole("heading", { name: /Welcome to Plus|Your Plus renewal is scheduled/ })).toHaveCount(0);
  await page.route("**/v2/billing/paypal/checkouts/chk_test/confirm", (route) => route.fulfill({ json: { ...purchase, approved: true } }));
  await page.getByRole("button", { name: "Debit or Credit Card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your Plus renewal is scheduled." })).toBeVisible();
});

test("ineligible cards keep PayPal available", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { paypalCardsEligible: boolean }).paypalCardsEligible = false;
  });
  await checkout(page);
  await page.getByRole("checkbox").check();
  await expect(page.locator("paypal-button")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Debit or credit card/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Debit or credit card/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Check card availability again" })).toBeVisible();
});

test("blocked card SDK keeps a visible choice, explains failure and retries without opening the wallet", async ({ page }) => {
  await checkout(page);
  await page.route("https://www.paypal.com/sdk/js?**", (route) => route.abort("blockedbyclient"));
  await page.reload();
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await page.getByRole("checkbox").check();
  await expect(page.getByText("Card checkout could not load.", { exact: false })).toBeVisible();
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.route("https://www.paypal.com/sdk/js?**", (route) => route.fulfill({ contentType: "application/javascript", body: fakeCards }));
  await page.getByRole("button", { name: "Check card availability again" }).click();
  await expect(page.getByRole("button", { name: "Debit or Credit Card", exact: true })).toBeVisible();
  await expect(page.locator("paypal-button")).toHaveCount(0);
});

test("switching payment methods removes the old payment control", async ({ page }) => {
  await checkout(page);
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Debit or Credit Card", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /^PayPal/ }).check();
  await expect(page.getByRole("button", { name: "Debit or Credit Card", exact: true })).toHaveCount(0);
  await expect(page.locator("paypal-button")).toBeVisible();
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
  test(`${product} cards use the correct flow and cancellation never grants benefits`, async ({ page }) => {
    const purchase = await addonCheckout(page, product);
    await page.getByRole("radio", { name: /Debit or credit card/ }).check();
    await page.getByRole("checkbox").check();
    await page.evaluate(() => {
      (window as unknown as { paypalCardCancel: boolean }).paypalCardCancel = true;
    });
    await page.getByRole("button", { name: "Debit or Credit Card", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("canceled");
    expect(await page.evaluate(() => (window as unknown as { cardPurchaseReference: string }).cardPurchaseReference)).toBe(purchase.providerRef);
    expect(await page.evaluate(() => (window as unknown as { cardPurchaseFlow: string }).cardPurchaseFlow)).toBe(product === "spark" ? "order" : "subscription");
    await expect(page.getByRole("heading", { name: /Your Sparks are ready|Bots\+ is active/ })).toHaveCount(0);
    await page.evaluate(() => {
      (window as unknown as { paypalCardCancel: boolean }).paypalCardCancel = false;
    });
    purchase.confirmed = true;
    purchase.status = product === "spark" ? "paid" : "active";
    await page.getByRole("button", { name: "Debit or Credit Card", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Your Sparks are ready|Bots\+ is active/ })).toBeVisible();
  });

  test(`${product} is reviewed separately and only server-confirmed payment completes it`, async ({ page }, info) => {
    const p = await addonCheckout(page, product);
    await expect(page.locator(".meldiq-checkout")).toContainText(product === "spark" ? "1.98" : "3.99");
    await expect(page.getByText(/No Meldiq Plus subscription is required|purchased separately from Meldiq Plus/).first()).toBeVisible();
    await page.getByRole("button", { name: "Review and pay with PayPal" }).click();
    await expect(page.getByRole("checkbox")).toBeFocused();
    await expect(page.locator("paypal-button")).toHaveCount(0);
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

test("an expired Plus attempt can start a new owned checkout instead of reusing its dead reference", async ({ page }) => {
  const { purchase } = await checkout(page);
  const keys: string[] = [];
  await page.route("**/v2/billing/paypal/checkouts", async (route) => {
    keys.push(route.request().postDataJSON().requestKey);
    await route.fulfill({ json: keys.length === 1 ? purchase : { ...purchase, id: "chk_replacement", providerRef: "I-REPLACEMENT" } });
  });
  await page.route("**/v2/billing/paypal/checkouts/chk_replacement/confirm", (route) => route.fulfill({ json: { ...purchase, id: "chk_replacement", providerRef: "I-REPLACEMENT" } }));
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect(page.getByRole("button", { name: "Check purchase status" })).toBeVisible();
  await page.route("**/v2/billing/paypal/checkouts/chk_test", (route) => route.fulfill({ json: { ...purchase, status: "incomplete_expired" } }));
  await page.getByRole("button", { name: "Check purchase status" }).click();
  await expect(page.locator("paypal-button")).toHaveCount(0);
  await page.getByRole("button", { name: "Start a new checkout" }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.locator("paypal-button").click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test("gift history creates private links only on request and shows queued credit honestly", async ({ page }) => {
  const phone = await newPhone("gifthistory", "Gift Tester");
  await phone.connect();
  await link(page, phone);
  const gift = {
    id: "gft_sent",
    product: "plus",
    months: 3,
    note: "Happy birthday",
    status: "awaiting_recipient",
    currency: "USD",
    amountMinor: 1197,
    sender: "Checkout Tester",
    recipientUserId: null,
    recipientKind: "link",
    recipientEmail: null,
    createdAt: Date.now(),
    paidAt: Date.now(),
    redeemedAt: null,
    expiresAt: Date.now() + 86400000,
    credited: false,
  };
  let shares = 0;
  await page.route("**/v2/billing/gifts", (route) => route.fulfill({ json: { sent: [gift], received: [{ ...gift, id: "gft_received", status: "redeemed", credited: true }] } }));
  await page.route("**/v2/billing/gifts/gft_sent/link", (route) => {
    shares++;
    return route.fulfill({ json: { giftId: gift.id, url: "https://web.meldiq.app/settings/gifts#gift=" + "a".repeat(43), expiresAt: gift.expiresAt } });
  });
  await page.goto("/settings/gifts");
  await expect(page.getByRole("heading", { name: "Gifts", exact: true })).toBeVisible();
  await expect(page.getByText("Credit saved · waiting for your current renewal to end")).toBeVisible();
  expect(shares).toBe(0);
  await page.getByRole("button", { name: "Create gift link", exact: true }).click();
  await expect(page.getByLabel("Private gift link")).toHaveValue(/#gift=/);
  expect(shares).toBe(1);
});

test("gift fragment previews without redeeming and explicitly redeems once", async ({ page }) => {
  const phone = await newPhone("giftclaim", "Gift Tester");
  await phone.connect();
  await link(page, phone);
  const token = "a".repeat(43);
  let claims = 0;
  await page.route("**/v2/billing/gifts", (route) => route.fulfill({ json: { sent: [], received: [] } }));
  await page.route("**/v2/billing/gifts/preview", (route) => {
    expect(route.request().postDataJSON()).toEqual({ token });
    return route.fulfill({ json: { id: "gft_link", product: "plus", months: 1, note: "Enjoy!", sender: "A friend", status: "paid", requiresVerifiedEmail: false, expiresAt: Date.now() + 86400000 } });
  });
  await page.route("**/v2/billing/gifts/redeem", (route) => {
    claims++;
    expect(route.request().postDataJSON()).toEqual({ token });
    return route.fulfill({ json: { credited: true, startsAt: null, endsAt: null } });
  });
  await page.goto(`/settings/gifts#gift=${token}`);
  await expect(page.getByRole("heading", { name: "A gift for you" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Redeem gift", exact: true })).toBeVisible();
  expect(claims).toBe(0);
  await page.getByRole("button", { name: "Redeem gift", exact: true }).click();
  await expect(page.getByText("Gift credit saved.", { exact: false })).toBeVisible();
  expect(claims).toBe(1);
  expect(new URL(page.url()).hash).toBe("");
});

test("embedded one-time fields keep confirmation on the stored server purchase", async ({ page }) => {
  const p = await addonCheckout(page, "spark");
  await page.route("**/v2/billing/paypal/config", (route) =>
    route.fulfill({
      json: {
        provider: "paypal",
        environment: "live",
        clientId: "public-live-test",
        subscriptions: true,
        sparks: true,
        cards: false,
        advancedCards: { oneTime: true, vault: false, recurring: false, merchantCountry: "CN", productionApproved: true, reason: null },
      },
    }),
  );
  let confirmations = 0;
  await page.route(`**/v2/billing/paypal/checkouts/${p.id}/confirm`, (route) => {
    confirmations++;
    return route.fulfill({ json: { ...p, confirmed: true, status: "paid" } });
  });
  await page.reload();
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await page.locator(".checkout-agreement input").check();
  await page.getByLabel("Billing country").selectOption("US");
  const nameField = page.locator(".checkout-hosted-field input").first();
  await nameField.fill("Locale Test");
  const originalField = await nameField.elementHandle();
  for (const locale of ["العربية", "English"]) {
    await page.locator("button.lang-picker").click();
    await page.getByRole("option", { name: locale, exact: true }).click();
    await expect(page.locator(".language-dialog")).toHaveCount(0);
    expect(await originalField!.evaluate((element) => element === document.querySelector(".checkout-hosted-field input"))).toBe(true);
    await expect(nameField).toHaveValue("Locale Test");
    await expect(nameField).toHaveAttribute("lang", locale === "العربية" ? "ar" : "en");
  }
  await expect(page.getByLabel("Billing country")).toHaveValue("US");
  await page.getByRole("button", { name: "Complete purchase", exact: true }).click();
  await expect.poll(() => confirmations).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { embeddedOrderId: string }).embeddedOrderId)).toBe(p.providerRef);
});

test("saved-card subscription requires separate recurring consent and an owned method", async ({ page }) => {
  await checkout(page);
  await page.route("**/v2/billing/paypal/config", (route) =>
    route.fulfill({
      json: {
        provider: "paypal",
        environment: "live",
        clientId: "public-live-test",
        subscriptions: true,
        cards: false,
        advancedCards: { oneTime: true, vault: true, recurring: true, merchantCountry: "CN", productionApproved: true, reason: null },
      },
    }),
  );
  await page.route("**/v2/billing/payment-methods", (route) =>
    route.fulfill({ json: { available: true, methods: [{ id: "pm_owned", brand: "VISA", lastFour: "1111", expiry: "2030-12", createdAt: Date.now() }] } }),
  );
  await page.route("**/v2/billing/card-subscriptions/quote?product=plus", (route) =>
    route.fulfill({ json: { consentVersion: "consent-v1", amountMinor: 399, currency: "USD", firstBillingAt: Date.now() } }),
  );
  let starts = 0;
  await page.route("**/v2/billing/card-subscriptions", (route) => {
    starts++;
    expect(route.request().postDataJSON()).toMatchObject({ product: "plus", paymentMethodId: "pm_owned", consentVersion: "consent-v1", acceptRecurring: true });
    expect(route.request().postDataJSON()).not.toHaveProperty("amountMinor");
    return route.fulfill({
      json: {
        id: "cm_owned",
        orgId: null,
        product: "plus",
        paymentMethodId: "pm_owned",
        status: "active",
        currency: "USD",
        amountMinor: 399,
        nextBillingAt: Date.now() + 2592000000,
        paidThrough: Date.now() + 2592000000,
        cancelAt: null,
        processing: false,
      },
    });
  });
  await page.reload();
  await page.getByRole("radio", { name: /Debit or credit card/ }).check();
  await page.locator(".checkout-agreement input").check();
  await page.getByLabel("Choose your saved card").selectOption("pm_owned");
  await expect(page.getByRole("button", { name: "Subscribe with card", exact: true })).toBeDisabled();
  expect(starts).toBe(0);
  await page.getByRole("checkbox", { name: /I authorize Meldiq/ }).check();
  await page.getByRole("button", { name: "Subscribe with card", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment confirmed", exact: true })).toBeVisible();
  expect(starts).toBe(1);
});
