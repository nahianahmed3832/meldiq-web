import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
import { numericConversationPath } from "../src/application/conversationPaths";

// Network fault injection must reach page.route in WebKit as well as Chromium.
test.use({ serviceWorkers: "block" });

async function go(page: Page, path: string) {
  await page.evaluate((href) => {
    const a = document.createElement("a");
    a.href = href;
    document.body.append(a);
    a.click();
    a.remove();
  }, path);
  await expect(page).toHaveURL(path);
}

async function fixture(page: Page) {
  const alice = await newPhone("refresh", "Asha Patel");
  const bob = await newPhone("refreshpeer", "Nila Roy");
  const conversationId = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const messageId = randomUUID();
  await alice.send(conversationId, { type: "text", text: "Review the launch checklist before our next conversation." }, "message", messageId);
  const personal = await alice.req("GET", "/v1/me/preferences/personal");
  await alice.req("PUT", "/v1/me/preferences/personal", { baseRev: personal.rev, prefs: { saved: [{ conversationId, messageId, savedAt: Date.now() }] } });
  await link(page, alice);
  await go(page, numericConversationPath("dms", conversationId));
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Review the launch checklist");
  return { alice, bob, conversationId, messageId };
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

async function savedView(page: Page) {
  await expect(page.getByText("Filters stay with this account on this browser.")).toBeVisible();
}

async function checkChangedContrast(page: Page) {
  const pairs = await page
    .locator(".experience-heading h1, .experience-heading p, .saved-filters label, .saved-filters .input, .saved-result-count, .later-text, .later-open small")
    .evaluateAll((elements) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      const rgba = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].map((n, i) => (i === 3 ? n / 255 : n));
      };
      const over = (fg: number[], bg: number[]) =>
        fg
          .slice(0, 3)
          .map((n, i) => n * fg[3] + bg[i] * (1 - fg[3]))
          .concat(1);
      const luminance = (color: number[]) =>
        color
          .slice(0, 3)
          .map((n) => n / 255)
          .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
          .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const contrast = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
      return elements.map((el) => {
        const ancestors = [];
        let parent: Element | null = el;
        while (parent) {
          ancestors.unshift(parent);
          parent = parent.parentElement;
        }
        const bg = ancestors.reduce((color, element) => over(rgba(getComputedStyle(element).backgroundColor), color), [255, 255, 255, 1]);
        const css = getComputedStyle(el);
        return {
          text: el.textContent?.slice(0, 45) || el.tagName,
          ratio: contrast(over(rgba(css.color), bg), bg),
          border: el.matches(".input") ? contrast(rgba(css.borderTopColor), bg) : null,
          placeholder: el.matches("input[placeholder]") ? contrast(over(rgba(getComputedStyle(el, "::placeholder").color), bg), bg) : null,
        };
      });
    });
  for (const pair of pairs) {
    expect(pair.ratio, `${pair.text}: text contrast`).toBeGreaterThanOrEqual(4.5);
    if (pair.border !== null) expect(pair.border, `${pair.text}: input boundary contrast`).toBeGreaterThanOrEqual(3);
    if (pair.placeholder !== null) expect(pair.placeholder, `${pair.text}: placeholder contrast`).toBeGreaterThanOrEqual(4.5);
  }
}

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("starts a real message and returns to the same saved view after Back and reload", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { bob, conversationId } = await fixture(page);
  await go(page, "/activity");
  await page.getByRole("button", { name: "Turn on activity history" }).click();
  await go(page, numericConversationPath("dms", conversationId));
  await go(page, "/friends");
  await expect(page.getByRole("heading", { name: "Continue where you left off" })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `docs/design/web-refresh/after-friends-${info.project.name}.png`, animations: "disabled" });
  const start = page.locator(".experience-heading").getByRole("button", { name: "New message", exact: true });
  await start.focus();
  await page.keyboard.press("Enter");
  const newMessage = page.getByRole("dialog", { name: "New message", exact: true });
  await expect(newMessage.getByRole("textbox", { name: "Find people" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(start).toBeFocused();
  await start.click();
  await newMessage.getByRole("textbox", { name: "Find people" }).fill(bob.username);
  await newMessage.getByRole("button", { name: /Nila Roy/ }).click();
  await expect(page).toHaveURL(numericConversationPath("dms", conversationId));
  await bob.connect();
  try {
    await page.locator(".composer textarea").fill("Ready to follow up from Meldiq.");
    await page.locator(".composer").getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => bob.received.some((m) => m.payload.text === "Ready to follow up from Meldiq.")).toBe(true);
  } finally {
    await bob.disconnect();
  }
  await go(page, "/later");
  await page.getByRole("button", { name: "New collection", exact: true }).click();
  await page.getByLabel("Collection name").fill("Launch notes");
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Organize in collections").selectOption({ label: "Add to Launch notes" });
  await expect(page.getByLabel("Organize in collections").locator("option", { hasText: "Remove from Launch notes" })).toHaveCount(1);
  const collection = page.getByRole("combobox", { name: "Collections", exact: true });
  await collection.selectOption({ label: "Launch notes" });
  const query = page.getByRole("searchbox", { name: "Search saved messages" });
  await query.fill("checklist");
  await savedView(page);
  await expect(page.getByRole("button", { name: /Review the launch checklist/ })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: `docs/design/web-refresh/after-later-${info.project.name}.png`, animations: "disabled" });
  await page.getByRole("button", { name: /Review the launch checklist/ }).click();
  await expect(page).toHaveURL(numericConversationPath("dms", conversationId));
  await page.goBack();
  await expect(page).toHaveURL("/later");
  await expect(query).toHaveValue("checklist");
  await expect(collection.locator("option:checked")).toHaveText("Launch notes");
  await page.reload();
  await expect(query).toHaveValue("checklist");
  await expect(collection.locator("option:checked")).toHaveText("Launch notes");
  await query.fill("no matching text");
  await expect(page.getByRole("heading", { name: "No saved messages match these filters." })).toBeVisible();
  await page.locator(".saved-empty").getByRole("button", { name: "Clear filters" }).click();
  await expect(query).toBeFocused();
  await expect(query).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Show", exact: true })).toHaveValue("all");
  await expect(collection).toHaveValue("");
  const saved = page.getByRole("tab", { name: /^Saved/ });
  await saved.focus();
  await saved.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^Reminders/ })).toBeFocused();
  await expect(page.getByRole("tab", { name: /^Reminders/ })).toHaveAttribute("aria-selected", "true");
  await savedView(page);
  await page.reload();
  await expect(page.getByRole("tab", { name: /^Reminders/ })).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("keeps collection edits after refusal, rejects deleted selection and recovers loading errors", async ({ page }, info) => {
  const { alice, messageId } = await fixture(page);
  await go(page, "/later");
  let rejectSave = true;
  let createRequests = 0;
  await page.route("**/v2/me/saved-collections", async (route) => {
    if (route.request().method() === "POST" && route.request().postDataJSON().op === "create") createRequests++;
    if (route.request().method() === "POST" && rejectSave) return route.fulfill({ status: 503, json: { error: "unavailable", message: "Collection service unavailable. Try again." } });
    await route.continue();
  });
  const create = page.getByRole("button", { name: "New collection", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog", { name: "New collection" });
  await dialog.getByLabel("Collection name").fill("Keep my draft");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Collection name")).toHaveValue("Keep my draft");
  rejectSave = false;
  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(dialog).toHaveCount(0);
  expect(createRequests).toBe(2); // One refused attempt, then one successful attempt despite the duplicate submit.
  await expect(create).toBeFocused();
  await page.getByLabel("Organize in collections").selectOption({ label: "Add to Keep my draft" });
  const select = page.getByRole("combobox", { name: "Collections", exact: true });
  await select.selectOption({ label: "Keep my draft" });
  await savedView(page);
  const data = await alice.req("GET", "/v2/me/saved-collections");
  const chosen = data.collections.find((c: { name: string }) => c.name === "Keep my draft");
  expect(chosen.messageIds).toContain(messageId);
  await alice.req("POST", "/v2/me/saved-collections", { op: "delete", id: chosen.id });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Collection unavailable" })).toBeVisible();
  await expect(page.locator(".saved-results")).toHaveCount(0);
  await page.getByRole("button", { name: "All saved messages", exact: true }).click();
  await expect(page.getByRole("button", { name: /Review the launch checklist/ })).toBeVisible();
  await page.unroute("**/v2/me/saved-collections");
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/v2/me/saved-collections", async (route) => {
    await pending;
    await route.fulfill({ status: 503, json: { error: "unavailable", message: "Collections are unavailable. Try again." } });
  });
  await page.reload();
  await expect(page.locator(".saved-panel .saved-loading")).toBeVisible();
  await expect(create).toBeDisabled();
  await page.screenshot({ path: info.outputPath("collections-loading.png"), animations: "disabled" });
  release();
  await expect(page.locator(".saved-panel").getByRole("alert")).toBeVisible();
  await page.screenshot({ path: info.outputPath("collection-error.png"), animations: "disabled" });
  await page.unroute("**/v2/me/saved-collections");
  await page.locator(".saved-panel").getByRole("button", { name: "Try again" }).click();
  await expect(create).toBeEnabled();
  await expect(page.locator(".saved-panel").getByRole("alert")).toHaveCount(0);
});

test("keeps filters usable when browser persistence fails and saves them after retry", async ({ page }) => {
  await fixture(page);
  await go(page, "/later");
  await savedView(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (key === "laterView") throw new DOMException("Storage is full", "QuotaExceededError");
      return original.call(this, value, key);
    };
    (window as typeof window & { restoreLaterStorage: () => void }).restoreLaterStorage = () => {
      IDBObjectStore.prototype.put = original;
    };
  });
  const query = page.getByRole("searchbox", { name: "Search saved messages" });
  await query.fill("checklist");
  await expect(page.getByRole("alert")).toContainText("Your filters couldn’t be saved");
  await expect(query).toHaveValue("checklist");
  await expect(page.getByRole("button", { name: /Review the launch checklist/ })).toBeVisible();
  await page.evaluate(() => (window as typeof window & { restoreLaterStorage: () => void }).restoreLaterStorage());
  await page.getByRole("alert").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await savedView(page);
  await page.reload();
  await expect(query).toHaveValue("checklist");
});

test("shows honest first use and remains usable across themes and narrow keyboard space", async ({ page }, info) => {
  const alice = await newPhone("refreshempty", "First Visit");
  await link(page, alice);
  await go(page, "/friends");
  await expect(page.getByRole("heading", { name: "Continue where you left off" })).toHaveCount(0);
  await page.screenshot({ path: `docs/design/web-refresh/after-first-use-${info.project.name}.png`, animations: "disabled" });
  await page.locator(".experience-heading").getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Nothing saved" })).toBeVisible();
  await page.locator(".saved-empty").getByRole("button", { name: "Search Meldiq" }).click();
  await expect(page.getByRole("dialog", { name: "Search", exact: true }).getByRole("combobox", { name: "Search", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  const bob = await newPhone("themepreview", "Nila Roy");
  const cid = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  const mid = randomUUID();
  await alice.send(cid, { type: "text", text: "A saved message ready for our next conversation." }, "message", mid);
  const prefs = await alice.req("GET", "/v1/me/preferences/personal");
  await alice.req("PUT", "/v1/me/preferences/personal", { baseRev: prefs.rev, prefs: { saved: [{ conversationId: cid, messageId: mid, savedAt: Date.now() }] } });
  await go(page, numericConversationPath("dms", cid));
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("A saved message ready");
  await go(page, "/later");
  await expect(page.getByRole("button", { name: /A saved message ready/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const palette of ["meldiq", "midnight", "charcoal", "indigo", "plum", "amber"]) {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        ({ palette, theme }) => {
          document.documentElement.dataset.palette = palette;
          document.documentElement.dataset.theme = theme;
        },
        { palette, theme },
      );
      await expect(page.getByRole("heading", { name: "Later", exact: true })).toBeVisible();
      await noOverflow(page);
      await checkChangedContrast(page);
      await page.locator(".later-view .scroll").evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: `docs/design/web-refresh/theme-${palette}-${theme}-${info.project.name}.png`, animations: "disabled" });
    }
  }
  await page.setViewportSize({ width: 320, height: 480 });
  await noOverflow(page);
  const create = page.getByRole("button", { name: "New collection", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog", { name: "New collection" });
  await dialog.getByLabel("Collection name").fill("A collection with a long name on a narrow screen");
  await noOverflow(page);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
});

test("does not expose saved message content after conversation access is removed", async ({ page }) => {
  const { alice, bob } = await fixture(page);
  await bob.req("PUT", "/v1/users/me/messaging", { groupAddPolicy: "everyone" });
  const group = (await alice.req("POST", "/v1/conversations/group", { name: "Private follow-up", memberIds: [bob.userId] })).conversation;
  const messageId = randomUUID();
  await alice.send(group.id, { type: "text", text: "Private content must disappear when access ends" }, "message", messageId);
  const prefs = await alice.req("GET", "/v1/me/preferences/personal");
  await alice.req("PUT", "/v1/me/preferences/personal", { baseRev: prefs.rev, prefs: { saved: [{ conversationId: group.id, messageId, savedAt: Date.now() }] } });
  await go(page, numericConversationPath("dms", group.id));
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Private content must disappear");
  await go(page, "/later");
  await expect(page.getByRole("button", { name: /Private content must disappear/ })).toBeVisible();
  await alice.req("DELETE", `/v1/conversations/${group.id}/members/${alice.userId}`);
  await expect(page.locator(".saved-results")).not.toContainText("Private content must disappear");
  await page.reload();
  await expect(page.locator(".saved-results")).not.toContainText("Private content must disappear");
  await expect(page.locator(".later-open")).toBeDisabled();
});

test("recovers the Friends list without losing search and supports arrow-key tabs", async ({ page }) => {
  await fixture(page);
  await page.route("**/v1/connections", (route) => route.fulfill({ status: 503, json: { error: "unavailable", message: "Try again" } }));
  await go(page, "/friends");
  await expect(page.locator(".friends-content").getByRole("alert")).toBeVisible();
  const query = page.getByRole("textbox", { name: "Search friends" });
  await query.fill("no matching person");
  await page.unroute("**/v1/connections");
  await page.locator(".friends-content").getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".friends-content").getByRole("alert")).toHaveCount(0);
  await expect(query).toHaveValue("no matching person");
  await expect(page.getByText("No people match this search. Try another name or clear your search.")).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(query).toHaveValue("");
  const online = page.getByRole("tab", { name: "Online", exact: true });
  await online.focus();
  await online.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "All", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "All", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "All", exact: true }).press("End");
  await expect(page.getByRole("tab", { name: "Add Friend", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Add Friend", exact: true })).toBeVisible();
});
