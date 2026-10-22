import { expect, type Locator, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Touch interactions on a phone-sized screen (2026-10-22): a tap on a reaction toggles it; a long press on a message opens
 * its menu with quick reactions; a scroll never does. Run in the phone-width project (touch emulated). An emulation of
 * touch input in Chromium, not iOS Safari: the device checklist is in docs/MELDIQ_WEB_BROWSERS.md.
 */
test.skip(({ hasTouch }) => !hasTouch, "touch screens only (the phone-width project)");

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** A finger held on [target] for [ms], optionally sliding [dy] pixels (a scroll). */
async function hold(page: Page, target: Locator, ms: number, dy = 0): Promise<void> {
  const box = (await target.boundingBox())!;
  const x = box.x + Math.min(40, box.width / 2);
  const y = box.y + box.height / 2;
  const ev = { pointerType: "touch", isPrimary: true, pointerId: 7, bubbles: true };
  await target.dispatchEvent("pointerdown", { ...ev, clientX: x, clientY: y });
  if (dy) await target.dispatchEvent("pointermove", { ...ev, clientX: x, clientY: y + dy });
  await page.waitForTimeout(ms);
  await target.dispatchEvent("pointerup", { ...ev, clientX: x, clientY: y + dy });
}

test("a tap toggles a reaction, a long press opens quick reactions, and scrolling opens nothing", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await bob.send(dm, { type: "text", text: "React to me" });
  await page.getByRole("link", { name: /Bob Chen/ }).click();
  const message = page.getByRole("article").filter({ hasText: "React to me" });
  await expect(message).toBeVisible();

  // No hover toolbar on a touch screen, even after a tap.
  await message.tap();
  await expect(message.getByRole("toolbar", { name: "Message actions" })).toBeHidden();

  // A long press: the message's menu, with quick reactions first.
  await hold(page, message, 650);
  const menu = page.getByRole("menu", { name: "Message" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("group", { name: "Quick reactions" })).toBeVisible();
  await menu.getByRole("button", { name: "React 👍" }).tap();
  await expect(menu).toBeHidden();
  const chip = message.getByRole("button", { name: /^👍 1/ });
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  // A tap on the reaction takes it back: no picker, no menu.
  await chip.tap();
  await expect(message.getByRole("button", { name: /^👍/ })).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);

  // Holding while moving the finger is a scroll: nothing opens.
  await hold(page, message, 650, 40);
  await expect(page.getByRole("menu")).toHaveCount(0);
});
