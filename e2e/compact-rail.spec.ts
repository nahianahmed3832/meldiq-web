import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import crypto from "node:crypto";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";

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
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
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

test("compact rail keeps icons, unread badges and daily navigation usable", async ({ page, context, isMobile }, info) => {
  await context.addInitScript(() => localStorage.setItem("orbit.prefs.v1", JSON.stringify({ palette: "meldiq", theme: "dark", paletteChosen: true, themeChosen: true })));
  const owner = await onboard(page, context);
  await owner.req("POST", "/v1/orgs", { name: "Makers Guild" });
  await owner.req("POST", "/v1/orgs", { name: "Meldiq Community" });
  const peer = await newPhone("railpeer", "Mina Rahman");
  const dm = (await owner.req("POST", "/v1/conversations/dm", { userId: peer.userId })).conversation.id;
  await peer.connect();
  await page.goto("/home");
  const rail = page.locator(".rail");
  await expect(rail).toBeVisible();
  await rail.getByRole("button", { name: "Makers Guild", exact: true }).click();
  const selected = rail.locator('.rail-org[aria-current="true"]');
  await expect(selected).toHaveAttribute("title", "Makers Guild");
  await expect(rail.locator(".rail-primary")).toHaveCount(0);
  if (!isMobile) {
    const geometry = await rail.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const side = document.querySelector(".sidebar")!.getBoundingClientRect();
      const icon = el.querySelector('.rail-org[aria-current="true"]')!;
      const marker = getComputedStyle(icon, "::before");
      return {
        x: box.left,
        width: box.width,
        radius: getComputedStyle(el).borderRadius,
        gutter: side.left - box.right,
        markerHeight: parseFloat(marker.height),
        markerX: icon.getBoundingClientRect().left + parseFloat(marker.left),
      };
    });
    expect(geometry).toMatchObject({ x: 0, width: 72, radius: "0px", gutter: 0, markerHeight: 36, markerX: 0 });
    await peer.send(dm, { type: "text", text: "Hello from Mina" });
    const badge = rail.locator(".rail-dm .count");
    await expect(badge).toHaveText("1");
    const painted = await badge.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).includes(el);
    });
    expect(painted).toBe(true);
    await page.locator(".sidebar-primary").getByRole("link", { name: "Activity", exact: true }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await page.locator(".sidebar-primary").getByRole("link", { name: "Home", exact: true }).click();
    await rail.locator(".rail-home").click();
    await expect(page).toHaveURL(/\/dms$/);
    await rail.getByRole("button", { name: /Makers Guild/ }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("compact-rail.png"), animations: "disabled" });
  if (!isMobile) {
    await page.locator("html").evaluate((el) => el.setAttribute("data-theme", "light"));
    await page.screenshot({ path: info.outputPath("compact-rail-light.png"), animations: "disabled" });
    await page.locator("html").evaluate((el) => el.setAttribute("data-theme", "dark"));
    for (let i = 0; i < 8; i++) await owner.req("POST", "/v1/orgs", { name: `Scroll community ${i}` });
    await page.reload();
    await expect(rail.locator(".rail-org")).toHaveCount(10);
    await page.setViewportSize({ width: 1440, height: 480 });
    await rail.getByRole("link", { name: "Discover communities", exact: true }).focus();
    await expect(rail.getByRole("link", { name: "Discover communities", exact: true })).toBeInViewport();
    const dock = await page.locator(".app > .user-panel").boundingBox();
    expect(dock!.y + dock!.height).toBeLessThanOrEqual(480);
    const discover = await rail.getByRole("link", { name: "Discover communities", exact: true }).boundingBox();
    expect(discover!.y + discover!.height).toBeLessThanOrEqual(dock!.y);
    expect(await rail.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.locator("html").evaluate((el) => el.setAttribute("dir", "rtl"));
    const rtl = await rail.boundingBox();
    expect(rtl!.x + rtl!.width).toBe(1440);
    await page.screenshot({ path: info.outputPath("compact-rail-rtl-short.png"), animations: "disabled" });
  }
});
