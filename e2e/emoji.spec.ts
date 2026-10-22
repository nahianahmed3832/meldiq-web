import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { expectSignedOut } from "./link";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";
import { hold } from "./touchInput";

/**
 * The full emoji picker (meldiq docs/EMOJI.md) in a real browser: search, skin tone, category tabs, typing an emoji
 * into the composer and reacting with one from the picker.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("search, skin tone and categories, into the composer and as a reaction", async ({ page, hasTouch }) => {
  const email = `e2e.${crypto.randomBytes(4).toString("hex")}@example.test`;
  await page.goto("/");
  await expectSignedOut(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Nadia Rahman");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long enough password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Code").fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "Set up encryption" }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq" }).click();
  await expect(page.locator(".conn.online")).toBeVisible({ timeout: 15_000 });

  const me = await page.evaluate(() => (window as unknown as { __orbit: { device: { userId: string } } }).__orbit.device.userId);
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: me })).conversation.id as string;
  await bob.send(dm, { type: "text", text: "Pick an emoji" });
  await page.getByRole("link", { name: /Bob Chen/ }).click();
  await expect(page.getByText("Pick an emoji")).toBeVisible();

  // Into the composer: search, with a skin tone chosen once.
  await page.getByRole("button", { name: "Insert emoji" }).click();
  const search = page.getByRole("searchbox", { name: "Search emoji" });
  await expect(search).toBeFocused();
  await page.getByRole("button", { name: "Skin tone" }).click();
  await page.getByRole("radio", { name: "Medium skin tone" }).click();
  await search.fill("thumbs up");
  await page.screenshot({ path: "test-results/emoji-search.png" });
  await page.getByRole("menuitem", { name: "thumbs up" }).click();
  await expect(page.getByRole("textbox", { name: /Message/ })).toHaveValue(/👍🏽/);

  // A reaction from the picker: the Flags tab jumps to its section; recent emoji come first next time.
  // With a mouse: the message's toolbar on hover. On a touch screen: a long press opens its menu (longPress.ts).
  const message = page.getByRole("article").filter({ hasText: "Pick an emoji" });
  if (hasTouch) {
    await hold(page, message, 650);
    await page.getByRole("menu", { name: "Message" }).getByRole("button", { name: "Add reaction" }).click();
  } else {
    await message.hover();
    await page.getByRole("button", { name: "Add reaction" }).click();
  }
  await expect(page.getByRole("heading", { name: "Recently used" })).toBeVisible();
  await page.getByRole("tab", { name: "Flags" }).click();
  await expect(page.getByRole("tab", { name: "Flags" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Flags" })).toBeInViewport();
  await expect(page.getByRole("menuitem", { name: "chequered flag" })).toBeInViewport();
  await page.screenshot({ path: "test-results/emoji-flags.png" });
  await page.getByRole("menuitem", { name: "flag: bangladesh" }).click();
  await expect(page.getByRole("button", { name: /🇧🇩 1/ })).toBeVisible();
});
