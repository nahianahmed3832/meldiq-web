import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import crypto from "node:crypto";
import { emailedCode } from "./mail";

test.describe.configure({ timeout: 180_000 });
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() }));
async function onboard(page: Page) {
  // Use normal email onboarding against the exact production export, without development device linking.
  let authorization = "";
  page.on("request", (request) => {
    authorization = request.headers()["authorization"] || authorization;
  });
  const email = `identity.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Media Sender");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long enough password for identity verification");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await expect(page.locator('.app[data-connection="online"]').first()).toBeVisible();
  const req = async (method: string, path: string, data?: Record<string, unknown>) => {
    expect(authorization).toMatch(/^Bearer /);
    const response = await page.request.fetch(`${process.env.ORBIT_E2E_API}${path}`, {
      method,
      headers: { authorization, "x-forwarded-for": testAddress() },
      ...(data ? { data } : {}),
    });
    expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
    return response.json();
  };
  return { userId: (await req("GET", "/v1/users/me")).user.id as string, req };
}

async function conversation(page: Page) {
  const a = await onboard(page);
  const b = await newPhone("mediapeer", "Media Recipient");
  const id = (await a.req("POST", "/v1/conversations/dm", { userId: b.userId })).conversation.id;
  await page.goto(`/dms/c/${id}`);
  await expect(page.getByRole("textbox", { name: /^Message / })).toBeVisible();
  return { a, b, id };
}

test("a photo album and a document share one caption, retain original bytes and support zoom", async ({ page }, info) => {
  await conversation(page);
  const image = fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  await page.locator(".composer input[type=file]").setInputFiles([
    { name: "first.jpg", mimeType: "application/octet-stream", buffer: image },
    { name: "second.jpg", mimeType: "image/jpeg", buffer: image },
    { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("A shared original document") },
  ]);
  await expect(page.locator(".attachment-draft")).toHaveCount(3);
  await expect(page.locator(".attachment-draft figcaption strong")).toHaveText(["first.jpg", "second.jpg", "note.txt"]);
  await expect(page.locator(".attachment-draft figcaption strong").first()).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("checkbox", { name: "Original file", exact: true })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Original file", exact: true }).check();
  await page.screenshot({ path: info.outputPath("media-composer.png"), fullPage: true });
  await page.getByRole("textbox", { name: /^Message / }).fill("Album and document");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const message = page.locator(".msg").filter({ hasText: "Album and document" });
  await expect(message).toHaveCount(1);
  await expect(message.locator(".album-tile")).toHaveCount(2);
  await message.locator(".album-tile").first().click();
  await expect(page.locator(".lightbox img.viewer-original")).toBeVisible();
  await page.getByRole("button", { name: "Actual image size", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("150%");
  const downloading = page.waitForEvent("download");
  await page.locator(".lightbox").getByRole("button", { name: "Download photo", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("first.jpg");
  expect(fs.readFileSync((await download.path())!)).toEqual(image);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  const fileDownload = page.waitForEvent("download");
  await message.getByRole("button", { name: /^Download note.txt/ }).click();
  expect(fs.readFileSync((await (await fileDownload).path())!).toString()).toBe("A shared original document");
});

test("a selected video previews, uploads and plays inline and in the viewer", async ({ page, isMobile }, info) => {
  test.setTimeout(150_000);
  await conversation(page);
  const add = page.getByRole("button", { name: /Add/ }).first();
  if (isMobile) await add.tap();
  else await add.click();
  const menu = page.getByRole("menu", { name: "Attach", exact: true });
  await expect(menu.getByRole("menuitem", { name: /^File/ })).toBeVisible();
  for (const label of ["Photos", "Videos", "Camera", "Record video"]) await expect(menu.getByRole("menuitem", { name: label, exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("unified-file-menu.png"), fullPage: true });
  await expect(page.locator('.composer-wrap input[type="file"]')).toHaveCount(1);
  await expect(page.locator('.composer input[type="file"]')).not.toHaveAttribute("accept");
  await expect(page.locator('.composer input[type="file"]')).not.toHaveAttribute("capture");
  const choosing = page.waitForEvent("filechooser");
  await menu.getByRole("menuitem", { name: /^File/ }).click();
  await (await choosing).setFiles({ name: "media-synthetic.mp4", mimeType: "application/octet-stream", buffer: fs.readFileSync(path.join(import.meta.dirname, "fixtures/media-synthetic.mp4")) });
  await expect(page.getByLabel("Preview media-synthetic.mp4")).toBeVisible();
  await page.getByRole("textbox", { name: /^Message / }).fill("Video sharing");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const message = page.locator(".msg").filter({ hasText: "Video sharing" });
  await message.getByRole("button", { name: /^Play .* inline$/ }).click();
  const inline = message.locator("video");
  await expect(inline).toBeVisible();
  await expect.poll(() => inline.evaluate((v) => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await message.getByRole("button", { name: /^Play video / }).click();
  await expect(page.locator(".lightbox video")).toBeVisible();
  await page.screenshot({ path: info.outputPath("media-video.png"), fullPage: true });
});

test("media is optimized by default and Original file is the only optional choice", async ({ page }, info) => {
  await conversation(page);
  const image = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#3475ba";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.99));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const sourceVideo = fs.readFileSync(path.join(import.meta.dirname, "fixtures/media-optimize-input.mp4"));
  await page.locator(".composer input[type=file]").setInputFiles([
    { name: "camera.jpg", mimeType: "image/jpeg", buffer: Buffer.from(image) },
    { name: "clip.mp4", mimeType: "video/mp4", buffer: sourceVideo },
  ]);
  const original = page.getByRole("checkbox", { name: "Original file", exact: true });
  await expect(original).not.toBeChecked();
  await expect(page.locator(".attachment-quality select")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("optimized-default.png"), fullPage: true });
  await page.getByRole("textbox", { name: /^Message / }).fill("Optimized media");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const message = page.locator(".msg").filter({ hasText: "Optimized media" });
  await expect(message).toHaveCount(1, { timeout: 60_000 });
  await message.getByRole("button", { name: /^Play .* inline$/ }).click();
  const video = message.locator("video");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
  const metadata = await video.evaluate((v: HTMLVideoElement) => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration }));
  expect(metadata.width).toBeLessThanOrEqual(1280);
  expect(metadata.height).toBeLessThanOrEqual(720);
  expect(metadata.duration).toBeGreaterThan(1.5);
  await message.getByRole("button", { name: /^Play video / }).click();
  const downloading = page.waitForEvent("download");
  await page
    .locator(".lightbox")
    .getByRole("button", { name: /Download video/, exact: true })
    .click();
  const download = await downloading;
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.length).toBeLessThan(sourceVideo.length);
  const audible = await page.evaluate(async (bytes) => {
    const audio = new AudioContext();
    try {
      const decoded = await audio.decodeAudioData(new Uint8Array(bytes).buffer);
      return decoded.getChannelData(0).some((sample) => Math.abs(sample) > 0.01);
    } finally {
      await audio.close();
    }
  }, Array.from(bytes));
  expect(audible).toBe(true);
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.locator(".composer input[type=file]").setInputFiles({ name: "next.jpg", mimeType: "image/jpeg", buffer: Buffer.from(image) });
  await expect(original).not.toBeChecked();
});
