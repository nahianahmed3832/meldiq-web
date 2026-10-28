import { expect, type Locator, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, type Phone, testAddress } from "./phone";

/**
 * Brief v4 §14: every list that should scroll does, with the gesture its direction calls for, and scrolling never opens
 * what the finger or pointer started on. Touch swipes are real touch scroll gestures (Chromium's
 * Input.synthesizeScrollGesture), not CSS checks; the wheel is the real mouse wheel.
 */
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const COMMUNITIES = 18;

async function seed(): Promise<{ alice: Phone; dm: string }> {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  for (let i = 0; i < COMMUNITIES; i++) await alice.req("POST", "/v1/orgs", { name: `Scroll ${String(i + 1).padStart(2, "0")}` });
  const org = (await alice.req("GET", "/v1/orgs")).orgs.find((o: { name: string }) => o.name === "Scroll 01").id;
  for (const cat of ["Alpha", "Beta", "Gamma"]) {
    const categoryId = (await alice.req("POST", `/v1/orgs/${org}/categories`, { name: cat })).category?.id ?? null;
    for (let i = 0; i < 9; i++) await alice.req("POST", `/v1/orgs/${org}/channels`, { name: `${cat.toLowerCase()}-${i}`, scope: "ORG", kind: "PUBLIC", categoryId });
  }
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  for (let i = 1; i <= 80; i++) await bob.send(dm, { type: "text", text: `Line ${i} of a long history` });
  await alice.connect();
  return { alice, dm };
}

/** A finger swipe of [dx], [dy] pixels starting in the middle of [target] (negative dy scrolls the content up). */
async function swipe(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
  const box = (await target.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + Math.min(box.height / 2, 200)),
    xDistance: dx,
    yDistance: dy,
    gestureSourceType: "touch",
    speed: 1200,
  });
  await cdp.detach();
}

const scrollTop = (l: Locator) => l.evaluate((el) => el.scrollTop);

test("phone: the community rail and the channels each swipe up and down on their own, and a swipe opens nothing", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone layout (touch gestures are synthesised through Chromium's DevTools protocol)");
  const { alice } = await seed();
  await link(page, alice);
  await page.goto("/home");

  // Home on a phone is the Android app's: the rail of communities beside the channels.
  const rail = page.locator("nav.rail");
  await expect(rail).toBeVisible();
  await rail.getByRole("button", { name: /^Scroll 01/ }).click();
  const channels = page.locator(".side-scroll");
  await expect(channels).toContainText("gamma-8");
  const url = page.url();

  // Up and down the rail; the channels don't move with it.
  const rail0 = await scrollTop(rail);
  await swipe(page, rail, 0, rail0 > 100 ? 400 : -400);
  await expect.poll(async () => Math.abs((await scrollTop(rail)) - rail0)).toBeGreaterThan(100);
  expect(await scrollTop(channels)).toBe(0);
  expect(page.url()).toBe(url);
  await expect(channels).toContainText("gamma-8");

  // Up and down the channel list; a swipe that starts on a channel doesn't open it.
  await swipe(page, channels, 0, -400);
  await expect.poll(() => scrollTop(channels)).toBeGreaterThan(150);
  expect(page.url()).toBe(url);
  await swipe(page, channels, 0, 400);
  await expect.poll(() => scrollTop(channels)).toBeLessThan(150);

  // A tap still opens, and the list header has search instead of a top bar.
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.getByRole("button", { name: "Search Meldiq" })).toBeVisible();
  await page
    .getByRole("link", { name: /alpha-0/ })
    .first()
    .click();
  await expect(page).not.toHaveURL(url);
});

test("desktop: the wheel scrolls the rail, the channel list and the messages, each on its own", async ({ page, isMobile }) => {
  test.skip(isMobile, "the desktop layout");
  const { alice } = await seed();
  await link(page, alice);
  await page.goto("/home");

  const rail = page.locator("nav.rail");
  await expect(rail.getByRole("button", { name: /^Scroll 18/ })).toBeAttached();
  await rail.getByRole("button", { name: /^Scroll 01/ }).click();
  const channels = page.locator(".side-scroll");
  await expect(channels).toContainText("gamma-8");

  const railBox = (await rail.boundingBox())!;
  await page.mouse.move(railBox.x + railBox.width / 2, railBox.y + 300);
  const rail0 = await scrollTop(rail);
  await page.mouse.wheel(0, rail0 > 100 ? -600 : 600);
  await expect.poll(async () => Math.abs((await scrollTop(rail)) - rail0)).toBeGreaterThan(100);

  const side0 = await scrollTop(channels);
  const sideBox = (await channels.boundingBox())!;
  await page.mouse.move(sideBox.x + sideBox.width / 2, sideBox.y + 200);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => scrollTop(channels)).toBeGreaterThan(side0 + 100);
  // The rail didn't move with it.
  const railNow = await scrollTop(rail);
  await page.mouse.wheel(0, 300);
  expect(await scrollTop(rail)).toBe(railNow);
});
