/** Public-client-ID-only SDK compatibility check. No order, subscription, or payment is created. */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
const envFile = process.argv[2];
if (!envFile) throw new Error("Pass the private Sandbox environment file path");
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
if (env.PAYPAL_ENVIRONMENT !== "sandbox") throw new Error("Sandbox only");
const source = readFileSync(new URL("../deploy/nginx/meldiq-web-paypal-sandbox-headers.conf.template", import.meta.url), "utf8");
const csp = source
  .match(/add_header Content-Security-Policy "(.*)" always;/)[1]
  .replaceAll("${WEB_HOST}", "localhost")
  .replaceAll("${CONNECT_EXTRA}", "")
  .replace("; upgrade-insecure-requests", "");
const server = createServer((_req, res) =>
  res
    .writeHead(200, { "content-type": "text/html", "content-security-policy": csp, "cross-origin-opener-policy": "same-origin-allow-popups" })
    .end('<!doctype html><html><body><main id="button"></main></body></html>'),
);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(() => {
    window.violations = [];
    addEventListener("securitypolicyviolation", (e) => window.violations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
  });
  await page.addScriptTag({ url: "https://www.sandbox.paypal.com/web-sdk/v6/core" });
  const result = await page.evaluate(async (clientId) => {
    const sdk = await window.paypal.createInstance({ clientId, components: ["paypal-payments", "paypal-subscriptions"], pageType: "checkout" });
    const eligibility = await sdk.findEligibleMethods({ currencyCode: "USD" });
    const button = document.createElement("paypal-button");
    button.setAttribute("type", "subscribe");
    button.setAttribute("class", "paypal-gold");
    document.getElementById("button").append(button);
    return {
      sdkVersion: window.paypal.version,
      oneTimeSessionSupported: typeof sdk.createPayPalOneTimePaymentSession === "function",
      subscriptionSessionSupported: typeof sdk.createPayPalSubscriptionPaymentSession === "function",
      paypalEligible: eligibility.isEligible("paypal"),
      advancedCardsEligible: eligibility.isEligible("advanced_cards"),
      violations: window.violations,
    };
  }, env.PAYPAL_CLIENT_ID);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
