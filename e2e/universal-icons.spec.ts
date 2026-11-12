import { acceptSignupTerms } from "./privacy";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import crypto from "node:crypto";
import path from "node:path";
import { emailedCode } from "./mail";
import { testAddress } from "./phone";
import { finishWelcome } from "./welcome";
test.use({ serviceWorkers: "block", actionTimeout: 20_000 });
test.setTimeout(120_000);
async function onboard(page: Page, context: BrowserContext) {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  // Use normal email onboarding against the exact production export, without development device linking.
  let authorization = "";
  page.on("request", (request) => {
    authorization = request.headers()["authorization"] || authorization;
  });
  const email = `rail.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Zoya Rahman");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for identity verification");
  await acceptSignupTerms(page);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const req = async (method: string, path: string, data?: Record<string, unknown> | Buffer) => {
    expect(authorization).toMatch(/^Bearer /);
    const response = await page.request.fetch(`${process.env.ORBIT_E2E_API}${path}`, {
      method,
      headers: { authorization, "x-forwarded-for": testAddress() },
      ...(data ? { data } : {}),
    });
    expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
    return response.status() === 204 ? null : response.json();
  };
  return { userId: (await req("GET", "/v1/users/me")).user.id as string, req };
}

test("semantic navigation and settings retain local icons offline", async ({ page, context, isMobile }, info) => {
  await onboard(page, context);
  await page.goto("/home");
  const navigation = page.locator(isMobile ? ".tabbar" : ".sidebar");
  await expect(navigation.locator('[data-icon="navigation.home"]')).toBeVisible();
  await expect(navigation.locator('[data-icon="navigation.activity"]')).toBeVisible();
  if (isMobile) await expect(navigation.locator('[data-icon="navigation.messages"]')).toBeVisible();
  await page.goto("/settings/you");
  const icons = page.locator('.settings [data-icon^="settings."]:visible');
  await expect.poll(() => icons.count()).toBeGreaterThan(3);
  const before = await icons.count();
  const geometry = await icons.evaluateAll((elements) =>
    elements.map((element) => ({
      name: element.getAttribute("data-icon"),
      stroke: element.getAttribute("stroke-width"),
      box: element.getAttribute("viewBox"),
      remote: element.querySelector("image,use,script") !== null,
    })),
  );
  for (const icon of geometry) {
    expect(icon.stroke).toBe("2");
    expect(icon.box).toBe("0 0 24 24");
    expect(icon.remote).toBe(false);
  }
  await context.setOffline(true);
  await expect(icons).toHaveCount(before);
  await page.screenshot({ path: path.join("docs/universal-icons/evidence", `pilot-${info.project.name}.png`), animations: "disabled" });
  await context.setOffline(false);
});
