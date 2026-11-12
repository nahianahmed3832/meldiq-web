import { expect, type Page } from "@playwright/test";

export async function openPrivacyPolicy(page: Page, keyboard = false) {
  const link = page.locator(".auth-consent").getByRole("link", { name: /^Privacy(?: |$)/ });
  const url = await link.getAttribute("href");
  if (!url) throw new Error("Missing Privacy Policy URL");
  await page.context().route(url, (route) => route.fulfill({ body: "<h1>Privacy Policy fixture</h1>", contentType: "text/html" }), { times: 1 });
  const popup = page.waitForEvent("popup");
  if (keyboard) await link.press("Enter");
  else await link.click();
  const policy = await popup;
  await expect(policy).toHaveURL(url);
  await policy.close();
}

export async function acceptSignupTerms(page: Page) {
  await openPrivacyPolicy(page);
  await page.getByRole("checkbox", { name: /I am 13 or older/ }).check();
}
