import { expect, test } from "@playwright/test";
import { link } from "./link";
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
  const alice = await newPhone("emojialice", "Nadia Rahman");
  await link(page, alice);
  const me = alice.userId;
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await bob.req("POST", "/v1/conversations/dm", { userId: me })).conversation.id as string;
  await bob.send(dm, { type: "text", text: "Pick an emoji" });
  await page
    .getByRole("complementary", { name: "Conversations" })
    .getByRole("link", { name: /Bob Chen/ })
    .click();
  await expect(page.getByText("Pick an emoji")).toBeVisible();

  // Into the composer: search, with a skin tone chosen once.
  await page.getByRole("button", { name: "Insert emoji" }).click();
  const search = page.getByRole("searchbox", { name: "Search emoji and expressions", exact: true });
  await expect(search).toBeVisible();
  await page.getByRole("button", { name: "Skin tone" }).click();
  await page.getByRole("radio", { name: "Medium skin tone" }).click();
  await search.fill("thumbs up");
  await page.screenshot({ path: "test-results/emoji-search.png" });
  await page.getByRole("menuitem", { name: "thumbs up" }).click();
  await expect(page.getByRole("textbox", { name: /Message/ })).toHaveValue(/👍🏽/);

  await page.getByRole("menuitem", { name: "thumbs up", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /Message/ })).toHaveValue(/👍🏽👍🏽/);
  await page.getByRole("button", { name: "Close expression picker" }).click();

  // A reaction from the picker: the Flags tab jumps to its section; recent emoji come first next time.
  // Keyboard and touch both open the message menu without depending on hover timing.
  const message = page.getByRole("article").filter({ hasText: "Pick an emoji" });
  if (hasTouch) {
    await hold(page, message, 650);
    await page.getByRole("menu", { name: "Message" }).getByRole("button", { name: "Add reaction" }).click();
  } else {
    await message.focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menu", { name: "Message", exact: true }).getByRole("button", { name: "Add reaction" }).click();
  }
  await expect(page.getByRole("heading", { name: "Recently used" })).toBeVisible();
  await page.getByRole("tab", { name: "Flags" }).click();
  await expect(page.getByRole("tab", { name: "Flags" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Flags" })).toBeInViewport();
  await expect(page.getByRole("menuitem", { name: "chequered flag" })).toBeInViewport();
  await page.screenshot({ path: "test-results/emoji-flags.png" });
  await page.getByRole("menuitem", { name: "flag: bangladesh" }).click();
  await page.getByRole("searchbox", { name: "Search emoji", exact: true }).fill("red heart");
  await page.getByRole("menuitem", { name: "red heart", exact: true }).click();
  await expect(message.getByRole("button", { name: /🇧🇩 1/ })).toBeVisible();
  await expect(message.getByRole("button", { name: /❤️ 1/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(message.getByRole("button", { name: "Add another reaction" })).toBeVisible();
  await page.reload();
  await expect(message.getByRole("button", { name: /🇧🇩 1/ })).toHaveAttribute("aria-pressed", "true");
  await expect(message.getByRole("button", { name: /❤️ 1/ })).toHaveAttribute("aria-pressed", "true");
});
