import crypto from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { NativeMedia, nativePeerMissing, waitUntil } from "./callPeer";
import { link } from "./link";
import { newPhone, type Phone, testAddress } from "./phone";

/**
 * Several screens shared at once (2026-10-24, like Discord's streams): two native participants (LiveKit's native SDK, as
 * the Android app publishes) share real, encrypted screen tracks in a voice room; this browser lists both in the tray,
 * shows the one it watches, receives only that one, and moves on when shares end. Not a physical-device test.
 */
test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "one engine is enough for the share logic");
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

type Sub = { identity: string; source: string; subscribed: boolean };
const subscriptions = (page: Page) => page.evaluate(() => ((globalThis as { __orbitShareSubscriptions?: () => Sub[] }).__orbitShareSubscriptions?.() ?? []) as Sub[]);
/** Whose screen video this browser receives now. */
const receivedScreens = async (page: Page, ids: Record<string, string>) =>
  (await subscriptions(page))
    .filter((s) => s.source === "screen_share" && s.subscribed)
    .map((s) => Object.keys(ids).find((k) => s.identity.startsWith(ids[k]))!)
    .sort();

/** The watched share's frame width, once its frames play. */
const watchedWidth = (page: Page) => page.locator("figure.call-screen video").evaluate((v: HTMLVideoElement) => v.videoWidth);

async function voiceRoom() {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const carol = await newPhone("carol", "Carol Diaz");
  for (const p of [alice, bob, carol]) await p.connect();
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Stream Lab" });
  for (const p of [bob, carol]) {
    const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
    await p.req("POST", "/v1/invites/accept", { code: invite.code });
  }
  const { channel } = await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "streams", voice: true });
  // Bob opens the room as the phone app does; Carol joins it with the room's key.
  const res = await bob.req("POST", "/v1/calls", { conversationId: channel.id, video: false });
  const key = crypto.randomBytes(32).toString("base64");
  await bob.send(channel.id, { type: "call_invite", callId: res.call.id, video: false, e2eeKey: key }, "control");
  const bobMedia = await NativeMedia.join(res.media, key, false);
  const join = await carol.req("POST", `/v1/calls/${res.call.id}/join`);
  const carolMedia = await NativeMedia.join(join.media, key, false);
  await carol.req("POST", `/v1/calls/${res.call.id}/connected`);
  return { alice, bob, carol, channel, callId: res.call.id as string, key, bobMedia, carolMedia };
}

async function joinFromBrowser(page: Page, alice: Phone, bob: Phone, channelId: string, callId: string, key: string) {
  await link(page, alice);
  await page.goto(`/#/home/c/${channelId}`);
  await page.getByLabel("Voice room").getByRole("button", { name: "Join voice" }).click();
  await waitUntil(() => bob.received.find((m: any) => m.payload?.type === "call_key_request" && m.payload.callId === callId), 20_000, "the browser's key request");
  await bob.send(channelId, { type: "call_invite", callId, video: false, e2eeKey: key }, "control");
  const stage = page.getByRole("dialog", { name: /^Call with/ });
  await expect(stage).toBeVisible();
  return stage;
}

test("two screens shared at once: both listed, one watched and received, picked per viewer, and the end of each handled", async ({ page }) => {
  const r = await voiceRoom();
  const ids = { bob: `${r.bob.userId}.`, carol: `${r.carol.userId}.` };
  try {
    // Bob shares before this browser joins (joining mid-call).
    await r.bobMedia.shareScreen(1280, 720);
    const stage = await joinFromBrowser(page, r.alice, r.bob, r.channel.id, r.callId, r.key);
    const tray = stage.getByRole("region", { name: "Screens being shared" });

    // The first share opens by itself, whole.
    await expect(stage.getByRole("figure", { name: "Bob Chen's screen" })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => watchedWidth(page), { timeout: 30_000 }).toBe(1280);
    await expect(tray.getByRole("button", { name: "Watching Bob Chen's screen" })).toHaveAttribute("aria-pressed", "true");
    await expect(stage.getByTestId("watch-stats")).toContainText("1280×720", { timeout: 15_000 });

    // Carol shares too: listed, but she doesn't take over, and her screen isn't received.
    await r.carolMedia.shareScreen(960, 540);
    await expect(tray.getByRole("button", { name: "Watch Carol Diaz's screen" })).toBeVisible({ timeout: 20_000 });
    await expect(tray.locator(".live-badge")).toHaveCount(2);
    await expect(stage.getByRole("figure", { name: "Bob Chen's screen" })).toBeVisible();
    await expect.poll(() => receivedScreens(page, ids), { timeout: 15_000 }).toEqual(["bob"]);

    // Watching Carol's instead: her frames show, and only hers are received now.
    await tray.getByRole("button", { name: "Watch Carol Diaz's screen" }).click();
    await expect(stage.getByRole("figure", { name: "Carol Diaz's screen" })).toBeVisible();
    await expect.poll(() => watchedWidth(page), { timeout: 30_000 }).toBe(960);
    await expect.poll(() => receivedScreens(page, ids), { timeout: 15_000 }).toEqual(["carol"]);
    // Whole, never cropped, in full screen too.
    const fit = await page.locator("figure.call-screen video").evaluate((v) => getComputedStyle(v).objectFit);
    expect(fit).toBe("contain");
    await stage.getByRole("button", { name: "Show the shared screen full screen" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute("aria-label") ?? null)).toBe("Carol Diaz's screen");
    await page.evaluate(() => document.exitFullscreen());

    // Bob stops: Carol's stays on screen.
    await r.bobMedia.stopScreen();
    await expect(tray.getByRole("button", { name: /Bob Chen's screen/ })).toHaveCount(0, { timeout: 20_000 });
    await expect(stage.getByRole("figure", { name: "Carol Diaz's screen" })).toBeVisible();

    // Back to the people by choice: a share then waits in the tray.
    await stage.getByRole("button", { name: "Stop watching and show the people" }).click();
    await expect(page.locator(".call-tiles")).toBeVisible();
    await expect.poll(() => receivedScreens(page, ids), { timeout: 15_000 }).toEqual([]);
    await r.bobMedia.shareScreen(1280, 720);
    await expect(tray.getByRole("button", { name: "Watch Bob Chen's screen" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("figure.call-screen")).toHaveCount(0);

    // Every share ends: the tray goes.
    await r.bobMedia.stopScreen();
    await r.carolMedia.stopScreen();
    await expect(tray).toHaveCount(0, { timeout: 20_000 });
  } finally {
    await r.bobMedia.leave();
    await r.carolMedia.leave();
  }
});

test("when the watched presenter leaves the call, another share is picked", async ({ page }) => {
  const r = await voiceRoom();
  try {
    await r.bobMedia.shareScreen(1280, 720);
    await r.carolMedia.shareScreen(960, 540);
    const stage = await joinFromBrowser(page, r.alice, r.bob, r.channel.id, r.callId, r.key);
    const tray = stage.getByRole("region", { name: "Screens being shared" });
    await expect(tray.locator(".live-badge")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.locator("figure.call-screen")).toBeVisible({ timeout: 30_000 });
    const first = (await page.locator("figure.call-screen").getAttribute("aria-label"))!;
    const leaving = first.startsWith("Bob") ? r.bobMedia : r.carolMedia;
    const other = first.startsWith("Bob") ? "Carol Diaz's screen" : "Bob Chen's screen";
    await leaving.leave();
    await expect(stage.getByRole("figure", { name: other })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => watchedWidth(page), { timeout: 30_000 }).toBeGreaterThan(0);
  } finally {
    await r.bobMedia.leave();
    await r.carolMedia.leave();
  }
});
