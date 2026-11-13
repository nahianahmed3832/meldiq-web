import { acceptSignupTerms } from "./privacy";
import { finishWelcome } from "./welcome";
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { newPhone, testAddress } from "./phone";
import crypto from "node:crypto";
import { emailedCode } from "./mail";
import { encryptFile } from "../src/crypto/attachment";

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
  await acceptSignupTerms(page);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code", { exact: true }).fill(await emailedCode(email, "verify"));
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Set up encryption", exact: true }).click();
  await page.getByLabel("I've stored my recovery key somewhere safe.").check();
  await page.getByRole("button", { name: "Open Meldiq", exact: true }).click();
  await finishWelcome(page);
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
  await expect(page.getByRole("checkbox", { name: "Original file", exact: true })).toBeChecked();
  await page.screenshot({ path: info.outputPath("media-composer.png"), fullPage: true, animations: "disabled" });
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
  const originalBytes = fs.readFileSync(path.join(import.meta.dirname, "fixtures/media-synthetic.mp4"));
  await (await choosing).setFiles({ name: "media-synthetic.mp4", mimeType: "application/octet-stream", buffer: originalBytes });
  await expect(page.getByLabel("Preview media-synthetic.mp4")).toBeVisible();
  await page.getByRole("textbox", { name: /^Message / }).fill("Video sharing");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const message = page.locator(".msg").filter({ hasText: "Video sharing" });
  const direct = message.getByRole("button", { name: /^Download media-synthetic.mp4/ });
  await expect(message.locator(".att-video-size")).toHaveText("2.2 KB");
  await expect(message.locator(".att-video-size")).toBeInViewport();
  await expect(direct).toBeVisible();
  await message.getByRole("button", { name: /^Play .* inline$/ }).click();
  const inline = message.locator("video");
  await expect(inline).toBeVisible();
  await expect.poll(() => inline.evaluate((v) => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await expect(direct).toBeVisible(); // Playing fetches the file but doesn't save it to the user's downloads.
  await message.getByRole("button", { name: "Open in viewer" }).click();
  await expect(page.locator(".lightbox video")).toBeVisible();
  await expect.poll(() => page.locator(".lightbox video").evaluate((v) => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: info.outputPath("media-video.png"), fullPage: true });
  const downloading = page.waitForEvent("download");
  await page.locator(".lightbox").getByRole("button", { name: "Download video", exact: true }).click();
  expect(fs.readFileSync((await (await downloading).path())!)).toEqual(originalBytes);
  await expect(page.locator(".lightbox").getByRole("button", { name: "Download video", exact: true })).toHaveCount(0);
  await page.locator(".lightbox").getByRole("button", { name: "Close", exact: true }).click();
  await expect(direct).toHaveCount(0);
  await expect(message.locator(".att-video-size")).toHaveText("2.2 KB");
  await page.reload();
  await expect(message.locator(".att-video-size")).toBeVisible();
  await expect(direct).toHaveCount(0);
});

test("message controls edit a video caption and swipe to reply on a phone", async ({ page, isMobile }, info) => {
  const { b, id } = await conversation(page);
  const title = "portrait-screen-recording-with-a-long-filename.mp4";
  const original = fs.readFileSync(path.join(import.meta.dirname, "fixtures/media-portrait.mp4"));
  await page.locator(".composer input[type=file]").setInputFiles([{ name: title, mimeType: "video/mp4", buffer: original }]);
  const input = page.getByRole("textbox", { name: /^Message / });
  await input.fill("My video caption");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const own = page
    .locator(".msg")
    .filter({ has: page.getByText(title, { exact: true }) })
    .first();
  await expect(own.locator(".att-video-card")).toHaveClass(/\bportrait\b/);
  const preview = own.locator(".att-video-stage");
  const previewBox = (await preview.boundingBox())!;
  expect(previewBox.height).toBeGreaterThan(previewBox.width);
  const size = own.locator(".att-video-size");
  const sizeBox = (await size.boundingBox())!;
  const cardBox = (await own.locator(".att-video-card").boundingBox())!;
  expect(sizeBox.x + sizeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  expect(sizeBox.y).toBeGreaterThanOrEqual(previewBox.y + previewBox.height);

  const downloadButton = own.getByRole("button", { name: new RegExp(`^Download ${title}`) });
  const fileId = await own.locator("[data-attachment-id]").getAttribute("data-attachment-id");
  const fileRoute = `**/v1/attachments/${fileId}`;
  let releaseTransfer!: () => void;
  const transferHeld = new Promise<void>((resolve) => (releaseTransfer = resolve));
  await page.route(
    fileRoute,
    async (route) => {
      await transferHeld;
      await route.abort().catch(() => undefined);
    },
    { times: 1 },
  );
  try {
    const request = page.waitForRequest((r) => r.url().endsWith(`/v1/attachments/${fileId}`));
    await downloadButton.click();
    await request;
    await own.getByRole("button", { name: /^Cancel downloading/ }).click();
    await expect(downloadButton).toBeVisible();
  } finally {
    releaseTransfer();
  }
  const saving = page.waitForEvent("download");
  await downloadButton.click();
  expect(fs.readFileSync((await (await saving).path())!)).toEqual(original);
  await expect(downloadButton).toHaveCount(0);
  await expect(size).toBeVisible();
  await page.screenshot({ path: info.outputPath("portrait-media.png"), animations: "disabled" });

  if (!isMobile) await own.hover();
  await own.getByRole("button", { name: "More actions", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Message", exact: true });
  await menu.getByRole("menuitem", { name: "Edit message", exact: true }).click();
  const editor = own.getByRole("textbox", { name: "Edit message" });
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("My video caption");
  await expect(size).toBeVisible();
  await editor.fill("Changed video caption");
  await page.screenshot({ path: info.outputPath("edit-caption.png"), animations: "disabled" });
  await own.getByRole("button", { name: "Save", exact: true }).click();
  await expect(own.locator(".msg-text")).toContainText("Changed video caption");
  await expect(own.locator(".att-video-size")).toBeVisible();
  expect(await b.req("GET", `/v2/conversations/${id}/messages`).then((r) => JSON.stringify(r.changes))).toContain("Changed video caption");
  if (!isMobile) {
    await own.locator(".msg-text").hover();
    await own.getByRole("button", { name: "More actions", exact: true }).click();
    await menu.getByRole("menuitem", { name: "Edit message", exact: true }).click();
    await editor.fill("");
    await own.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(own.locator(".msg-text")).toHaveCount(0);
    await expect(size).toBeVisible();
  }

  const replyId = `media_reply_${Date.now()}`;
  await b.send(id, { type: "text", text: "Reply to this incoming message" }, "message", replyId);
  const incoming = page.locator(`#msg-${replyId}`);
  await expect(incoming).toBeVisible();
  if (isMobile) await incoming.getByRole("button", { name: "More actions", exact: true }).tap();
  else await incoming.locator(".msg-text").click({ button: "right" });
  await expect(menu.getByRole("menuitem", { name: "Edit message" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "Reply", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(page.locator(".composer-context")).toContainText("Reply to this incoming message");
  await page.getByRole("button", { name: "Cancel reply", exact: true }).click();

  if (isMobile) {
    const body = incoming.locator(".msg-text");
    const opts = { pointerId: 5, pointerType: "touch", isPrimary: true, button: 0, clientY: 250 };
    await body.dispatchEvent("pointerdown", { ...opts, clientX: 210 });
    await body.dispatchEvent("pointermove", { ...opts, clientX: 132 });
    await expect(incoming.locator(".msg-swipe-cue.armed")).toBeInViewport();
    await body.dispatchEvent("pointerup", { ...opts, clientX: 132 });
    await expect(input).toBeFocused();
    await expect(page.locator(".composer-context")).toContainText("Reply to this incoming message");
    await expect(incoming.locator(".msg-swipe-cue")).toHaveCount(0);
  }
});

test("voice notes keep the duration clear and offer the original from message actions", async ({ page, isMobile }, info) => {
  const { b, id } = await conversation(page);
  const bytes = fs.readFileSync(path.join(import.meta.dirname, "fixtures/voice-note.m4a"));
  const encrypted = await encryptFile(bytes);
  const name = "voice-fixture.m4a";
  const uploaded = await b.req("POST", `/v1/attachments?conversationId=${encodeURIComponent(id)}`, undefined, Buffer.from(encrypted.ciphertext));
  const messageId = `voice_${Date.now()}`;
  await b.send(
    id,
    {
      type: "text",
      attachments: [{ id: uploaded.id, name, mime: "audio/mp4", size: bytes.length, key: encrypted.key, nonce: encrypted.nonce, sha256: encrypted.sha256, voice: true, durationMs: 4000 }],
    },
    "message",
    messageId,
  );
  const message = page.locator(`#msg-${messageId}`);
  const voice = message.getByRole("group", { name: "Voice message, 4 seconds" });
  await expect(voice).toBeVisible();
  await expect(message.getByRole("button", { name: /download/i })).toHaveCount(0);
  await expect(voice.locator(".voice-len")).toHaveText("0:04");
  await page.screenshot({ path: info.outputPath("voice-player.png"), animations: "disabled" });
  if (isMobile) await message.getByRole("button", { name: "More actions", exact: true }).tap();
  else await voice.click({ button: "right", position: { x: 60, y: 10 } });
  const saving = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download voice message", exact: true }).click();
  const saved = await saving;
  expect(saved.suggestedFilename()).toBe(name);
  expect(fs.readFileSync((await saved.path())!)).toEqual(bytes);
  await voice.getByRole("button", { name: /^Play voice message/ }).click();
  await expect(voice).toHaveAttribute("data-voice-state", "playing");
  await expect(voice.getByRole("slider")).toBeEnabled();
  await expect(message.getByRole("button", { name: /download/i })).toHaveCount(0);
});

test("reconnecting shows real catch-up and restores messages missed while offline", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium exposes reliable offline WebSocket simulation");
  const { b, id } = await conversation(page);
  await context.setOffline(true);
  const status = page.locator(".conn-banner");
  await expect(status).toContainText(/You.re offline/, { timeout: 20_000 });
  await b.send(id, { type: "text", text: "Arrived while offline" });
  let finishRefresh!: () => void;
  const refreshing = new Promise<void>((resolve) => (finishRefresh = resolve));
  await page.route("**/v1/conversations", async (route) => {
    await refreshing;
    await route.continue();
  });
  try {
    await context.setOffline(false);
    await expect(status).toContainText("Catching up…");
    finishRefresh();
    await expect(page.getByRole("log", { name: "Messages" }).getByText("Arrived while offline", { exact: true })).toBeVisible();
    await expect(status).toContainText("Back online");
    await expect(status).toHaveCount(0);
  } finally {
    finishRefresh();
  }
});

test("compression is opt-in and keeps MP4 video and audio", async ({ page }, info) => {
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
  await expect(original).toBeChecked();
  await original.uncheck();
  await expect(page.locator(".attachment-quality select")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("optimized-default.png"), fullPage: true });
  await page.getByRole("textbox", { name: /^Message / }).fill("Optimized media");
  const startedAt = Date.now();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const message = page.locator(".msg").filter({ hasText: "Optimized media" });
  await expect(message).toHaveCount(1, { timeout: 60_000 });
  const sendMs = Date.now() - startedAt;
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
  expect(download.suggestedFilename()).toBe("clip.mp4");
  expect(bytes.length).toBeLessThan(sourceVideo.length);
  await info.attach("compression-measurement", { body: JSON.stringify({ originalBytes: sourceVideo.length, optimizedBytes: bytes.length, sendMs }), contentType: "application/json" });
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
  await expect(original).toBeChecked();
});

test("a failed upload shows progress, retains the draft transfer, and retries once", async ({ page }, info) => {
  await conversation(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route("**/v1/attachments?*", async (route) => {
    if (route.request().method() !== "POST" || ++attempts !== 1) return route.continue();
    await pending;
    await route.fulfill({ status: 503, json: { error: { code: "storage_unavailable", message: "Storage unavailable" } } });
  });
  const original = fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  await page.locator(".composer input[type=file]").setInputFiles({ name: "retry.jpg", mimeType: "image/jpeg", buffer: original });
  await expect(page.locator(".attachment-draft")).toHaveCount(1);
  await page.getByRole("textbox", { name: /^Message / }).fill("Retry media once");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const transfer = page.locator(".transfer-row").filter({ hasText: "retry.jpg" });
  try {
    await expect(transfer.getByRole("progressbar")).toBeVisible();
    await expect(transfer.getByRole("button", { name: "Cancel sending retry.jpg" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("upload-progress.png"), fullPage: true });
  } finally {
    release();
  }
  const message = page.locator(".msg").filter({ hasText: "Retry media once" });
  await expect(message).toHaveCount(0);
  await expect(transfer).toHaveClass(/failed/);
  await transfer.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(message).toHaveCount(1);
  await expect(transfer).toHaveClass(/sent/);
});

test("mobile restores four tabs and desktop keeps its compact sidebars", async ({ page, isMobile }, info) => {
  const account = await onboard(page);
  await account.req("POST", "/v1/orgs", { name: "Navigation Lab" });
  await page.goto("/dms");
  const sidebar = page.locator(".sidebar");
  await expect(sidebar.getByRole("heading", { name: "Direct messages", exact: true, level: 2 })).toBeVisible();
  for (const name of ["Home", "Activity"]) await expect(sidebar.getByRole("link", { name, exact: true })).toHaveCount(0);
  const rail = page.locator(".rail");
  if (isMobile) {
    const tabs = page.getByRole("navigation", { name: "Sections", exact: true });
    await expect(tabs.getByRole("button")).toHaveText(["Home", /^Messages/, /^Activity/, /You$/]);
    await expect(tabs.getByRole("button", { name: /^Messages/ })).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByRole("link", { name: "Communities", exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("navigation-messages.png"), animations: "disabled" });
    await tabs.getByRole("button", { name: /^Activity/ }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(tabs.getByRole("button", { name: /^Activity/ })).toHaveAttribute("aria-current", "page");
    const home = tabs.getByRole("button", { name: "Home", exact: true });
    await home.click();
    const lobby = page.getByRole("region", { name: "Navigation Lab lobby", exact: true });
    await expect(lobby).toBeVisible();
    await home.click();
    await expect(rail.getByRole("button", { name: /^Navigation Lab/ })).toBeVisible();
    await tabs.getByRole("button", { name: /^Messages/ }).click();
    await expect(page).toHaveURL(/\/dms$/);
    await tabs.getByRole("button", { name: /You$/ }).click();
    await expect(page).toHaveURL(/\/settings\/you$/);
  } else {
    await rail.getByRole("button", { name: /^Navigation Lab/ }).click();
    await expect(sidebar.getByRole("button", { name: /Navigation Lab/ }).first()).toBeVisible();
    for (const name of ["Home", "Activity"]) await expect(sidebar.getByRole("link", { name, exact: true })).toHaveCount(0);
  }
});

test("chat downloads one original and lets you select files across messages", async ({ page, isMobile }, info) => {
  // Force the portable path on Chromium too; browsers without folder access must get one download.
  await page.addInitScript(() => Object.defineProperty(window, "showDirectoryPicker", { value: undefined, configurable: true }));
  await conversation(page);
  const image = fs.readFileSync(path.join(import.meta.dirname, "fixtures/photo.jpg"));
  const send = async (caption: string, files: { name: string; mimeType: string; buffer: Buffer }[]) => {
    await page.locator(".composer input[type=file]").setInputFiles(files);
    await expect(page.locator(".attachment-draft")).toHaveCount(files.length);
    await page.getByRole("textbox", { name: /^Message / }).fill(caption);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const message = page.locator(".msg").filter({ hasText: caption });
    await expect(message.locator("[data-attachment-id]")).toHaveCount(files.length);
    return message;
  };
  const album = await send("First group", [
    { name: "original.jpg", mimeType: "image/jpeg", buffer: image },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Skip this file") },
  ]);
  const other = await send("Second group", [{ name: "report.txt", mimeType: "text/plain", buffer: Buffer.from("Keep this file") }]);

  const direct = page.waitForEvent("download");
  await album.getByRole("button", { name: /^Download original.jpg/ }).click();
  const original = await direct;
  expect(original.suggestedFilename()).toBe("original.jpg");
  expect(fs.readFileSync((await original.path())!)).toEqual(image);

  const openFileMenu = async () => {
    const file = album.locator("[data-attachment-id]").first();
    if (isMobile) {
      await file.dispatchEvent("pointerdown", { pointerType: "touch", button: 0, isPrimary: true });
      await expect(page.getByRole("menuitem", { name: "Select original.jpg", exact: true })).toBeVisible();
      await file.dispatchEvent("pointerup", { pointerType: "touch", button: 0, isPrimary: true });
    } else {
      await file.dispatchEvent("contextmenu");
    }
  };
  await openFileMenu();
  await page.getByRole("menuitem", { name: "Select original.jpg", exact: true }).click();
  await expect(album.getByRole("checkbox", { name: "Select original.jpg" })).toBeChecked();
  await expect(album.getByRole("checkbox", { name: "Select notes.txt" })).not.toBeChecked();
  await page.getByRole("button", { name: "Stop selecting" }).click();

  await openFileMenu();
  await page.getByRole("menuitem", { name: "Select all · 2", exact: true }).click();
  await expect(album.getByRole("checkbox", { name: "Select notes.txt" })).toBeChecked();
  const skip = album.getByRole("checkbox", { name: "Select notes.txt" });
  const keep = other.getByRole("checkbox", { name: "Select report.txt" });
  if (isMobile) {
    await skip.tap();
    await keep.tap();
    await expect(skip).not.toBeChecked();
    await expect(keep).toBeChecked();
  } else {
    await skip.uncheck();
    await keep.check();
  }
  await expect(page.getByText("2 files selected", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Message / })).toBeHidden();
  await page.screenshot({ path: info.outputPath("chat-selection.png"), animations: "disabled" });
  const batch = page.waitForEvent("download");
  await page.locator(".chat-download-bar").getByRole("button", { name: "Download", exact: true }).click();
  const zip = await batch;
  expect(zip.suggestedFilename()).toBe("Meldiq.zip");
  const { execFileSync } = await import("node:child_process");
  const archive = (await zip.path())!;
  expect(execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" }).trim().split("\n")).toEqual(["original.jpg", "report.txt"]);
  expect(execFileSync("unzip", ["-p", archive, "original.jpg"])).toEqual(image);
  expect(execFileSync("unzip", ["-p", archive, "report.txt"], { encoding: "utf8" })).toBe("Keep this file");
  await expect(page.getByText("Saved 2 of 2", { exact: true })).toBeVisible();
  await page.locator(".chat-download-bar").getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("checkbox", { name: "Select original.jpg" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /^Message / })).toBeVisible();
});
