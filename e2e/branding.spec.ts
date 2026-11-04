import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("Google and Discord login entries still call their existing provider handlers", async ({ page }, info) => {
  await page.route("**/v2/auth/social/config", (route) => route.fulfill({ json: { providers: ["google", "discord"], googleClientId: null } }));
  const started: string[] = [];
  await page.route("**/v2/auth/social/start", async (route) => {
    started.push(route.request().postDataJSON().provider);
    await route.fulfill({ status: 503, json: { error: "provider_unavailable", message: "Synthetic provider outage" } });
  });
  await page.goto("/");
  const google = page.getByRole("button", { name: "Continue with Google", exact: true });
  const discord = page.getByRole("button", { name: "Continue with Discord", exact: true });
  await expect(google).toBeVisible();
  await expect(discord).toBeVisible();
  await expect(google.locator("img")).toHaveAttribute("src", "/auth-provider-icons/google.svg");
  await expect(discord.locator("img")).toHaveAttribute("src", "/auth-provider-icons/discord.svg");
  const screenshots = process.env.MELDIQ_BRANDING_SCREENSHOTS ?? "/tmp/meldiq-part2/branding";
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, `login-providers-${info.project.name}.jpg`), animations: "disabled" });
  await google.click();
  await expect(page.getByRole("alert")).toContainText("The server had a problem. Try again in a moment.");
  await expect(discord).toBeEnabled();
  await discord.click();
  await expect.poll(() => started).toEqual(["google", "discord"]);
  await expect(google).toBeEnabled();
  await expect(page.locator(".app[data-connection=online]")).toHaveCount(0);
});

test("Meldiq is the default and the same Meldling appears in branding, stickers and animated emoji", async ({ page }, info) => {
  const response = await page.goto("/");
  expect(await response!.text()).toContain('data-palette="meldiq"');
  await expect(page.locator("html")).toHaveAttribute("data-palette", "meldiq");
  await expect(page.locator(".brand-mark")).toHaveAttribute("src", "/meldling-128.png");

  const alice = await newPhone("brandalice", "Brand Explorer");
  const bob = await newPhone("brandbob", "Brand Peer");
  await bob.connect();
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  await link(page, alice);
  await page.goto("/home");
  await expect(page.locator(".meldling-art")).toHaveAttribute("src", "/meldling-128.png");
  await page.goto("/settings/appearance");
  await expect(page.getByRole("radio", { name: "Meldiq", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Midnight", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "midnight");
  await page.getByRole("radio", { name: "Meldiq", exact: true }).click();
  await page.goto(`/dms/c/${dm}`);
  await page.getByRole("button", { name: "Insert emoji", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Expressions", exact: true });
  await expect(picker.getByRole("region", { name: "Meldling", exact: true }).getByRole("button").first()).toBeInViewport();
  const sticker = picker.getByRole("button", { name: /^Send sticker:/ }).first();
  await expect(sticker.locator(".meldling-expression img")).toHaveAttribute("src", "/meldling-128.png");
  await expect(
    picker
      .getByRole("button", { name: /^Send animated/ })
      .first()
      .locator(".meldling-expression img"),
  ).toHaveAttribute("src", "/meldling-128.png");
  const screenshots = process.env.MELDIQ_BRANDING_SCREENSHOTS ?? "/tmp/meldiq-part2/branding";
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, `expressions-${info.project.name}.jpg`), animations: "disabled" });
  await sticker.click();
  await expect.poll(() => bob.received.some((message) => !!(message.payload as { sticker?: unknown }).sticker)).toBe(true);
  const messages = page.getByRole("log", { name: "Messages", exact: true });
  await expect(messages.locator(".sticker .meldling-expression img")).toHaveAttribute("src", "/meldling-128.png");
  await page.getByRole("button", { name: "Insert emoji", exact: true }).click();
  await picker
    .getByRole("button", { name: /^Send animated/ })
    .first()
    .click();
  await expect.poll(() => bob.received.some((message) => !!(message.payload as { animoji?: unknown }).animoji)).toBe(true);
  await expect(messages.locator(".animoji .meldling-expression img")).toHaveAttribute("src", "/meldling-128.png");
  await page.screenshot({ path: path.join(screenshots, `messages-${info.project.name}.jpg`), animations: "disabled" });
});

test("the old unchosen palette migrates while an explicit Midnight choice survives the first paint and reload", async ({ browser, baseURL }) => {
  for (const chosen of [false, true]) {
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-orbit-test-ip": testAddress() } });
    await context.addInitScript((selected: boolean) => {
      localStorage.setItem("meldiq.introSeen", "1");
      localStorage.setItem("orbit.prefs.v1", JSON.stringify({ palette: "midnight", paletteChosen: selected }));
      localStorage.setItem("meldiq.look", JSON.stringify({ theme: "dark", palette: "midnight" }));
    }, chosen);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-palette", chosen ? "midnight" : "meldiq");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-palette", chosen ? "midnight" : "meldiq");
    await context.close();
  }
});
