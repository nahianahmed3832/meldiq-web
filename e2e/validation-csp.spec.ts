import { expect, test } from "@playwright/test";

test("sign-in validation retains the strict script policy without eval violations", async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { validationCspViolations: string[] }).validationCspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.blockedURI === "eval" || event.effectiveDirective.startsWith("script-src")) violations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
    });
  });
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
  await expect(page.getByRole("heading", { name: "Sign in to Meldiq", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { validationCspViolations: string[] }).validationCspViolations)).toEqual([]);
});
