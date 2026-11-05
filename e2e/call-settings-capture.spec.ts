import { expect, test } from "@playwright/test";
import { onboardNormalAccount } from "./normalAccount";

type Probe = { constraints: MediaStreamConstraints[]; tracks: MediaStreamTrack[] };
declare global {
  interface Window {
    captureProbe: Probe;
  }
}

test.use({ serviceWorkers: "block" });
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Controlled desktop fake microphone and camera");

test("the microphone check uses selected processing and releases its capture tracks", async ({ page, context }) => {
  await page.addInitScript(() => {
    const probe: Probe = { constraints: [], tracks: [] };
    window.captureProbe = probe;
    if (!navigator.mediaDevices) return;
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      probe.constraints.push(constraints ?? {});
      const stream = await get(constraints);
      probe.tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await onboardNormalAccount(page, context, "Call settings fixture");
  await page.goto("/settings/calls");
  const check = page.getByRole("button", { name: "Start the check", exact: true });
  await expect(check).toBeVisible();
  const microphone = page.getByRole("combobox", { name: "Microphone", exact: true });
  const speakers = page.getByRole("combobox", { name: "Speakers", exact: true });
  await expect(microphone).toBeVisible();
  await expect(speakers).toBeVisible();
  const output = page.getByRole("slider", { name: /Output volume/i });
  await output.press("Home");
  await expect(output).toHaveValue("0");
  const noise = page.getByRole("switch", { name: "Noise suppression", exact: true });
  const echo = page.getByRole("switch", { name: "Echo cancellation", exact: true });
  const gain = page.getByRole("switch", { name: "Automatic gain", exact: true });
  if ((await noise.getAttribute("aria-checked")) !== "true") await noise.click();
  if ((await echo.getAttribute("aria-checked")) !== "false") await echo.click();
  if ((await gain.getAttribute("aria-checked")) !== "false") await gain.click();
  await check.click();
  await expect(page.getByRole("meter", { name: "Microphone level", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.captureProbe.tracks.some((t) => t.kind === "audio" && t.readyState === "live"))).toBe(true);
  expect(await page.evaluate(() => window.captureProbe.constraints.at(-1)?.audio)).toMatchObject({
    noiseSuppression: true,
    echoCancellation: false,
    autoGainControl: false,
  });
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.captureProbe.tracks.every((t) => t.readyState === "ended"))).toBe(true);
  await expect(page.getByRole("meter")).toHaveCount(0);
});
