import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import { emailedCode } from "./mail";
import { newPhone, testAddress } from "./phone";
import { nativePeerMissing, placeCall } from "./callPeer";

test.use({ serviceWorkers: "block", actionTimeout: 20_000 });
test.setTimeout(120_000);
async function onboard(page: Page, context: BrowserContext) {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
  // Use normal email onboarding against the exact production export, without development device linking.
  let authorization = "";
  page.on("request", (request) => {
    authorization = request.headers()["authorization"] || authorization;
  });
  const email = `identity.${crypto.randomBytes(6).toString("hex")}@example.test`;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create an account", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Zoya Rahman");
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
  const req = async (method: string, path: string, data?: Record<string, unknown> | Buffer) => {
    expect(authorization).toMatch(/^Bearer /);
    const response = await page.request.fetch(`${process.env.ORBIT_E2E_API}${path}`, {
      method,
      headers: { authorization, "x-forwarded-for": testAddress() },
      ...(data ? { data } : {}),
    });
    expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
    return response.status() === 204 ? null : response.json();
  };
  return { userId: (await req("GET", "/v1/users/me")).user.id as string, req };
}

test("seen receipts survive main collection history and preserve the unread boundary", async ({ page, context }, info) => {
  const owner = await onboard(page, context);
  const peer = await newPhone("seenpeer", "Mina Rahman");
  const dm = (await owner.req("POST", "/v1/conversations/dm", { userId: peer.userId })).conversation.id as string;
  await peer.connect();
  await page.goto(`/dms/c/${dm}`);
  const composer = page.locator(".composer textarea");
  for (const text of ["First message", "Second message"]) {
    await composer.fill(text);
    await composer.press("Enter");
  }
  const own = page.locator(".msg.mine");
  await expect(own).toHaveCount(2);
  await expect(own.locator('[aria-label="Sent"], [aria-label="Delivered"]')).toHaveCount(2);
  const history = await owner.req("GET", `/v2/conversations/${dm}/messages?limit=10`);
  await peer.send(dm, { type: "read", upTo: Math.max(...history.messages.map((m: { serverTs: number }) => m.serverTs)) }, "control");
  await expect(own.locator('[aria-label="Read"]')).toHaveCount(2);
  await page.reload();
  await expect(own.locator('[aria-label="Read"]')).toHaveCount(2);
  await composer.fill("Not seen yet");
  await composer.press("Enter");
  await expect(own).toHaveCount(3);
  await expect(own.last().locator('[aria-label="Sent"], [aria-label="Delivered"]')).toHaveCount(1);
  await page.reload();
  await expect(own.locator('[aria-label="Read"]')).toHaveCount(2);
  await expect(own.last().locator('[aria-label="Sent"], [aria-label="Delivered"]')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("seen-receipts.png") });
});

test("call photos and measured connection latency show during an encrypted voice call", async ({ page, context }, info) => {
  test.skip(nativePeerMissing() !== null, nativePeerMissing() ?? "");
  const owner = await onboard(page, context);
  const peer = await newPhone("callphoto", "Mina Rahman");
  const photo = fs.readFileSync("e2e/fixtures/photo.jpg");
  await owner.req("PUT", "/v1/users/me/photo", photo);
  await peer.req("PUT", "/v1/users/me/photo", undefined, photo);
  const dm = (await owner.req("POST", "/v1/conversations/dm", { userId: peer.userId })).conversation.id as string;
  await peer.connect();
  await page.goto(`/dms/c/${dm}`);
  const call = await placeCall(peer, dm, false);
  try {
    const incoming = page.getByRole("alertdialog", { name: "Incoming voice call from Mina Rahman", exact: true });
    await expect(incoming.locator(".avatar-photo")).toBeVisible();
    await incoming.getByRole("button", { name: "Answer", exact: true }).click();
    const stage = page.locator("section.call-stage");
    await expect(stage.locator(".e2ee-badge")).toHaveText("Encrypted call", { timeout: 30_000 });
    const photos = stage.locator("figure.call-tile .avatar-photo");
    await expect(photos).toHaveCount(2);
    await expect.poll(() => photos.evaluateAll((els) => els.every((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const signal = page.getByRole("button", { name: /^Call connection:/ });
    await signal.hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(".call-ping")).toHaveText(/^\d+ ms$/, { timeout: 25_000 });
    await expect(tooltip).toContainText("Round-trip latency to the call server");
    await page.screenshot({ path: info.outputPath("call-photos-and-latency.png") });
    await page.mouse.move(800, 100);
    await signal.focus();
    await expect(tooltip).toBeVisible();
    await signal.press("Escape");
    await expect(tooltip).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(photos).toHaveCount(2);
    expect(await stage.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("call-phone.png") });
    await stage.getByRole("button", { name: "Hang up", exact: true }).click();
  } finally {
    await call.media.leave();
  }
});

test("compact community header keeps name, Sparks and cover above a dense channel list", async ({ page, context }, info) => {
  const owner = await onboard(page, context);
  const { org } = await owner.req("POST", "/v1/orgs", { name: "The Makers Guild" });
  await owner.req("PUT", `/v1/orgs/${org.id}/banner`, fs.readFileSync("e2e/fixtures/photo.jpg"));
  const all = (await owner.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string; name: string }[];
  const general = all.find((c) => c.orgId === org.id && c.name === "general")!;
  await page.goto(`/home/c/${general.id}`);
  const side = page.getByRole("complementary", { name: "Conversations", exact: true });
  const head = side.locator(".side-head");
  await expect(head.getByRole("button", { name: /^Community: The Makers Guild/ })).toBeVisible();
  await expect(head.locator(".spark-goal.compact")).toBeVisible();
  await expect(side.locator(".community-cover")).toBeVisible();
  const dims = await side.evaluate((el) => {
    const head = el.querySelector(".side-head")!.getBoundingClientRect();
    const cover = el.querySelector(".community-cover")!.getBoundingClientRect();
    return { head: head.height, cover: cover.height, separate: cover.top >= head.bottom - 1, overflow: el.scrollWidth > el.clientWidth };
  });
  expect(dims.head).toBeLessThanOrEqual(52);
  expect(dims.cover).toBe(72);
  expect(dims.separate).toBe(true);
  expect(dims.overflow).toBe(false);
  await head.locator(".spark-goal.compact").click();
  await expect(page.getByRole("dialog").last()).toContainText("Spark");
  await page.keyboard.press("Escape");
  await side.screenshot({ path: info.outputPath("community-sidebar.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/home/c/${general.id}`);
  await expect(page.getByRole("region", { name: "Conversation: general", exact: true })).toBeVisible();
  expect(await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("sidebar-phone.png") });
});
