import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { LANGUAGE_NAMES, LANGUAGES, type Language } from "../src/i18n/languages";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

const locales: Language[] = ["en", "bn", "zh-CN", "ja", "de", "pt-BR", "ar", "ur"];
async function select(page: Page, locale: Language) {
  await page.locator("button.lang-picker").first().click();
  await page.getByRole("option", { name: LANGUAGE_NAMES[locale], exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator(".language-dialog")).toHaveCount(0);
}
async function shot(page: Page, name: string) {
  const directory = process.env.ORBIT_E2E_SHOTS;
  if (directory) {
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, name + ".png"), fullPage: true });
  }
}

test.beforeEach(async ({ page, context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  await page.addInitScript(() => {
    if (!localStorage.getItem("orbit.prefs.v1")) localStorage.setItem("orbit.prefs.v1", JSON.stringify({ language: "en" }));
    const counts = { opened: 0, closed: 0 };
    (window as unknown as { localeSocketCounts: typeof counts }).localeSocketCounts = counts;
    window.WebSocket = new Proxy(window.WebSocket, {
      construct(Target, args: [string | URL, (string | string[])?]) {
        const socket = new Target(...args);
        counts.opened++;
        socket.addEventListener("close", () => {
          counts.closed++;
        });
        return socket;
      },
    });
  });
});

test("searchable native-language picker, RTL and guest persistence", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".landing")).toBeVisible();
  await page.locator("button.lang-picker").click();
  await expect(page.getByRole("option")).toHaveCount(29);
  const search = page.locator(".language-search input");
  await expect(search).toBeFocused();
  await search.fill("日本");
  await expect(page.getByRole("option")).toHaveCount(1);
  await search.press("ArrowDown");
  await expect(page.getByRole("option")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("button.lang-picker")).toBeFocused();
  for (const locale of LANGUAGES) {
    const url = page.url();
    await select(page, locale);
    expect(page.url()).toBe(url);
    await expect(page.locator("html")).toHaveAttribute("dir", ["ar", "ur"].includes(locale) ? "rtl" : "ltr");
    const common = JSON.parse(fs.readFileSync(path.resolve("locales", locale, "common.json"), "utf8"));
    await expect(page.locator("button.lang-picker")).toHaveAttribute("aria-label", common.language.label);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (locales.includes(locale)) await shot(page, `localization-${locale}-${info.project.name}-signin`);
  }
  await select(page, "ur");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(errors).toEqual([]);
});

test("switching keeps messaging connected, preserves content and syncs another device", async ({ page, browser, baseURL }, info) => {
  const alice = await newPhone("localealice", "Alice Rahman");
  const bob = await newPhone("localebob", "Bob Chen");
  await bob.connect();
  const conversationId = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await link(page, alice);
  const secondContext = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
  const second = await secondContext.newPage();
  await second.addInitScript(() => localStorage.setItem("meldiq.introSeen", "1"));
  await link(second, alice);
  await page.goto("/settings/appearance");
  await expect(page.locator("button.lang-picker")).toBeVisible();
  const baseline = await page.evaluate(() => (window as unknown as { localeSocketCounts: unknown }).localeSocketCounts);
  for (const locale of locales) {
    await select(page, locale);
    await expect(second.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator(".app[data-connection=online]")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { localeSocketCounts: unknown }).localeSocketCounts)).toEqual(baseline);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const clippedControls = await page.locator(".setting button.lang-picker, .palette-swatch").evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const card = node.closest(".card")?.getBoundingClientRect();
          return rect.width > 0 && (rect.left < Math.max(0, card?.left ?? 0) - 1 || rect.right > Math.min(innerWidth, card?.right ?? innerWidth) + 1);
        })
        .map((node) => ({ label: node.textContent, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })),
    );
    expect(clippedControls, `${locale} controls must stay within the viewport`).toEqual([]);
    await shot(page, `localization-${locale}-${info.project.name}-settings`);
  }
  const preference = await alice.req("GET", "/v1/me/preferences/personal");
  expect(preference.prefs.locale).toBe("ur");
  await page.goto(`/dms/c/${conversationId}`);
  await bob.send(conversationId, { type: "text", text: "Save" });
  await expect(page.locator(".msg-text").filter({ hasText: /^Save$/ })).toBeVisible();
  await page.locator("textarea").fill("বাংলা user content العربية 日本語");
  await page.locator("textarea").press("Enter");
  await expect(page.locator(".msg-text").filter({ hasText: "বাংলা user content العربية 日本語" })).toBeVisible();
  await shot(page, `localization-ur-${info.project.name}-conversation`);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator(".msg-text").filter({ hasText: /^Save$/ })).toBeVisible();
  await secondContext.close();
  await bob.disconnect();
});

test("the profile menu opens a keyboard-accessible language dialog and restores focus", async ({ page, isMobile }) => {
  const alice = await newPhone("localeprofile", "Alice Rahman");
  await link(page, alice);
  if (isMobile) await page.goto("/settings/you");
  const trigger = isMobile ? page.locator(".you-card").getByRole("button", { name: "Status", exact: true }) : page.locator(".user-panel-me:visible").first();
  await trigger.click();
  const language = page.getByRole("menuitem", { name: "Language", exact: true });
  await language.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".language-search input")).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".language-dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("menuitem", { name: "Language", exact: true }).click();
  await page.getByRole("option", { name: "اردو", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
