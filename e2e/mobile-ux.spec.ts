import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

// Real backend and real browser engines. Keyboard dimensions are simulated explicitly; this isn't an OS keyboard test.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

async function go(page: Page, href: string) {
  await page.evaluate((href) => {
    const a = document.createElement("a");
    a.href = href;
    document.body.append(a);
    a.click();
    a.remove();
  }, href);
}
async function keyboard(page: Page, height: number, top = 0) {
  await page.evaluate(
    ({ height, top }) => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, "height", { configurable: true, value: height });
      Object.defineProperty(vv, "offsetTop", { configurable: true, value: top });
      vv.dispatchEvent(new Event("resize"));
      vv.dispatchEvent(new Event("scroll"));
    },
    { height, top },
  );
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--app-height"))).toBe(`${height}px`);
}
async function fits(locator: Locator, top: number, bottom: number) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await locator.boundingBox())!;
      return box.y >= top - 1 && box.y + box.height <= bottom + 1;
    })
    .toBe(true);
}
async function setup(page: Page) {
  const alice = await newPhone("mobile", "Mobile Alice");
  const bob = await newPhone("mobilepeer", "Mobile Bob");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await bob.send(dm, { type: "text", text: "Mobile conversation ready" });
  await go(page, `/dms/c/${dm}`);
  await expect(page.getByRole("log", { name: "Messages" })).toContainText("Mobile conversation ready");
  return { alice, bob, dm };
}

test("composer stays usable at every phone width, preserves fast drafts, and sends multiline text and photos", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { alice, bob, dm } = await setup(page);
  const field = page.locator(".composer textarea");
  await expect(field).not.toBeFocused();
  for (const width of [320, 360, 375, 390, 412, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const box = (await field.boundingBox())!;
    expect(box.width, `${width}px: space for actual text`).toBeGreaterThan(130);
    await fits(field, 0, 844);
    for (const button of [page.locator(".composer-plus"), page.getByRole("button", { name: "Insert emoji" }), page.locator(".composer-row .send-btn")]) {
      const size = (await button.boundingBox())!;
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await field.fill("A draft kept on quick navigation");
  await go(page, "/dms");
  await go(page, `/dms/c/${dm}`);
  await expect(field).toHaveValue("A draft kept on quick navigation");
  await expect
    .poll(() =>
      page.evaluate(
        async ({ id, userId }) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open("orbit-web");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          try {
            const read = (key: string) =>
              new Promise<any>((resolve, reject) => {
                const req = db.transaction("kv").objectStore("kv").get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              });
            const sealed = await read("snapshot");
            const key = await read("snapshotKey");
            if (!sealed || !key || sealed.userId !== userId) return null;
            const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.iv, additionalData: new TextEncoder().encode(`meldiq-snapshot|${sealed.v}|${userId}`) }, key, sealed.data);
            const snapshot = JSON.parse(new TextDecoder().decode(plain));
            return snapshot.local.find((local: { id: string }) => local.id === id)?.draft ?? null;
          } finally {
            db.close();
          }
        },
        { id: dm, userId: alice.userId },
      ),
    )
    .toBe("A draft kept on quick navigation");
  await page.reload();
  await expect(field).toHaveValue("A draft kept on quick navigation");
  await field.fill("First line");
  await field.press("Shift+Enter");
  await field.pressSequentially("Second line");
  await expect(field).toHaveValue("First line\nSecond line");
  await page.locator(".composer input[type=file]").setInputFiles(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  const log = page.getByRole("log", { name: "Messages" });
  await expect(log).toContainText("First line");
  await expect.poll(() => bob.received.some((message) => message.payload.text === "First line\nSecond line")).toBe(true);
  await expect(log).not.toContainText("Request failed");
  await expect(log.getByRole("button", { name: /Open image/ })).toBeVisible();
  await log.getByRole("button", { name: /Open image/ }).click();
  await fits(page.locator(".lightbox"), 0, 844);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: info.outputPath("mobile-conversation.png") });
  await go(page, "/dms");
  await go(page, `/dms/c/${dm}`);
  await expect(field).toHaveValue("");
  expect(errors).toEqual([]);
});

test("keyboard shrink and pan retain latest and the older reading anchor; long input and sheets fit", async ({ page }, info) => {
  const { bob, dm } = await setup(page);
  for (let i = 0; i < 35; i++) await bob.send(dm, { type: "text", text: `History ${i}: ${"Reading content. ".repeat(10)}` });
  const log = page.getByRole("log", { name: "Messages" });
  await expect(log).toContainText("History 34");
  const field = page.locator(".composer textarea");
  await field.fill("Long mobile draft\n".repeat(25));
  await keyboard(page, 380, 60);
  await fits(page.locator(".composer"), 60, 440);
  expect((await field.boundingBox())!.height).toBeLessThanOrEqual(114);
  expect((await log.boundingBox())!.height).toBeGreaterThan(80);
  await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(2);
  await log.evaluate((el) => {
    el.scrollTop -= 500;
  });
  await expect(page.getByRole("button", { name: "Jump to latest", exact: true })).toBeVisible();
  const anchor = await log.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const item = Array.from(el.querySelectorAll<HTMLElement>("[id^=msg-]")).find((node) => node.getBoundingClientRect().bottom > top)!;
    return { id: item.id, offset: item.getBoundingClientRect().top - top };
  });
  await keyboard(page, 460, 20);
  await expect.poll(() => log.evaluate((el, id) => document.getElementById(id)!.getBoundingClientRect().top - el.getBoundingClientRect().top, anchor.id)).toBeCloseTo(anchor.offset, 0);
  await page.getByRole("button", { name: "Insert emoji" }).click();
  const picker = page.getByRole("dialog", { name: "Expressions" });
  await fits(picker, 20, 480);
  await keyboard(page, 300, 80);
  await fits(picker, 80, 380);
  await picker.getByRole("searchbox", { name: "Search emoji and expressions", exact: true }).fill("wave");
  await picker.getByRole("button", { name: "Close expression picker" }).click();
  await page.locator(".conv-head").getByRole("button", { name: "More", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Conversation", exact: true });
  await fits(menu, 80, 380);
  await menu.getByRole("menuitem", { name: "Encryption", exact: true }).click();
  await fits(page.getByRole("dialog", { name: "Security" }), 80, 380);
  await page.screenshot({ path: info.outputPath("keyboard-security-sheet.png") });
  await page.getByRole("dialog", { name: "Security" }).getByRole("button", { name: "Close", exact: true }).click();
  await keyboard(page, 844);
  await fits(page.locator(".composer"), 0, 844);
});

test("main tabs, settings children, history and rotation preserve mobile navigation", async ({ page }) => {
  const { alice, dm } = await setup(page);
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Mobile community" });
  const channel = (await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "mobile-room", scope: "ORG", kind: "PUBLIC" })).channel;
  await go(page, "/home");
  const tabs = page.getByRole("navigation", { name: "Sections", exact: true });
  await expect(page.getByRole("region", { name: "Mobile community lobby", exact: true })).toBeVisible();
  await tabs.getByRole("button", { name: "Home", exact: true }).click();
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("button")).toHaveCount(4);
  await page
    .locator(".rail")
    .getByRole("button", { name: /^Mobile community/ })
    .click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: /Channel mobile-room/ })
    .click();
  await expect(page).toHaveURL(new RegExp(channel.id));
  await expect(tabs).toBeHidden();
  await page.getByRole("button", { name: "Back to conversations", exact: true }).click();
  await tabs.getByRole("button", { name: /^Messages/ }).click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: /Mobile Bob/ })
    .click();
  await expect(page).toHaveURL(new RegExp(dm));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.locator(".sidebar")).toBeHidden();
  await fits(page.locator(".composer"), 0, 390);
  await go(page, "/settings/you");
  await expect(tabs).toBeVisible();
  await go(page, "/settings/notifications");
  await expect(tabs).toBeHidden();
  await page.goBack();
  await expect(tabs).toBeVisible();
  await page.goForward();
  await expect(tabs).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Back to settings" })).toBeVisible();
});
