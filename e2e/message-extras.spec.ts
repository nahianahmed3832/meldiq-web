import path from "node:path";
import { expect, test } from "@playwright/test";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * Message features from Meldiq Android (2026-10-23): forwarding to several chats with a note and the community it came
 * from, call cards, the photo viewer's caption and React, and YouTube playing inside Meldiq.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "desktop Chromium is enough for these");
test.describe.configure({ timeout: 150_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("forward to two chats with a note, a call card, the viewer's caption and React, and YouTube in Meldiq", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const carol = await newPhone("carol", "Carol Diaz");
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Fwd Lab" });
  const channels = (await alice.req("GET", "/v1/conversations")).conversations as { id: string; orgId: string | null; voice: boolean; format: string | null; kind: string }[];
  const channel = channels.find((c) => c.orgId === org.id && !c.voice && c.format !== "forum" && c.kind !== "ANNOUNCEMENT")!;
  const dmBob = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  const dmCarol = (await alice.req("POST", "/v1/conversations/dm", { userId: carol.userId })).conversation.id as string;
  await bob.connect();
  await carol.connect();
  await link(page, alice);
  // The browser loads YouTube's player only when Play is pressed; here it's answered locally.
  await page.route("https://www.youtube-nocookie.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>player</title>" }));

  // Forward a channel message to Bob and Carol with a note.
  await page.goto(`/home/c/${channel.id}`);
  await page.getByPlaceholder(/^Message #/).fill("Plan for Q4");
  await page.keyboard.press("Enter");
  const original = page.locator(".msg").filter({ hasText: "Plan for Q4" });
  await expect(original).toBeVisible();
  await original.hover();
  await original.getByRole("button", { name: "Forward" }).click();
  const dialog = page.getByRole("dialog", { name: "Forward to…" });
  await dialog.getByRole("option", { name: /Bob Chen/ }).click();
  await dialog.getByRole("option", { name: /Carol Diaz/ }).click();
  await dialog.getByRole("textbox", { name: "Add a message" }).fill("FYI");
  await dialog.getByRole("button", { name: "Forward to 2" }).click();
  await expect(page.locator(".notice")).toContainText("Forwarded to 2 conversations");
  for (const [phone, dm] of [
    [bob, dmBob],
    [carol, dmCarol],
  ] as const) {
    await expect.poll(() => phone.received.filter((r) => r.conversationId === dm).map((r) => r.payload.text)).toEqual(expect.arrayContaining(["Plan for Q4", "FYI"]));
    const fwd = phone.received.find((r) => r.conversationId === dm && r.payload.text === "Plan for Q4")!.payload as unknown as {
      forwarded: boolean;
      origin: { place: string; conversationId: string };
    };
    expect(fwd.forwarded).toBe(true);
    expect(fwd.origin).toMatchObject({ place: "Fwd Lab", conversationId: channel.id });
  }
  await page.goto(`/dms/c/${dmBob}`);
  const forwardedLine = page.locator(".msg-forwarded").filter({ hasText: "Fwd Lab" });
  await expect(forwardedLine).toContainText("Forwarded · Fwd Lab •");
  await forwardedLine.getByRole("button", { name: "Open the original in Fwd Lab" }).click();
  await expect(page).toHaveURL(new RegExp(`/home/c/${channel.id}$`));

  // The photo viewer: sender, time and the message's text under the picture, and React without leaving.
  await page.goto(`/dms/c/${dmBob}`);
  await page.locator(".composer input[type=file]").setInputFiles(path.join(import.meta.dirname, "../public/launch/meldiq-launch.jpg"));
  await page.getByPlaceholder(/^Message Bob/).fill("Our new logo");
  await page.getByRole("button", { name: "Send" }).click();
  const photoMsg = page.locator(".msg").filter({ hasText: "Our new logo" });
  await photoMsg.getByRole("button", { name: /Open image/ }).click({ timeout: 20_000 });
  const viewer = page.locator(".lightbox");
  await expect(viewer.locator(".lightbox-caption")).toContainText("Our new logo");
  await viewer.getByRole("button", { name: "React 🎉" }).click();
  await expect(viewer.getByRole("button", { name: "React 🎉" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(photoMsg.locator(".reaction")).toContainText("🎉");

  // YouTube plays here, in the privacy-enhanced player.
  await bob.send(dmBob, { type: "text", text: "Watch https://youtu.be/dQw4w9WgXcQ" });
  const yt = page.locator(".msg").filter({ hasText: "Watch" });
  await yt.getByRole("button", { name: /Play .* here/ }).click();
  await expect(yt.locator(".yt-player iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0");
  await expect(yt.getByRole("link", { name: "Open on YouTube" })).toBeVisible();
  // And the frame really loads (the production build's security headers allow this one player and nothing else).
  await expect
    .poll(async () => {
      const f = page.frames().find((x) => x.url().startsWith("https://www.youtube-nocookie.com/embed/"));
      return f ? await f.title().catch(() => "") : "";
    })
    .toBe("player");

  // A missed call is a card, in red.
  const info = await alice.req("GET", "/v1/server-info");
  if (info.calling) {
    const started = await bob.req("POST", "/v1/calls", { conversationId: dmBob, video: false });
    await bob.req("POST", `/v1/calls/${started.call.id}/end`, { reason: "hangup" });
    const card = page.locator(".msg-call.missed");
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText("Missed voice call");
    await expect(card.locator(".msg-call-icon")).toBeVisible();
  }
});
