import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, webkit } from "playwright";

const [target, output, expectedBuildId] = process.argv.slice(2);
assert(target && output && expectedBuildId, "Usage: node smoke.mjs URL OUTPUT_JSON BUILD_ID");
const local = new URL(target).hostname === "127.0.0.1";
const results = [];
for (const [name, engine, viewport] of [
  ["chromium-desktop", chromium, { width: 1440, height: 900 }],
  ["chromium-phone", chromium, { width: 393, height: 852 }],
  ["webkit-desktop", webkit, { width: 1440, height: 900 }],
]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport });
    const errors = [];
    const failedAssets = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400 && new URL(response.url()).pathname.startsWith("/_next/")) failedAssets.push(response.url());
    });
    if (local) {
      await page.route("**/config.json", (route) => route.fulfill({ json: { apiBase: "", environment: "production", publicUrl: target } }));
      await page.route("**/v1/server-info", (route) => route.fulfill({ json: { version: "0.76.1", features: [], registration: "open", accounts: { registration: true, legacyLogin: true } } }));
      await page.route("**/v2/auth/social/config", (route) => route.fulfill({ json: { providers: [], registration: true } }));
    }
    await page.goto(target, { waitUntil: "networkidle" });
    await page.locator(".landing-auth").waitFor({ state: "visible" });
    assert.equal(await page.locator("#__NEXT_DATA__").evaluate((element) => JSON.parse(element.textContent).buildId), expectedBuildId);
    assert(!(await page.locator("body").innerText()).includes("Link with your phone"), "Test linking must be disabled");
    await page.getByRole("button", { name: "Continue with email", exact: true }).click();
    await page.locator("input[type=email]").waitFor({ state: "visible" });
    assert(await page.locator("input[type=email]").isVisible(), "Sign-in email field missing");
    assert(await page.locator("input[type=password]").isVisible(), "Sign-in password field missing");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Horizontal overflow");
    assert.equal(await page.locator(".service-status-notice").count(), 0);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".landing-auth").waitFor({ state: "visible" });
    assert.deepEqual(errors, []);
    assert.deepEqual(failedAssets, []);
    results.push({ name, viewport, buildId: expectedBuildId, testLinkingDisabled: true, reloadPassed: true, pageErrors: 0, failedAssets: 0 });
  } finally {
    await browser.close();
  }
}
const report = { status: "passed", target, testedAt: new Date().toISOString(), results };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
