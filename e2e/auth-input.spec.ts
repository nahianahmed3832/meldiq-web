import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });
test("sign-in credentials survive fast field changes and delayed server capability updates", async ({ page }) => {
  let release!: () => void;
  const capabilities = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/v1/server-info", async (route) => {
    const response = await route.fetch();
    await capabilities;
    await route.fulfill({ response });
  });
  // Capability delivery is deliberately held; assert the rendered form rather than unrelated load completion.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sign in to Meldiq" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in with email", exact: true })).toBeVisible();
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  await email.fill("input.regression@example.test");
  await password.fill("synthetic local test value");
  const delivered = page.waitForResponse("**/v1/server-info");
  release();
  await (await delivered).finished();
  // The new email step has no registration link. Wait for the delivered capability update to paint.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(email).toHaveValue("input.regression@example.test");
  await expect(password).toHaveValue("synthetic local test value");
  await email.focus();
  await expect(password).toHaveValue("synthetic local test value");
});
