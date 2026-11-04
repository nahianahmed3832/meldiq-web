import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { NativeMedia, nativePeerMissing } from "./callPeer";
import { newPhone, testAddress } from "./phone";
import { link } from "./link";
import { serverDir } from "../test/support/serverDir";

test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.describe.configure({ timeout: 180_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

test("a dedicated bot receives the browser's sealed room key and exchanges real encrypted audio before revocation", async ({ page }, info) => {
  const owner = await newPhone("voicebotowner", "Voice Bot Owner");
  let media: NativeMedia | undefined, bot: any, leaseId: string | undefined;
  try {
    const sdk = path.join(serverDir(), "sdk/javascript");
    const { MeldiqBot } = await import(/* @vite-ignore */ pathToFileURL(path.join(sdk, "index.mjs")).href);
    const { createVoiceKeys, openVoiceKey } = await import(/* @vite-ignore */ pathToFileURL(path.join(sdk, "voice.mjs")).href);
    const keys = await createVoiceKeys();
    const { org } = await owner.req("POST", "/v1/orgs", { name: "Encrypted bot voice" });
    const { channel } = await owner.req("POST", `/v1/orgs/${org.id}/channels`, { name: "Lounge", voice: true, autoJoin: true });
    const made = await owner.req("POST", "/v2/developer/bots", { name: "Voice Helper", public: true });
    await owner.req("POST", `/v1/orgs/${org.id}/bots`, { botId: made.bot.id });
    const permissions = ["voice.connect", "voice.speak"];
    await owner.req("PUT", `/v2/developer/bots/${made.bot.id}/permissions`, { permissions, rev: 0, voicePublicKey: keys.publicKey });
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${made.bot.id}/permissions`, { permissions, manifestRev: 1, rev: 0 });
    bot = new MeldiqBot({ apiOrigin: process.env.ORBIT_E2E_API, token: made.token });
    await link(page, owner);
    await page.goto(`/dms/c/${channel.id}`);
    const room = page.getByLabel("Voice room", { exact: true });
    await room.getByRole("button", { name: "Join voice", exact: true }).click();
    const stage = page.locator("section.call-stage");
    await expect(stage).toBeVisible();
    await expect
      .poll(
        async () =>
          (await owner.req("GET", "/v1/calls/active")).calls.some(
            (call: any) => call.conversationId === channel.id && call.state === "ACTIVE" && call.participants?.some((participant: any) => participant.userId === owner.userId),
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    const lease = await bot.joinVoice(channel.id, { requestId: crypto.randomUUID() });
    expect(lease.media.canSpeak).toBe(true);
    leaseId = lease.leaseId;
    let delivered: any;
    await expect
      .poll(
        async () => {
          delivered = await bot.voiceKey(lease.leaseId);
          return !!delivered.key;
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    const key = await openVoiceKey(keys.keys, delivered);
    // No human device, user socket or call key was given to the bot by the test client.
    media = await NativeMedia.join(lease.media, key, false, {
      beforePublish: async () => {
        expect((await bot.voiceConnected(lease.leaseId)).canSpeak).toBe(true);
      },
    });
    await bot.renewVoice(lease.leaseId);
    await expect.poll(() => media!.sustainedAudio(), { timeout: 30_000 }).toBeGreaterThan(5);
    await expect(stage.locator(".e2ee-badge.encrypted")).toBeVisible({ timeout: 30_000 });
    const tile = stage.locator("figure.call-tile").filter({ hasText: "Voice Helper" });
    await expect(tile.getByText("BOT", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/yapin-parity/part4/screenshots/bot-voice-encrypted-${info.project.name}.png`, fullPage: true });
    const approval = await owner.req("GET", `/v1/orgs/${org.id}/bots/${made.bot.id}/permissions`);
    await owner.req("PUT", `/v1/orgs/${org.id}/bots/${made.bot.id}/permissions`, { permissions: [], manifestRev: 1, rev: approval.rev });
    await expect.poll(() => media!.isConnected, { timeout: 20_000 }).toBe(false);
    await expect(bot.voiceKey(lease.leaseId)).rejects.toMatchObject({ status: 404 });
    await expect(bot.renewVoice(lease.leaseId)).rejects.toMatchObject({ status: 404 });
  } finally {
    await media?.leave();
    if (bot && leaseId) await bot.leaveVoice(leaseId).catch(() => undefined);
    await owner.disconnect();
  }
});
