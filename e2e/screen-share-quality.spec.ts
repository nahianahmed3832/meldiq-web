import { expect, test } from "@playwright/test";
import { answerCall, nativePeerMissing } from "./callPeer";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * This browser shares its screen at High (1920×1080 at 60) and switches to Standard (1280×720 at 30) mid-share; the
 * native peer (as the Android app) decrypts and decodes what arrives. Chromium's fake screen capture stands in for a real
 * screen, so the numbers are what this machine's Chromium captures and encodes, recorded as test annotations.
 */
test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Chromium's fake screen capture");
test.describe.configure({ timeout: 180_000 });
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--auto-select-desktop-capture-source=Entire screen"] } });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

/** "Sharing · High · 1920×1080 · 58 fps" → the numbers. */
function parsePill(text: string): { quality: string; width: number; height: number; fps: number } | null {
  const m = /Sharing · (\w+) · (\d+)×(\d+) · (\d+) fps/.exec(text);
  return m ? { quality: m[1], width: Number(m[2]), height: Number(m[3]), fps: Number(m[4]) } : null;
}

test("shares at High and at Standard: the capture and encoding follow the mode, the peer decodes it, and the UI says what's sent", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await page.getByRole("button", { name: "Start a voice call" }).click();
  const call = await answerCall(bob, false);
  const stage = page.getByRole("dialog", { name: "Call with Bob Chen" });
  try {
    await expect(stage.getByRole("status")).toHaveText(/^\d+:\d\d$/, { timeout: 30_000 });
    await stage.getByRole("button", { name: "Share your screen" }).click();
    const dialog = page.getByRole("dialog", { name: "Share your screen" });
    await dialog.getByRole("radio", { name: /^High/ }).click();
    await dialog.getByRole("button", { name: "Share" }).click();

    const pill = stage.getByTestId("share-pill");
    await expect(pill).toContainText("Sharing · High", { timeout: 20_000 });
    await expect.poll(async () => parsePill((await pill.textContent()) ?? ""), { timeout: 30_000 }).not.toBeNull();
    // The capture as the browser delivers it, and the encoder's output, a few seconds in.
    await page.waitForTimeout(6_000);
    const high = parsePill((await pill.textContent()) ?? "")!;
    const stats = () => page.evaluate(() => (window as unknown as { __orbit: { state: { get(): { call: { shareStats: unknown } } } } }).__orbit.state.get().call.shareStats);
    const captured = await stats();
    await expect.poll(() => call.media.received.video.frames, { timeout: 30_000 }).toBeGreaterThan(30);
    const peerWidthHigh = call.media.received.video.width ?? 0;
    test.info().annotations.push({ type: "high", description: `sent ${high.width}×${high.height} at ${high.fps} fps; peer decoded width ${peerWidthHigh}; capture ${JSON.stringify(captured)}` });
    expect(high.quality).toBe("High");
    expect(high.height).toBeLessThanOrEqual(1080);
    expect(peerWidthHigh).toBeGreaterThan(0);
    expect(peerWidthHigh).toBeLessThanOrEqual(1920);
    // When the browser delivers less than High, the presenter is told.
    const shortfall = stage.getByText(/^High asks for 1920×1080 at 60 fps/);
    if (high.height < 1026 || high.fps < 54) await expect(shortfall).toBeVisible({ timeout: 10_000 });

    // Standard during the share: the same share steps to 720p30 at most.
    await pill.click();
    await page
      .getByRole("menuitemradio", { name: /^Standard/ })
      .or(page.getByRole("menuitem", { name: /^Standard/ }))
      .click();
    await expect(pill).toContainText("Sharing · Standard", { timeout: 10_000 });
    await expect.poll(async () => parsePill((await pill.textContent()) ?? "")?.height ?? 9999, { timeout: 30_000 }).toBeLessThanOrEqual(720);
    const before = call.media.received.video.frames;
    await expect.poll(() => call.media.received.video.frames, { timeout: 20_000 }).toBeGreaterThan(before + 20);
    await page.waitForTimeout(4_000);
    const standard = parsePill((await pill.textContent()) ?? "")!;
    test.info().annotations.push({
      type: "standard",
      description: `sent ${standard.width}×${standard.height} at ${standard.fps} fps; peer decoded width ${call.media.received.video.width}; stats ${JSON.stringify(await stats())}`,
    });
    expect(standard.fps).toBeLessThanOrEqual(31);
    expect(call.media.received.video.width ?? 0).toBeLessThanOrEqual(1280);

    await stage.getByRole("button", { name: "Stop sharing your screen" }).click();
    await expect(pill).toHaveCount(0);
  } finally {
    await call.media.leave();
  }
});
