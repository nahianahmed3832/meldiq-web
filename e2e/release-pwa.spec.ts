import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { numericConversationPath } from "../src/application/conversationPaths";
import { emailedCode } from "./mail";
import { newPhone, testAddress, type Phone } from "./phone";
import { expectSignedOut } from "./link";
import { finishWelcome } from "./welcome";

test.skip(process.env.ORBIT_E2E_RELEASE !== "1", "Requires the verified previous export and a production candidate with test linking disabled.");
test.use({ serviceWorkers: "allow", trace: "off", screenshot: "off", video: "off" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
const fixture = () => process.env.ORBIT_E2E_RELEASE_FIXTURE!;
function serve(release: "previous" | "candidate") {
  const next = path.join(fixture(), `next-${crypto.randomUUID()}`);
  fs.symlinkSync(path.join(fixture(), release), next, "dir");
  fs.renameSync(next, path.join(fixture(), "current"));
}
const buildId = (page: Page) => page.evaluate(() => (window as unknown as { __NEXT_DATA__: { buildId: string } }).__NEXT_DATA__.buildId);
const online = (page: Page) => expect(page.locator(".app[data-connection=online]").first()).toBeVisible({ timeout: 30_000 });
async function controlled(page: Page) {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js") ?? false)).toBe(true);
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active)).toBe(true);
}
async function createAccount(page: Page, name: string) {
  const email = `release.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Having trouble signing in?", exact: true }).click();
  await expect(page.getByRole("button", { name: /Link with your phone instead/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Disposable release check password");
  await page.getByLabel("I am 13 or older. I agree to the Terms and acknowledge the Privacy.", { exact: true }).check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  const me = page.waitForResponse((response) => new URL(response.url()).pathname === "/v1/users/me" && response.ok());
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  const userId = (await (await me).json()).user.id as string;
  await finishWelcome(page);
  await online(page);
  return userId;
}
async function go(page: Page, href: string) {
  await page.evaluate((target) => {
    const a = document.createElement("a");
    a.href = target;
    document.body.append(a);
    a.click();
    a.remove();
  }, href);
  await expect(page).toHaveURL(href);
}
async function saveIncoming(page: Page, peer: Phone, userId: string, text: string) {
  const cid = (await peer.req("POST", "/v1/conversations/dm", { userId })).conversation.id as string;
  await peer.send(cid, { type: "text", text });
  await go(page, numericConversationPath("dms", cid));
  const row = page.locator(".msg").filter({ hasText: text });
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Save for later", exact: true }).click();
  await go(page, "/later");
  await expect(page.locator(".later-open").filter({ hasText: text })).toBeVisible();
  return cid;
}
async function collection(page: Page, name: string) {
  await page.getByRole("button", { name: "New collection", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Collection name").fill(name);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Organize in collections").selectOption({ label: `Add to ${name}` });
  await expect(page.getByLabel("Organize in collections").locator("option", { hasText: `Remove from ${name}` })).toHaveCount(1);
  await page.getByRole("combobox", { name: "Collections", exact: true }).selectOption({ label: name });
}
async function choose(page: Page, name: string) {
  await page.getByRole("button", { name: "Account options", exact: true }).click();
  await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("menuitemradio", { name: new RegExp(name) }).click()]);
  await online(page);
}
async function appDatabases(page: Page) {
  return page.evaluate(async () =>
    (await indexedDB.databases())
      .map((db) => db.name!)
      .filter((name) => name.startsWith("orbit-web"))
      .sort(),
  );
}
async function cacheBoundaries(page: Page) {
  const safe = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names)
      for (const request of await (await caches.open(name)).keys()) {
        const u = new URL(request.url);
        if (u.search || /^\/v[123]\//.test(u.pathname) || u.pathname === "/config.json") return false;
      }
    return names.includes("meldiq-shell-v1") && names.includes("meldiq-assets-v1");
  });
  expect(safe).toBe(true);
}

test("production worker controls fresh and returning visits, retry, Saved views and account logout", async ({ page, context }) => {
  test.setTimeout(240_000);
  serve("candidate");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/");
  const aliceId = await createAccount(page, "PWA Alice");
  await controlled(page);
  const aliceDatabases = await appDatabases(page);
  expect(aliceDatabases).toHaveLength(1);
  const peer = await newPhone("releasepeer", "Release Friend");
  await peer.connect();
  try {
    const cid = await saveIncoming(page, peer, aliceId, "Alice private checklist");
    await collection(page, "Alice follow-ups");
    const query = page.getByRole("searchbox", { name: "Search saved messages" });
    await query.fill("checklist");
    await expect(page.getByText("Filters stay with this account on this browser.")).toBeVisible();
    await page.reload();
    await controlled(page);
    await expect(query).toHaveValue("checklist");
    await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option:checked")).toHaveText("Alice follow-ups");
    await page.locator(".later-open").click();
    await expect(page).toHaveURL(numericConversationPath("dms", cid));
    await page.goBack();
    await expect(query).toHaveValue("checklist");
    // Real connection loss: a failed collection edit keeps its entered text, then succeeds on explicit retry.
    await page.getByRole("button", { name: "Rename collection", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Collection name").fill("Alice reviewed");
    await context.setOffline(true);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByLabel("Collection name")).toHaveValue("Alice reviewed");
    await context.setOffline(false);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option:checked")).toHaveText("Alice reviewed");
    await go(page, "/friends");
    await page.locator(".experience-heading").getByRole("button", { name: "New message", exact: true }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Find people" }).fill(peer.username);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Release Friend/ })
      .click();
    await expect(page).toHaveURL(numericConversationPath("dms", cid));
    await context.setOffline(true);
    const composer = page.locator(".composer textarea");
    await composer.fill("Queued release check");
    await page.locator(".composer").getByRole("button", { name: "Send", exact: true }).click();
    const pending = page.locator(".msg").filter({ hasText: "Queued release check" });
    await expect(pending).toHaveCount(1);
    await expect(pending.locator('[aria-label="Sending"]')).toBeVisible();
    expect(peer.received.filter((m) => m.payload.text === "Queued release check")).toHaveLength(0);
    await context.setOffline(false);
    await online(page);
    await expect.poll(() => peer.received.filter((m) => m.payload.text === "Queued release check").length, { timeout: 30_000 }).toBe(1);
    await expect(pending.locator('[aria-label="Sending"]')).toHaveCount(0);
    await page.reload();
    await expect(pending).toHaveCount(1);
    const rows = (await peer.req("GET", `/v2/conversations/${cid}/messages`)).messages;
    expect(rows.filter((m: { payload?: { text?: string } }) => m.payload?.text === "Queued release check")).toHaveLength(1);
    // Returning while offline uses cached shell/assets and this account's local messages.
    await context.setOffline(true);
    await page.reload();
    await controlled(page);
    await expect(page.getByRole("log", { name: "Messages" })).toContainText("Alice private checklist");
    await context.setOffline(false);
    await online(page);
    await page.getByRole("button", { name: "Account options", exact: true }).click();
    await page.getByRole("menuitem", { name: "Add account", exact: true }).click();
    const bobId = await createAccount(page, "PWA Bob");
    await go(page, "/later");
    await expect(query).toHaveValue("");
    await expect(page.locator(".later-view")).not.toContainText("Alice private checklist");
    await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option", { hasText: "Alice reviewed" })).toHaveCount(0);
    const bobCid = await saveIncoming(page, peer, bobId, "Bob private reminder");
    await query.fill("reminder");
    await expect(page.getByText("Filters stay with this account on this browser.")).toBeVisible();
    await choose(page, "PWA Alice");
    await go(page, "/later");
    await expect(query).toHaveValue("checklist");
    await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option:checked")).toHaveText("Alice reviewed");
    await expect(page.locator(".later-view")).not.toContainText("Bob private reminder");
    await page.goto("/settings/you");
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("dialog", { name: "Log out of Meldiq?" }).getByRole("button", { name: "Log out", exact: true }).click()]);
    await online(page);
    await expect.poll(() => appDatabases(page)).not.toContain(aliceDatabases[0]);
    await go(page, "/later");
    await expect(query).toHaveValue("reminder");
    await expect(page.locator(".later-view")).not.toContainText("Alice private checklist");
    await page.reload();
    await controlled(page);
    await expect(query).toHaveValue("reminder");
    await go(page, numericConversationPath("dms", bobCid));
    await expect(page.getByRole("log", { name: "Messages" })).toContainText("Bob private reminder");
    await cacheBoundaries(page);
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await peer.disconnect();
  }
});

test("the real previous release upgrades at the same origin with retained account and worker storage", async ({ page, context }) => {
  test.setTimeout(180_000);
  serve("previous");
  const verification = JSON.parse(fs.readFileSync(path.join(fixture(), "verified.json"), "utf8"));
  const errors: string[] = [];
  const badAssets: number[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  context.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/_next/static/") && response.status() >= 400) badAssets.push(response.status());
  });
  await page.clock.install();
  await page.goto("/");
  expect(await buildId(page)).toBe(verification.previousBuildId);
  const origin = new URL(page.url()).origin;
  const userId = await createAccount(page, "Upgrade Check");
  const peer = await newPhone("upgradepeer", "Upgrade Friend");
  const cid = await saveIncoming(page, peer, userId, "Saved before the upgrade");
  await collection(page, "Upgrade collection");
  await controlled(page);
  await page.reload();
  await expect(page.locator(".later-open").filter({ hasText: "Saved before the upgrade" })).toBeVisible();
  const beforeDatabases = await appDatabases(page);
  const beforeCacheNames = await page.evaluate(() => caches.keys());
  const marker = crypto.randomUUID();
  await page.evaluate((value) => sessionStorage.setItem("release-profile-continuity", value), marker);
  serve("candidate"); // Only the server's release link changes. No cache deletion, worker unregister or new context.
  await page.clock.fastForward(31_000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const notice = page.getByRole("status").filter({ hasText: "A new version of Meldiq is ready." });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Reload", exact: true }).click();
  const candidateHtml = fs.readFileSync(path.join(fixture(), "candidate", "index.html"), "utf8");
  const candidateBuild = /"buildId"\s*:\s*"([^"]+)"/.exec(candidateHtml)![1];
  await expect.poll(() => buildId(page)).toBe(candidateBuild);
  expect(candidateBuild).not.toBe(verification.previousBuildId);
  expect(new URL(page.url()).origin).toBe(origin);
  expect(await page.evaluate(() => sessionStorage.getItem("release-profile-continuity"))).toBe(marker);
  expect(await appDatabases(page)).toEqual(beforeDatabases);
  expect(await page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(beforeCacheNames));
  await controlled(page);
  await expect(page.getByText("Keep useful messages close. Find them here when you’re ready to follow up.")).toBeVisible();
  await page.getByRole("combobox", { name: "Collections", exact: true }).selectOption({ label: "Upgrade collection" });
  const query = page.getByRole("searchbox", { name: "Search saved messages" });
  await query.fill("upgrade");
  await expect(page.getByText("Filters stay with this account on this browser.")).toBeVisible();
  await page.locator(".later-open").click();
  await expect(page).toHaveURL(numericConversationPath("dms", cid));
  await page.goBack();
  await expect(query).toHaveValue("upgrade");
  await page.reload();
  await expect(query).toHaveValue("upgrade");
  await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option:checked")).toHaveText("Upgrade collection");
  await expect(page.locator(".later-open").filter({ hasText: "Saved before the upgrade" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(badAssets).toEqual([]);
  await cacheBoundaries(page);
});
