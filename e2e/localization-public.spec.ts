import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Language } from "../src/i18n/languages";
const locales: Language[] = ["en", "bn", "zh-CN", "ja", "de", "pt-BR", "ar", "ur"];
test("standalone invitations preserve community data, format counts and switch all required scripts", async ({ page }, info) => {
  const code = "ABCD-EFGH-JKLM";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/v1/invites/ABCD-EFGH-JKLM/public", (route) =>
    route.fulfill({ json: { community: { name: "Save", description: "User text: বাংলা العربية 日本語", memberCount: 12 }, invitesPaused: false } }),
  );
  await page.goto("/invite/" + code);
  await expect(page.locator("#name")).toHaveText("Save");
  for (const locale of locales) {
    await page.locator("[data-public-language]").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", ["ar", "ur"].includes(locale) ? "rtl" : "ltr");
    await expect(page.locator("#name")).toHaveText("Save");
    await expect(page.locator("#about")).toHaveText("User text: বাংলা العربية 日本語");
    await expect(page.locator("#code")).toHaveText(code);
    await expect(page.locator("#open-web")).toHaveAttribute("href", "/join/" + code);
    await expect(page.locator("#members")).toContainText(new Intl.NumberFormat(locale).format(12));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (process.env.ORBIT_E2E_SHOTS) await page.screenshot({ path: path.join(process.env.ORBIT_E2E_SHOTS, `localization-${locale}-${info.project.name}-public-invite.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
test("the provider return relays its receipt immediately, removes the fragment and localizes orphan recovery", async ({ page }) => {
  await page.goto("/social-auth-callback.html#invalid");
  for (const locale of locales) {
    await page.locator("[data-public-language]").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const auth = JSON.parse(fs.readFileSync(path.resolve("locales", locale, "auth.json"), "utf8"));
    await expect(page.locator("#status")).toHaveText(auth.public.orphan.replaceAll("''", "'"));
    expect(new URL(page.url()).hash).toBe("");
  }
  const id = "A".repeat(43),
    receipt = "B".repeat(43);
  await page.evaluate(() => {
    (window as unknown as { returned: unknown }).returned = null;
    addEventListener("message", (event) => {
      if (event.origin === location.origin && event.data?.type === "meldiq-social") (window as unknown as { returned: unknown }).returned = event.data;
    });
  });
  const popupPromise = page.waitForEvent("popup");
  await page.evaluate(({ id, receipt }) => window.open(`/social-auth-callback.html#id=${id}&receipt=${receipt}`), { id, receipt });
  const popup = await popupPromise;
  await expect.poll(() => page.evaluate(() => (window as unknown as { returned: unknown }).returned)).toEqual({ type: "meldiq-social", id, receipt, error: null });
  await expect.poll(() => new URL(popup.url()).hash).toBe("");
  await popup.close();
});
