import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * The layout at every size the web supports (2026-10-22): from a 320 px phone (iPhone SE, and an iPhone 8 with Display
 * Zoom) to desktop. Nothing may scroll sideways and the composer must be on screen. Layout only: CSS sizes in Chromium,
 * not a phone's browser (docs/MELDIQ_WEB_BROWSERS.md). ORBIT_E2E_SHOTS=<folder> keeps a screenshot of each.
 */
test.skip(({ browserName }) => browserName !== "chromium", "one engine is enough for layout sizes");
test.describe.configure({ timeout: 180_000 });

const SIZES = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
] as const;

const SHOTS = process.env.ORBIT_E2E_SHOTS;

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** Nothing on the page is wider than the window. */
async function noSidewaysScroll(page: Page, what: string): Promise<void> {
  const r = await page.evaluate(() => {
    const w = window.innerWidth;
    const wide = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((el) => {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) return false;
        const style = getComputedStyle(el);
        if (style.position === "fixed" && b.right <= 0) return false;
        // Inside something that scrolls sideways on purpose (tab strips, the people strip) is fine.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return false;
        }
        return b.right > w + 1;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`);
    return { scrollWidth: document.documentElement.scrollWidth, w, wide };
  });
  expect(r.scrollWidth, `${what}: page wider than the window`).toBeLessThanOrEqual(r.w);
  expect(r.wide, `${what}: elements past the right edge`).toEqual([]);
}

/**
 * The conversation list (a scrolling box, so the page-wide check above skips it): no row is wider than the list, so
 * names, previews and times end inside it (reported: long previews and "Yesterday" ran past the sidebar's edge).
 */
async function listFits(page: Page, what: string): Promise<void> {
  const r = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".side-scroll");
    if (!list || !list.getClientRects().length) return null;
    const edge = list.getBoundingClientRect().right;
    const past = Array.from(list.querySelectorAll<HTMLElement>(".side-item, .side-item .time, .side-item small"))
      .filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > edge + 1)
      .slice(0, 3)
      .map((el) => `${el.className}: ${el.textContent?.slice(0, 30)}`);
    return { scrolls: list.scrollWidth > list.clientWidth + 1, past };
  });
  if (!r) return;
  expect(r.scrolls, `${what}: the conversation list scrolls sideways`).toBe(false);
  expect(r.past, `${what}: list rows past the list's edge`).toEqual([]);
}

test("every screen fits from 320 px phones to desktop, with the composer on screen", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Layout Lab" });
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  // After linking, so this browser receives it (sent before, it would be for the phone's devices only).
  await bob.send(dm, { type: "text", text: "A long message that wraps on a small phone, with a link https://example.com/a/rather/long/path/that/could/overflow and more words." });
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string | null; name: string | null; voice: boolean }[];
  const channel = channels.find((c) => c.orgId === org.id && !c.voice)!;

  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    const screens: [string, string][] = [
      ["home", "/#/home"],
      ["dm", `/#/dms/c/${dm}`],
      ["channel", `/#/home/c/${channel.id}`],
      ["details", `/#/dms/c/${dm}/details`],
      ["channel-details", `/#/home/c/${channel.id}/details`],
      ["settings", "/#/settings/notifications"],
    ];
    for (const [name, hash] of screens) {
      await page.goto(hash);
      await page.waitForTimeout(600);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${width}x${height}-${name}.png` });
      await noSidewaysScroll(page, `${width}x${height} ${name}`);
      await listFits(page, `${width}x${height} ${name}`);
      if (name === "dm" || name === "channel") {
        const composer = page.locator(".composer textarea").first();
        await expect(composer, `${width}x${height} ${name}: composer`).toBeVisible();
        const box = (await composer.boundingBox())!;
        expect(box.y + box.height, `${width}x${height} ${name}: composer below the screen`).toBeLessThanOrEqual(height);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
  }
});
