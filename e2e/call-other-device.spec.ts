import { expect, test } from "@playwright/test";
import { NativeMedia, nativePeerMissing, placeCall, waitUntil } from "./callPeer";
import { link } from "./link";
import { newPhone, testAddress } from "./phone";

/**
 * One device per person in a call (API 0.31.0): this browser is in a call, then the same account joins it from its
 * phone (the native peer, as the Android app). The browser leaves the call and says why; it stays signed in, and the call
 * goes on between the phone and the other person. Not a physical-device test.
 */
test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "one engine is enough for the server's rule");
test.describe.configure({ timeout: 150_000 });

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("joining the call on another device moves this browser out of it, still signed in, and the call goes on", async ({ page }) => {
  const alice = await newPhone("alice", "Alice Rahman");
  const bob = await newPhone("bob", "Bob Chen");
  const dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id as string;
  await alice.connect();
  await bob.connect();
  await link(page, alice);
  const call = await placeCall(bob, dm, false);
  let phoneMedia: NativeMedia | null = null;
  try {
    const ringing = page.getByRole("alertdialog", { name: "Incoming voice call from Bob Chen" });
    await expect(ringing).toBeVisible({ timeout: 15_000 });
    await ringing.getByRole("button", { name: "Answer" }).click();
    const stage = page.getByRole("dialog", { name: "Call with Bob Chen" });
    await expect(stage.getByRole("status")).toHaveText(/^\d+:\d\d$/, { timeout: 30_000 });

    // Alice's phone joins the same call with the key its own copy of the invite carried.
    const invite = await waitUntil(() => alice.received.find((m: any) => m.payload?.type === "call_invite" && m.payload.callId === call.id), 20_000, "the phone's call key");
    const join = await alice.req("POST", `/v1/calls/${call.id}/join`);
    phoneMedia = await NativeMedia.join(join.media, (invite.payload as any).e2eeKey, false);
    await alice.req("POST", `/v1/calls/${call.id}/connected`);

    await expect(stage.getByText("You joined this call on another device")).toBeVisible({ timeout: 20_000 });
    // The call carries on between the phone and Bob: still live, both hear each other.
    expect((await bob.req("GET", `/v1/calls/${call.id}`)).call.state).toBe("ACTIVE");
    await expect.poll(() => phoneMedia!.sustainedAudio(), { timeout: 20_000 }).toBeGreaterThan(20);
    // This browser is still signed in and in sync.
    await expect(stage).toHaveCount(0, { timeout: 10_000 });
    await bob.send(dm, { type: "text", text: "still here?" });
    await expect(page.getByText("still here?")).toBeVisible({ timeout: 20_000 });
  } finally {
    await call.media.leave();
    await phoneMedia?.leave();
  }
});
