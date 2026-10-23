import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Chat settings from Meldiq Android (2026-10-23): time format, message previews in the list, search filters, and the
 * gestures (double-click or double-tap to react, swipe left to reply on touch screens).
 */
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for these settings");
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

async function setting(page: Page, group: string, choice: string) {
  await page.goto("/settings/appearance");
  await page.getByRole("group", { name: group }).getByRole("button", { name: choice, exact: true }).click();
}

/** A finger's swipe from (x0, y) to (x1, y) on [el], as pointer events with pointerType "touch". */
async function swipe(page: Page, selector: string, dx: number) {
  await page.locator(selector).evaluate((el, dx) => {
    const r = el.getBoundingClientRect();
    const y = r.top + r.height / 2;
    const x0 = r.left + r.width * 0.8;
    const ev = (type: string, x: number) => el.dispatchEvent(new PointerEvent(type, { pointerType: "touch", clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerId: 7 }));
    ev("pointerdown", x0);
    for (let i = 1; i <= 8; i++) ev("pointermove", x0 + (dx * i) / 8);
    ev("pointerup", x0 + dx);
  }, dx);
}

test("time format, list previews, search filters and message gestures", async ({ page, isMobile }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await bob.connect();
  await link(page, alice);
  await bob.send(dm, { type: "text", text: "Price list for Monday https://example.com/list" });
  await bob.send(dm, { type: "text", text: "Lunch at noon?" });

  // 24-hour clock: message times have no AM/PM.
  await setting(page, "Time format", "24-hour");
  await page.goto(`/dms/c/${dm}`);
  const msg = page.locator(".msg").filter({ hasText: "Lunch at noon?" });
  await expect(msg).toBeVisible();
  const times = await page.locator(".msg time").allInnerTexts();
  expect(times.length).toBeGreaterThan(0);
  for (const t of times) expect(t).not.toMatch(/AM|PM/i);

  // No previews in the conversation list.
  if (!isMobile) {
    await expect(page.locator(".side-item").filter({ hasText: "Bob Chen" })).toContainText("Lunch at noon?");
    await setting(page, "Message previews", "None");
    await page.goto(`/dms/c/${dm}`);
    await expect(page.locator(".side-item").filter({ hasText: "Bob Chen" })).not.toContainText("Lunch at noon?");
  }

  // Search filters: has:link finds the message with a link, from:me finds nothing (Alice sent nothing).
  await page.goto(`/dms/c/${dm}/search`);
  const box = page.getByRole("textbox", { name: "Search in this conversation" });
  await page.getByRole("group", { name: "Filters" }).getByRole("button", { name: "Links" }).click();
  await expect(box).toHaveValue("has:link ");
  const results = page.getByRole("list", { name: /results/ });
  await expect(results).toContainText("Price list for Monday");
  await expect(results).not.toContainText("Lunch at noon?");
  await box.fill("from:me");
  await expect(page.getByText("No messages here match these filters.")).toBeVisible();
  await box.fill("lunch from:bob");
  await expect(results).toContainText("Lunch at noon?");

  // Double-click (mouse) or double-tap (touch) reacts with the chosen emoji.
  await setting(page, "Double-tap reaction", "React with ❤️");
  await page.goto(`/dms/c/${dm}`);
  const target = msg.locator(".msg-text");
  if (isMobile) {
    await target.tap();
    await target.tap();
  } else {
    await msg.locator(".msg-gutter").dblclick();
  }
  await expect(msg.locator(".reaction")).toContainText("❤️");

  // Swipe left to reply (touch screens).
  if (isMobile) {
    await swipe(page, `#${await msg.getAttribute("id")}`, -110);
    await expect(page.getByText(/Replying to/)).toContainText("Lunch at noon?");
  }
});
