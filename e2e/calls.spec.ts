import { expect, type Locator, type Page, test } from "@playwright/test";
import { verificationCode } from "../src/call/callKeys";
import { answerCall, type NativeMedia, nativePeerMissing, placeCall, waitUntil } from "./callPeer";
import { link } from "./link";
import { newPhone, type Phone, testAddress } from "./phone";

/**
 * Calls in real browser engines, with real end-to-end encrypted media through a local LiveKit server, against a
 * native LiveKit participant that uses the same frame cryptor as the Android app (e2e/callPeer.ts). Fake microphones
 * and cameras (playwright.config.ts). This is not the physical-phone test (docs/ORBIT_WEB_CALLS.md › Phone test).
 */
test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test.afterEach(async ({ context }, info) => {
  if (info.status === info.expectedStatus) return;
  for (const [i, p] of context.pages().entries()) {
    const tracks = await p.evaluate(() => (globalThis as { __orbitCallTracks?: () => unknown }).__orbitCallTracks?.()).catch(() => null);
    await info.attach(`call-tracks-${i}.json`, { body: JSON.stringify(tracks, null, 1), contentType: "application/json" });
    const text = await p
      .locator("body")
      .innerText()
      .catch((e: Error) => `unreadable: ${e.message}`);
    await info.attach(`page-${i}.txt`, { body: `${p.url()}\n\n${text}`, contentType: "text/plain" });
  }
});

interface Pair {
  alice: Phone;
  bob: Phone;
  dm: string;
}

/** Alice's phone and Bob, a DM between them, and this page linked to Alice's account. */
async function setUp(page: Page): Promise<Pair> {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  return { alice, bob, dm };
}

const stage = (page: Page) => page.getByRole("dialog", { name: "Call with Bob Chen" });
const badge = (s: Locator) => s.locator(".e2ee-badge");

/**
 * Waits for "End-to-end encrypted". If it doesn't come, the per-track evidence is attached right away, while the call is
 * still up (after the test the call has usually ended and the evidence is gone).
 */
async function expectEncrypted(page: Page, s: Locator): Promise<void> {
  try {
    await expect(badge(s)).toHaveText("End-to-end encrypted", { timeout: 30_000 });
  } catch (e) {
    const tracks = await page.evaluate(() => (globalThis as { __orbitCallTracks?: () => unknown }).__orbitCallTracks?.()).catch(() => null);
    await test.info().attach("call-tracks-at-failure.json", { body: JSON.stringify(tracks, null, 1), contentType: "application/json" });
    throw e;
  }
}

/** The remote person's video is playing: decoded frames with a size, and time moving. */
async function remoteVideoPlays(page: Page): Promise<void> {
  const video = stage(page).locator("figure.call-tile:not(.local) video");
  await expect(video).toHaveCount(1, { timeout: 20_000 });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);
  const t0 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(t0);
}

/** The native participant decrypted and decoded the browser's fake microphone (sound well past its start-up noise). */
async function heardBrowser(media: NativeMedia): Promise<void> {
  await expect.poll(() => media.sustainedAudio(), { timeout: 20_000 }).toBeGreaterThan(50);
}

async function endedEvent(p: Phone, callId: string): Promise<any> {
  return waitUntil(() => p.events.find((e) => e.t === "call" && e.event === "ended" && e.call?.id === callId), 15_000, "the call to end");
}

test("a video call from the phone app rings here and connects with media verified encrypted both ways", async ({ page }) => {
  const { bob, dm } = await setUp(page);
  const call = await placeCall(bob, dm, true);
  try {
    const ringing = page.getByRole("alertdialog", { name: "Incoming video call from Bob Chen" });
    await expect(ringing).toBeVisible({ timeout: 15_000 });
    await ringing.getByRole("button", { name: "Answer with video" }).click();

    const s = stage(page);
    await expect(s).toBeVisible();
    await expectEncrypted(page, s);
    await expect(s.getByRole("status")).toHaveText(/^\d+:\d\d$/); // the call timer
    await remoteVideoPlays(page);
    await expect(page.locator("[data-orbit-call-audio] audio")).toHaveCount(1); // Bob's voice, once proven to decrypt
    // The native side decrypted the browser's audio and video with the same key (it hears the fake microphone).
    await heardBrowser(call.media);
    await expect.poll(() => call.media.received.video.frames, { timeout: 20_000 }).toBeGreaterThan(20);

    // The verification code is the one every device holding this call's key derives.
    await badge(s).click();
    const code = await verificationCode(call.key, call.id);
    await expect(s.getByLabel("Verification code", { exact: true })).toContainText(code.digits);

    await s.getByRole("button", { name: "Hang up" }).click();
    expect((await endedEvent(bob, call.id)).call.endReason).toBe("hangup");
    await expect(s).toBeHidden({ timeout: 10_000 });
  } finally {
    await call.media.leave();
  }
});

test("the browser calls the phone app; each side decrypts the other's audio", async ({ page }) => {
  const { bob } = await setUp(page);
  await page.getByRole("link", { name: /Bob Chen/ }).click();
  await page.getByRole("button", { name: "Start a voice call" }).click();
  const s = stage(page);
  await expect(s.getByRole("status")).toHaveText(/Calling…|Ringing…/, { timeout: 15_000 });
  const call = await answerCall(bob, false);
  try {
    await expectEncrypted(page, s);
    await expect(s.getByRole("status")).toHaveText(/^\d+:\d\d$/);
    await heardBrowser(call.media);
    await s.getByRole("button", { name: "Mute" }).click();
    await expect(s.getByRole("button", { name: "Unmute" })).toBeVisible();

    await bob.req("POST", `/v1/calls/${call.id}/end`); // the phone hangs up
    await expect(s.getByRole("status")).toHaveText("Call ended", { timeout: 10_000 });
    await expect(s).toBeHidden({ timeout: 10_000 });
  } finally {
    await call.media.leave();
  }
});

/** Whether two boxes overlap. */
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("a minimised call stays clear of the message box, can be dragged and moved with the keys, and messages still send", async ({ page }) => {
  const { bob, dm } = await setUp(page);
  await page.getByRole("link", { name: /Bob Chen/ }).click();
  await page.getByRole("button", { name: "Start a voice call" }).click();
  const call = await answerCall(bob, false);
  try {
    await expect(stage(page).getByRole("status")).toHaveText(/^\d+:\d\d$/, { timeout: 30_000 });
    await stage(page).getByRole("button", { name: "Minimise the call" }).click();
    const mini = page.getByRole("region", { name: "Call with Bob Chen" });
    await expect(mini).toBeVisible();

    // Reported: it sat on the Send button, so nothing could be sent during a call.
    const box = page.getByLabel("Message Bob Chen");
    await box.fill("Can you hear me?");
    const send = page.getByRole("button", { name: "Send" });
    expect(overlaps((await mini.boundingBox())!, (await send.boundingBox())!)).toBe(false);
    expect(overlaps((await mini.boundingBox())!, (await box.boundingBox())!)).toBe(false);
    await send.click();
    await waitUntil(() => bob.received.find((m) => m.conversationId === dm && m.payload.text === "Can you hear me?"), 15_000, "the message during the call");

    // Dragged by its grip: it follows the pointer and stays on screen.
    const grip = mini.getByRole("button", { name: /Move the call window/ });
    const view = page.viewportSize()!;
    const dragTo = async (x: number, y: number) => {
      const g = (await grip.boundingBox())!;
      await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, y, { steps: 8 });
      await page.mouse.up();
    };
    const target = { x: Math.round(view.width / 2), y: Math.round(view.height / 2) };
    await dragTo(target.x, target.y);
    const g = (await grip.boundingBox())!;
    expect(Math.abs(g.x + g.width / 2 - target.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.y + g.height / 2 - target.y)).toBeLessThanOrEqual(2);
    await dragTo(-500, -500); // past the corner: kept on screen
    const corner = (await mini.boundingBox())!;
    expect([Math.round(corner.x), Math.round(corner.y)]).toEqual([8, 8]);

    // From the keyboard: the grip moves it with the arrow keys; the place is kept across a reload of the page.
    await grip.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    expect([Math.round((await mini.boundingBox())!.x), Math.round((await mini.boundingBox())!.y)]).toEqual([24, 24]);
    expect(await page.evaluate(() => localStorage.getItem("meldiq.miniCall.position"))).toBe(JSON.stringify({ x: 24, y: 24 }));

    await mini.getByRole("button", { name: "Hang up" }).click();
    await expect(mini).toBeHidden({ timeout: 10_000 });
  } finally {
    await call.media.leave();
  }
});

test("media under the wrong key is reported as a problem and never shown as encrypted", async ({ page }) => {
  const { bob, dm } = await setUp(page);
  const call = await placeCall(bob, dm, true, { mediaKey: Buffer.alloc(32, 7).toString("base64") });
  const seen = new Set<string>();
  try {
    await page.getByRole("button", { name: "Answer with video" }).click({ timeout: 15_000 });
    const s = stage(page);
    await expect(badge(s)).toHaveText("Encryption problem", { timeout: 30_000 });
    for (let i = 0; i < 10; i++) {
      seen.add((await badge(s).textContent()) ?? "");
      await page.waitForTimeout(300);
    }
    expect(seen.has("End-to-end encrypted")).toBe(false);
    await expect(s.getByRole("figure", { name: /encryption problem/ })).toBeVisible();
    // Nothing that didn't decrypt reaches the screen or the speaker, and the native side can't decrypt the browser either.
    await expect(s.locator("figure.call-tile:not(.local) video")).toHaveCount(0);
    await expect(page.locator("[data-orbit-call-audio] audio")).toHaveCount(0);
    expect(call.media.received.audio.frames).toBeGreaterThan(100);
    expect(call.media.sustainedAudio()).toBe(0);
  } finally {
    await call.media.leave();
  }
});

test("a refused microphone is explained: no call goes out, and an answered call connects listen-only", async ({ browser, browserName, playwright }, info) => {
  // Chromium and WebKit refuse what the context wasn't granted; Firefox refuses through its site-permission defaults.
  const firefoxBlocking =
    browserName === "firefox"
      ? await playwright.firefox.launch({ firefoxUserPrefs: { "media.navigator.streams.fake": true, "permissions.default.microphone": 2, "permissions.default.camera": 2 } })
      : null;
  const context = await (firefoxBlocking ?? browser).newContext({ viewport: info.project.use.viewport, permissions: [] });
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const page = await context.newPage();
  const { bob, dm } = await setUp(page);

  await page.getByRole("link", { name: /Bob Chen/ }).click();
  await page.getByRole("button", { name: "Start a voice call" }).click();
  await expect(stage(page).getByRole("status")).toHaveText(/isn't allowed to use your microphone/, { timeout: 15_000 });
  expect((await bob.req("GET", "/v1/calls/active")).calls).toEqual([]);
  await expect(stage(page)).toBeHidden({ timeout: 10_000 });

  const call = await placeCall(bob, dm, false);
  try {
    await page.getByRole("button", { name: "Answer" }).click({ timeout: 15_000 });
    const s = stage(page);
    await expect(s.getByRole("alert").filter({ hasText: "isn't allowed to use your microphone" })).toBeVisible({ timeout: 15_000 });
    await expect(s.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectEncrypted(page, s); // all live media (Bob's) is verified
  } finally {
    await call.media.leave();
    await context.close();
    await firefoxBlocking?.close();
  }
});

test("a call survives losing the network for a few seconds", async ({ page, context, browserName }) => {
  // Playwright's offline mode cuts open WebSocket and media connections only in Chromium; in Firefox and WebKit the call
  // carries on untouched (checked: the timer kept running), so the loss can't be simulated there.
  test.skip(browserName !== "chromium", "offline emulation doesn't cut live connections in this engine");
  const { bob, dm } = await setUp(page);
  const call = await placeCall(bob, dm, false);
  try {
    await page.getByRole("button", { name: "Answer" }).click({ timeout: 15_000 });
    const s = stage(page);
    await expectEncrypted(page, s);
    await context.setOffline(true);
    await expect(s.getByRole("status")).toHaveText(/Reconnecting/, { timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await context.setOffline(false);
    await expect(s.getByRole("status")).toHaveText(/^\d+:\d\d$/, { timeout: 60_000 });
    await expectEncrypted(page, s);
    const before = call.media.sustainedAudio();
    await expect.poll(() => call.media.sustainedAudio(), { timeout: 20_000 }).toBeGreaterThan(before);
  } finally {
    await call.media.leave();
  }
});

test("deafen silences the call both ways and undeafen puts it back as it was (batch B10)", async ({ page }) => {
  const { bob } = await setUp(page);
  await page.getByRole("link", { name: /Bob Chen/ }).click();
  await page.getByRole("button", { name: "Start a voice call" }).click();
  const s = stage(page);
  const call = await answerCall(bob, false);
  try {
    await expectEncrypted(page, s);
    await heardBrowser(call.media);
    await s.getByRole("button", { name: "Deafen" }).click();
    await expect(s.getByRole("button", { name: "Deafened" })).toHaveAttribute("aria-pressed", "true");
    // The microphone went off with it, and every incoming audio element is muted.
    await expect(s.getByRole("button", { name: "Unmute" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll("[data-orbit-call-audio] audio")).map((a) => (a as HTMLAudioElement).muted))).not.toContain(false);
    const heardBefore = call.media.received.audio.audible;
    await page.waitForTimeout(2_000);
    expect(call.media.received.audio.audible - heardBefore).toBeLessThan(10);
    await s.getByRole("button", { name: "Deafened" }).click();
    await expect(s.getByRole("button", { name: "Mute" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll("[data-orbit-call-audio] audio")).every((a) => !(a as HTMLAudioElement).muted))).toBe(true);
    await expect.poll(() => call.media.received.audio.audible, { timeout: 15_000 }).toBeGreaterThan(heardBefore + 20);
  } finally {
    await call.media.leave();
  }
});
