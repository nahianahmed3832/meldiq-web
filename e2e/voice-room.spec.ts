import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { NativeMedia, nativePeerMissing, waitUntil } from "./callPeer";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * A voice channel's room page (batch B14, android VoiceChannelScreen) with a real call in it: the native peer opens the
 * room as the phone app does, and this page shows who's there, joins, and offers Open the call. Not a phone test.
 */
test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a voice channel opens as its room: who's in it, Join voice, then Open the call, and no message box (batch B14)", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  await alice.connect();
  await bob.connect();
  const { org } = await alice.req("POST", "/v1/orgs", { name: "Voice Lab" });
  const { invite } = await alice.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER", maxUses: 1, expiresInHours: 1 });
  await bob.req("POST", "/v1/invites/accept", { code: invite.code });
  const { channel } = await alice.req("POST", `/v1/orgs/${org.id}/channels`, { name: "hangout", voice: true });
  await bob.req("POST", `/v1/conversations/${channel.id}/join`).catch(() => undefined);

  // Bob opens the room as the phone app does: the call API, then the room's key in an encrypted call_invite.
  const res = await bob.req("POST", "/v1/calls", { conversationId: channel.id, video: false });
  const key = crypto.randomBytes(32).toString("base64");
  await bob.send(channel.id, { type: "call_invite", callId: res.call.id, video: false, e2eeKey: key }, "control");
  const media = await NativeMedia.join(res.media, key, false);
  try {
    await link(page, alice);
    await page.goto(`/#/home/c/${channel.id}`);
    const room = page.getByLabel("Voice room");
    await expect(room.getByText("In the room — 1")).toBeVisible({ timeout: 20_000 });
    await expect(room.getByText("Bob Chen")).toBeVisible();
    await expect(page.getByPlaceholder(/^Message /)).toHaveCount(0);

    await room.getByRole("button", { name: "Join voice" }).click();
    // The browser asks the room for its key; Bob, already in the room, passes it on (docs/VOICE_ROOMS.md).
    await waitUntil(() => bob.received.find((m: any) => m.payload?.type === "call_key_request" && m.payload.callId === res.call.id), 20_000, "the browser's key request");
    await bob.send(channel.id, { type: "call_invite", callId: res.call.id, video: false, e2eeKey: key }, "control");

    const stage = page.getByRole("dialog", { name: /^Call with/ });
    await expect(stage).toBeVisible();
    await stage.getByRole("button", { name: "Minimise the call" }).click();
    await expect(room.getByRole("button", { name: "Open the call" })).toBeVisible();
    await expect(room.getByText("In the room — 2")).toBeVisible({ timeout: 20_000 });
    await expect(room.getByText("Alice Rahman (you)")).toBeVisible();
    await room.getByRole("button", { name: "Open the call" }).click();
    await expect(stage).toBeVisible();
  } finally {
    await media.leave();
  }
});
