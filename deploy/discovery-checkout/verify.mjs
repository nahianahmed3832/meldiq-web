import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, webkit } from "playwright";

const origin = process.argv[2];
const output = process.argv[3];
const expectedBuild = process.argv[4];
const results = [];
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("meldiq.introSeen", "1"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (origin.startsWith("http://127.0.0.1")) {
    await page.route("**/config.json", (route) => route.fulfill({ json: { apiBase: "", environment: "production" } }));
    await page.route(/\/v[12]\//, async (route) => {
      assert.equal(route.request().method(), "GET");
      const path = new URL(route.request().url()).pathname;
      const response = await context.request.get("https://web.meldiq.app" + path);
      await route.fulfill({ response });
    });
  }
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => window.__NEXT_DATA__.buildId), expectedBuild);
  await page.getByRole("heading", { name: /^Sign in (?:to Meldiq|with email)$/ }).waitFor();
  await page.getByRole("button", { name: /Google/ }).waitFor();
  assert.deepEqual(errors, []);
  await page.getByRole("button", { name: "Having trouble signing in?" }).click();
  assert.equal(await page.getByRole("button", { name: /Link with your phone instead/ }).count(), 0);
  for (const [width, height, bare] of [
    [1440, 900, false],
    [820, 900, false],
    [390, 844, false],
    [390, 844, true],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate((bare) => {
      document.querySelector("#layout-probe")?.remove();
      const shell = document.createElement("div");
      shell.id = "layout-probe";
      shell.className = "app" + (bare ? " phone-bare" : "");
      shell.innerHTML =
        '<div class="brandbar">Meldiq</div><nav class="rail"></nav><div class="workspace"><header class="topbar">Messages</header><div style="padding:6px 14px;display:flex;justify-content:flex-end"><button class="btn btn-ghost btn-sm">Service inbox</button></div><div class="body"><section class="main">Friends</section></div></div>';
      document.body.append(shell);
    }, bare);
    const geometry = await page.locator("#layout-probe .workspace").evaluate((workspace) => {
      const [topbar, bar, body] = [...workspace.children].map((el) => el.getBoundingClientRect());
      return { workspace: workspace.clientHeight, topbar: topbar.height, bar: bar.height, body: body.height, gap: body.y - bar.bottom };
    });
    assert(geometry.bar <= 60);
    assert(geometry.body > geometry.workspace * 0.7);
    assert(Math.abs(geometry.gap) <= 1);
    results.push({ browser: name, width, height, bare, ...geometry });
  }
  await browser.close();
}
await fs.writeFile(output, JSON.stringify({ ok: true, buildId: expectedBuild, results }, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, buildId: expectedBuild, checks: results.length }));
