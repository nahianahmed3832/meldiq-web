import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { LANGUAGE_NAMES, type Language } from "../src/i18n/languages";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const clipped = await page.locator(".experience-heading, .saved-filters, .saved-tools, .later-navigation, .collection-editor button, .collection-editor input").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
      }).length,
  );
  expect(clipped).toBe(0);
}
for (const locale of ["de", "ar", "ur"] satisfies Language[]) {
  test(`Messages, Later and collection dialogs fit long and RTL copy: ${locale}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    const account = await newPhone("refreshlocale", "Layout Check");
    await link(page, account);
    await page.goto("/settings/language");
    await page.locator("button.lang-picker").first().click();
    await page.getByRole("option", { name: LANGUAGE_NAMES[locale], exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "de" ? "ltr" : "rtl");
    const copy = JSON.parse(fs.readFileSync(`locales/${locale}/workspace.json`, "utf8")).experience;
    await page.goto("/friends");
    await expect(page.getByText(copy.messagesIntro, { exact: true })).toBeVisible();
    await fits(page);
    await page.goto("/later");
    await expect(page.getByText(copy.laterIntro, { exact: true })).toBeVisible();
    await expect(page.getByText(copy.viewScope, { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: copy.savedTab, exact: true })).toBeVisible();
    await fits(page);
    await page.screenshot({ path: `docs/design/release-readiness-2026-11-11/locale-${locale}-${info.project.name}.png`, animations: "disabled" });
    // Existing collection labels are in the older fallback backlog; verify the actual fallback controls remain usable.
    await page.setViewportSize({ width: 320, height: 480 });
    await page.getByRole("button", { name: "New collection", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^(Save|Speichern|حفظ|محفوظ کریں)$/ })).toBeDisabled();
    const name = locale === "de" ? "Nachrichten für die nächste gemeinsame Besprechung" : locale === "ar" ? "رسائل للمتابعة في الاجتماع القادم" : "اگلی ملاقات میں گفتگو کے لیے پیغامات";
    await dialog.getByRole("textbox").fill(name);
    await fits(page);
    await page.screenshot({ path: `docs/design/release-readiness-2026-11-11/dialog-${locale}-${info.project.name}.png`, animations: "disabled" });
    await dialog.locator('button[type="submit"], form button.btn-primary').click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("combobox", { name: "Collections", exact: true }).selectOption({ label: name });
    await page.getByRole("button", { name: "Rename collection", exact: true }).click();
    await expect(dialog.getByRole("textbox")).toHaveValue(name);
    await dialog.getByRole("textbox").fill(`${name} 2`);
    await dialog.locator("form button.btn-primary").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Collections", exact: true }).locator("option:checked")).toHaveText(`${name} 2`);
    await fits(page);
    expect(errors).toEqual([]);
  });
}
