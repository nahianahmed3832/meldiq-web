import { expect, type Page, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * One voice message at a time (2026-10-24): recorded here from the fake microphone, then played. Starting one pauses the
 * other at once, rapid clicks end with one playing, and leaving the conversation stops it.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Chromium's fake microphone records the messages");
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

type Snapshot = { key: string | null; status: string; positionMs: number };
const playback = (page: Page) => page.evaluate(() => (window as unknown as { __voicePlayback: { snapshot(): Snapshot } }).__voicePlayback.snapshot());
/** Whether the page's one voice player is really playing (not paused, time moving). */
const audioPlaying = (page: Page) => page.evaluate(() => (window as unknown as { __voicePlayback: { audio: HTMLAudioElement | null } }).__voicePlayback.audio?.paused === false);

async function record(page: Page, ms: number): Promise<void> {
  await page.getByRole("button", { name: "Record a voice message" }).click();
  await expect(page.getByRole("group", { name: "Recording a voice message" })).toBeVisible();
  await page.waitForTimeout(ms);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Send voice message" }).click();
}

test("starting a voice message pauses the one playing, rapid clicks leave one playing, and leaving stops it", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const carol = await newPhone("carol", "Carol Diaz");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const other = (await alice.req("POST", "/v1/conversations/dm", { userId: carol.userId })).conversation.id as string;
  await link(page, alice);
  await page.goto(`/dms/c/${dm}`);
  await record(page, 3_000);
  await record(page, 3_000);
  const voices = page.locator(".voice-msg");
  await expect(voices).toHaveCount(2, { timeout: 30_000 });
  const [a, b] = [voices.nth(0), voices.nth(1)];

  await a.getByRole("button", { name: /^Play voice message/ }).click();
  await expect(a).toHaveAttribute("data-voice-state", "playing", { timeout: 15_000 });
  await expect.poll(() => audioPlaying(page)).toBe(true);
  // B starts: A pauses at once, and there is only ever the one player.
  await b.getByRole("button", { name: /^Play voice message/ }).click();
  await expect(b).toHaveAttribute("data-voice-state", "playing", { timeout: 15_000 });
  await expect(a).toHaveAttribute("data-voice-state", "idle");
  await expect(a.getByRole("button", { name: /^Play voice message/ })).toBeVisible();
  expect(await page.locator("audio").count()).toBe(0);

  // Rapid clicks: the last one asked for plays, nothing else.
  for (let i = 0; i < 3; i++) {
    await a.locator(".voice-play").click();
    await b.locator(".voice-play").click();
  }
  await a.locator(".voice-play").click();
  await expect(a).toHaveAttribute("data-voice-state", "playing", { timeout: 15_000 });
  await expect(b).toHaveAttribute("data-voice-state", "idle");
  await expect.poll(() => audioPlaying(page)).toBe(true);

  // Speed carries over; pausing and resuming keep the place.
  await a.getByRole("button", { name: /Playback speed 1 times/ }).click();
  await expect(a.getByRole("button", { name: /Playback speed 1.5 times/ })).toBeVisible();
  await a.getByRole("button", { name: "Pause voice message" }).click();
  await expect(a).toHaveAttribute("data-voice-state", "paused");
  const paused = (await playback(page)).positionMs;
  await a.getByRole("button", { name: /^Play voice message/ }).click();
  await expect(a).toHaveAttribute("data-voice-state", "playing");
  expect((await playback(page)).positionMs).toBeGreaterThanOrEqual(paused);

  // Leaving the conversation (in the app, no reload) stops it.
  await page
    .getByRole("link", { name: /Carol Diaz/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(other));
  await expect.poll(async () => (await playback(page)).status).toBe("idle");
  await expect.poll(() => audioPlaying(page)).toBe(false);
});
