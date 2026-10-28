import { expect, type Page, test } from "@playwright/test";
import { answerCall, nativePeerMissing } from "./callPeer";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * A screen shared by the phone app, received here (reported bug 2026-10-22: a portrait phone screen showed as a shallow,
 * cropped strip). The native peer publishes a screen-share track like the Android app, with a coloured band on each
 * edge; the whole frame must fit inside its panel, unstretched, at every window size. Not a physical-device test.
 */
test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

const SHOTS = process.env.ORBIT_E2E_SHOTS;

interface Fit {
  frame: { w: number; h: number };
  panel: { w: number; h: number };
  /** Where the picture itself is drawn (object-fit applied), relative to the panel. */
  drawn: { left: number; top: number; right: number; bottom: number; w: number; h: number };
}

/** The received frame's size and where it's drawn inside its panel. */
async function fit(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const fig = document.querySelector<HTMLElement>("figure.call-screen")!;
    const v = fig.querySelector("video")!;
    const pr = fig.getBoundingClientRect();
    const vr = v.getBoundingClientRect();
    const fitStyle = getComputedStyle(v).objectFit;
    const scale = fitStyle === "cover" ? Math.max(vr.width / v.videoWidth, vr.height / v.videoHeight) : Math.min(vr.width / v.videoWidth, vr.height / v.videoHeight);
    const w = v.videoWidth * scale;
    const h = v.videoHeight * scale;
    const left = vr.left + (vr.width - w) / 2 - pr.left;
    const top = vr.top + (vr.height - h) / 2 - pr.top;
    return { frame: { w: v.videoWidth, h: v.videoHeight }, panel: { w: pr.width, h: pr.height }, drawn: { left, top, right: left + w, bottom: top + h, w, h } };
  });
}

/** The whole frame is inside the panel (1 px tolerance) and keeps its own proportions. */
function expectWhole(f: Fit): void {
  expect(f.drawn.left).toBeGreaterThanOrEqual(-1);
  expect(f.drawn.top).toBeGreaterThanOrEqual(-1);
  expect(f.drawn.right).toBeLessThanOrEqual(f.panel.w + 1);
  expect(f.drawn.bottom).toBeLessThanOrEqual(f.panel.h + 1);
  expect(f.drawn.w / f.drawn.h).toBeCloseTo(f.frame.w / f.frame.h, 1);
}

async function callWithShare(page: Page, width: number, height: number) {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId });
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await page
    .getByRole("complementary", { name: "Conversations" })
    .getByRole("link", { name: /Bob Chen/ })
    .click();
  await page.getByRole("button", { name: "Start a voice call" }).click();
  const call = await answerCall(bob, false);
  await call.media.shareScreen(width, height);
  const screen = page.getByRole("figure", { name: "Bob Chen's screen" });
  await expect(screen).toBeVisible({ timeout: 20_000 });
  // The frames' shape, not their size: LiveKit's adaptive stream may send a smaller layer of the same picture.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const v = document.querySelector<HTMLVideoElement>("figure.call-screen video");
          return v && v.videoWidth ? Math.round((v.videoHeight / v.videoWidth) * 100) / 100 : 0;
        }),
      { timeout: 20_000 },
    )
    .toBeCloseTo(height / width, 1);
  return call;
}

for (const [name, w, h] of [
  ["a portrait phone screen", 540, 1170],
  ["a landscape screen", 1920, 1080],
] as const) {
  test(`${name} shared from the phone app shows whole, unstretched, at every window size`, async ({ page }) => {
    // The reported laptop: a wide window that isn't tall (browser chrome and the dock take the rest).
    await page.setViewportSize({ width: 1280, height: 620 });
    const call = await callWithShare(page, w, h);
    try {
      for (const size of [
        { width: 1280, height: 620 },
        { width: 1440, height: 900 },
        { width: 820, height: 560 },
        { width: 390, height: 780 },
      ]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(400);
        const f = await fit(page);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/screen-${w}x${h}-${size.width}x${size.height}.png` });
        expectWhole(f);
        // A useful size: the picture fills the panel in at least one direction (no shrinking beyond "contain").
        expect(Math.max(f.drawn.w / f.panel.w, f.drawn.h / f.panel.h)).toBeGreaterThan(0.97);
        // On a wide window a portrait phone gets the height (people beside it, not under it).
        if (h > w && size.width > 640) expect(f.drawn.h).toBeGreaterThan(size.height * 0.55);
      }
      // Stopping the share gives the call its people layout back.
      await call.media.stopScreen();
      await expect(page.getByRole("figure", { name: "Bob Chen's screen" })).toHaveCount(0, { timeout: 15_000 });
      await expect(page.locator(".call-tiles")).toBeVisible();
      await expect(page.getByText("Bob Chen stopped sharing their screen")).toBeVisible();
    } finally {
      await call.media.leave();
    }
  });
}
