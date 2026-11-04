import { expect, test } from "@playwright/test";
import { nativePeerMissing, placeCall } from "./callPeer";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test("changing language preserves an active encrypted video call", async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  const alice = await newPhone("localecallalice", "Alice Rahman");
  const bob = await newPhone("localecallbob", "Bob Chen");
  await bob.connect();
  const conversationId = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await link(page, alice);
  const call = await placeCall(bob, conversationId, true);
  try {
    await page.getByRole("button", { name: "Answer with video" }).click();
    const stage = page.locator(".call-stage");
    await expect(stage.locator(".e2ee-badge")).toHaveText("Encrypted call", { timeout: 30_000 });
    const video = stage.locator("figure.call-tile:not(.local) video");
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(0);
    const trackId = await video.evaluate((element: HTMLVideoElement) => (element.srcObject as MediaStream).getVideoTracks()[0].id);
    await stage.getByRole("button", { name: "Minimise the call", exact: true }).click();
    const before = call.media.received.audio.frames;
    // The application's own in-page route protocol preserves the running engine and media session.
    await page.evaluate(() => {
      history.pushState({ meldiq: 1 }, "", "/settings/language");
      dispatchEvent(new Event("meldiq:route"));
    });
    await page.locator("button.lang-picker").first().click();
    await page.getByRole("option", { name: "العربية", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".language-dialog")).toHaveCount(0);
    if (await page.locator(".settings-window-close").isVisible()) await page.locator(".settings-window-close").click();
    await page.getByRole("button", { name: "Show the call", exact: true }).first().click();
    await expect(stage).toBeVisible();
    expect(await video.evaluate((element: HTMLVideoElement) => (element.srcObject as MediaStream).getVideoTracks()[0].id)).toBe(trackId);
    const time = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(time);
    await expect.poll(() => call.media.received.audio.frames).toBeGreaterThan(before + 30);
    await expect(stage.getByRole("button", { name: "إيقاف الكاميرا", exact: true })).toBeVisible();
    await stage.getByRole("button", { name: "إنهاء المكالمة", exact: true }).click();
    await expect(stage).toBeHidden();
  } finally {
    await call.media.leave();
    await bob.disconnect();
  }
});
