import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { NativeMedia, nativePeerMissing } from "./callPeer";
import { newPhone, testAddress, type Phone } from "./phone";
import { link } from "./link";
import { serverDir } from "../test/support/serverDir";

test.skip(() => nativePeerMissing() !== null, nativePeerMissing() ?? "");
test.describe.configure({ timeout: 180_000 });
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ "x-orbit-test-ip": testAddress() });
});

for (const waitForMember of [false, true]) {
  test(
    waitForMember
      ? "a bot waiting in an empty channel receives a member's key and exchanges encrypted audio before revocation"
      : "a dedicated bot receives the browser's sealed room key and exchanges real encrypted audio before revocation",
    async ({ page }, info) => {
      const owner = await newPhone("voicebotowner", "Voice Bot Owner");
      let media: NativeMedia | undefined, reference: NativeMedia | undefined, referencePhone: Phone | undefined, bot: any, leaseId: string | undefined;
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
        let pendingLease: any;
        if (waitForMember) {
          expect((await owner.req("GET", "/v1/server-info")).features).toContain("bot-voice-wait-v1");
          pendingLease = await bot.joinVoice(channel.id, { requestId: crypto.randomUUID(), waitForMember: true });
          leaseId = pendingLease.leaseId;
          expect(pendingLease).toMatchObject({ callId: null, media: null, state: "waiting_for_member" });
          expect((await bot.voiceKey(leaseId)).key).toBeNull();
          expect((await owner.req("GET", "/v1/calls/active")).calls.some((call: any) => call.conversationId === channel.id)).toBe(false);
        }
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
        const initial = pendingLease ?? (await bot.joinVoice(channel.id, { requestId: crypto.randomUUID() }));
        leaseId = initial.leaseId;
        let delivered: any;
        await expect
          .poll(
            async () => {
              delivered = await bot.voiceKey(initial.leaseId);
              return !!delivered.key;
            },
            { timeout: 30_000 },
          )
          .toBe(true);
        const lease = { ...initial, callId: delivered.callId, media: delivered.media ?? initial.media };
        expect(lease.media.canSpeak).toBe(true);
        const key = await openVoiceKey(keys.keys, delivered);
        // An authorized human fixture supplies a known continuous source with DTX disabled; no browser mic substitution.
        referencePhone = await newPhone("voicereference", "Reference speaker");
        const invitation = await owner.req("POST", `/v1/orgs/${org.id}/invites`, { role: "MEMBER" });
        await referencePhone.req("POST", "/v1/invites/accept", { code: invitation.invite.code });
        const referenceGrant = await referencePhone.req("POST", `/v1/calls/${lease.callId}/join`);
        reference = await NativeMedia.join(referenceGrant.media, key, false, { publishToneHz: 997 });
        await referencePhone.req("POST", `/v1/calls/${lease.callId}/connected`);

        // No human device, user socket or call key was given to the bot by the test client.
        media = await NativeMedia.join(lease.media, key, false, {
          toneHz: 997,
          beforePublish: async () => {
            expect((await bot.voiceConnected(lease.leaseId)).canSpeak).toBe(true);
          },
        });
        await bot.renewVoice(lease.leaseId);
        await expect.poll(() => media!.sustainedAudio(), { timeout: 30_000 }).toBeGreaterThan(5);
        await expect.poll(() => media!.matchedToneFrames, { timeout: 30_000 }).toBeGreaterThan(10);
        await stage.getByRole("button", { name: "Turn camera on", exact: true }).click();
        await expect.poll(() => media!.received.video.frames, { timeout: 30_000 }).toBeGreaterThan(5);
        await stage.getByRole("button", { name: "Turn camera off", exact: true }).click();
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
        await media.leave();
        let replay: NativeMedia | undefined;
        const replayStarted = performance.now();
        const referenceAtReplay = reference.publishedAudioFrames;
        let disconnectedAfterMs: number | null = null;
        try {
          try {
            replay = await NativeMedia.join(lease.media, key, false, { receiveOnly: true, toneHz: 997 });
          } catch {
            // The same server/native SDK already exchanged actual media above; an expired/revoked grant may be refused.
          }
          if (replay) {
            await expect.poll(() => replay!.isConnected, { timeout: 5_000 }).toBe(false);
            disconnectedAfterMs = performance.now() - replayStarted;
            expect(replay.sustainedAudio(), "a saved media grant must not restore revoked listening access").toBe(0);
            expect(replay.matchedToneFrames, "a revoked listener must not decrypt the continuous source tone").toBe(0);
            expect(reference.isConnected).toBe(true);
            await expect.poll(() => reference!.publishedAudioFrames).toBeGreaterThan(referenceAtReplay + 3);
          }
        } finally {
          const receipt =
            JSON.stringify(
              {
                scope: "Local self-hosted LiveKit with actual native RTC and a continuous 997 Hz source; no physical-device claim",
                admissionMode: waitForMember ? "waiting" : "existing",
                project: info.project.name,
                repetition: info.repeatEachIndex + 1,
                refused: !replay,
                connectedAtEnd: replay?.isConnected ?? false,
                audioFrames: replay?.received.audio.frames ?? 0,
                sustainedAudioFrames: replay?.sustainedAudio() ?? 0,
                matchedSourceToneFrames: replay?.matchedToneFrames ?? 0,
                positiveControlToneFrames: media?.matchedToneFrames ?? 0,
                referencePublishingAtEnd: reference?.isConnected ?? false,
                referencePublishedFramesAtReplay: referenceAtReplay,
                referencePublishedFramesAtEnd: reference?.publishedAudioFrames ?? 0,
                disconnectedAfterMs,
                probeElapsedMs: performance.now() - replayStarted,
              },
              null,
              2,
            ) + "\n";
          const suffix = waitForMember ? "-waiting" : "";
          await fs.writeFile(`docs/yapin-parity/part4/evidence/bot-voice-replay-${info.project.name}${suffix}.json`, receipt);
          await fs.writeFile(`docs/yapin-parity/part4/evidence/bot-voice-replay-${info.project.name}${suffix}-run-${info.repeatEachIndex + 1}.json`, receipt);
          await info.attach("saved-media-replay", { body: receipt, contentType: "application/json" });
          await replay?.leave();
        }
      } finally {
        await media?.leave();
        await reference?.leave();
        await referencePhone?.disconnect();
        if (bot && leaseId) await bot.leaveVoice(leaseId).catch(() => undefined);
        await owner.disconnect();
      }
    },
  );
}
