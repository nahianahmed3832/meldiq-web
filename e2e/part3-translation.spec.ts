import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));

test("translation browser contracts show unavailable, failed and successful results while preserving the original", async ({ page }) => {
  // A deterministic stand-in verifies the browser integration contract, not a downloaded model's translation quality.
  await page.addInitScript(() => {
    const fixture = { mode: "unsupported" };
    Object.assign(globalThis, { __translationFixture: fixture });
    Object.defineProperty(globalThis, "LanguageDetector", {
      configurable: true,
      get: () =>
        fixture.mode === "unsupported"
          ? undefined
          : { availability: async () => "available", create: async () => ({ detect: async () => [{ detectedLanguage: "es", confidence: 0.99 }], destroy() {} }) },
    });
    Object.defineProperty(globalThis, "Translator", {
      configurable: true,
      get: () =>
        fixture.mode === "unsupported"
          ? undefined
          : {
              availability: async () => (fixture.mode === "unavailable" ? "unavailable" : "available"),
              create: async () => ({
                translate: async () => {
                  if (fixture.mode === "failed") throw new DOMException("Fixture model failure", "NotSupportedError");
                  return "Hello from the fixture model";
                },
                destroy() {},
              }),
            },
    });
  });
  const recipient = await newPhone("translateviewer", "Translation Viewer"),
    author = await newPhone("translateauthor", "Translation Author");
  const org = (await author.req("POST", "/v1/orgs", { name: "Translation fixture" })).org.id;
  const code = (await author.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
  await recipient.req("POST", "/v1/invites/accept", { code });
  const cid = (await author.req("POST", `/v1/orgs/${org}/channels`, { name: "translation", scope: "ORG" })).channel.id;
  const original = "Hola desde el mensaje original";
  const sent = await author.send(cid, { type: "text", text: original });
  await link(page, recipient);
  await page.goto(`/home/c/${cid}`);
  const message = page.locator(".msg").filter({ hasText: original });
  await expect(message).toBeVisible();
  const open = async () => {
    await message.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Translate…", exact: true }).click();
    return page.getByRole("dialog", { name: "Translate message", exact: true });
  };
  let dialog = await open();
  await expect(dialog.getByText("This browser can't translate on the device.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const mode = async (value: string) =>
    page.evaluate((value) => {
      (globalThis as unknown as { __translationFixture: { mode: string } }).__translationFixture.mode = value;
    }, value);
  await mode("unavailable");
  dialog = await open();
  await dialog.getByRole("combobox", { name: "Translate into", exact: true }).selectOption("en");
  await dialog.getByRole("button", { name: "Translate", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("isn't available");
  await mode("failed");
  await dialog.getByRole("button", { name: "Translate", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("couldn't be loaded");
  await mode("available");
  await dialog.getByRole("button", { name: "Translate", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(message.getByText("Translated in this browser", { exact: true })).toBeVisible();
  await expect(message.getByText("Hello from the fixture model", { exact: true })).toBeVisible();
  await message.getByRole("button", { name: "Show original only", exact: true }).click();
  await expect(message.getByText("Hello from the fixture model", { exact: true })).toHaveCount(0);
  await expect(message.getByText(original, { exact: true })).toBeVisible();
  const history = (await recipient.req("GET", `/v2/conversations/${cid}/messages`)).messages;
  expect(JSON.stringify(history)).toContain(original);
  expect(JSON.stringify(history)).not.toContain("Hello from the fixture model");
  expect(sent.serverTs).toBeGreaterThan(0);
});
