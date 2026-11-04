import { describe, expect, it } from "vitest";
import { botVoiceAad, BOT_VOICE_HPKE_INFO, sealBotVoiceKey } from "../src/call/botVoiceKeys";
import { generateEncryptionKeys, open, rawX25519Public } from "../src/crypto/hpke";
import { fromB64, randomBytes, sha256, toB64, utf8 } from "../src/crypto/bytes";

describe("approved bot media key handoff", () => {
  it("opens only with the bot's private key and the exact call/channel/bot/lease/revision binding", async () => {
    const recipient = await generateEncryptionKeys(),
      wrong = await generateEncryptionKeys();
    const publicKey = await rawX25519Public(recipient.publicKey),
      key = randomBytes(32);
    const request = {
      botId: "bot",
      leaseId: "botvoice_lease",
      publicKey: toB64(publicKey),
      fingerprint: [...(await sha256(publicKey))].map((n) => n.toString(16).padStart(2, "0")).join(""),
      manifestRev: 7,
      expiresAt: Date.now() + 60_000,
    };
    const packet = await sealBotVoiceKey(request, "call", "channel", toB64(key));
    const context = (call = "call", channel = "channel", bot = "bot", lease = request.leaseId, rev = 7) => utf8(botVoiceAad(call, channel, bot, lease, rev));
    expect(await open(recipient, packet.enc, utf8(BOT_VOICE_HPKE_INFO), context(), packet.ct)).toEqual(key);
    expect(fromB64(packet.enc)).toHaveLength(32);
    expect(fromB64(packet.ct)).toHaveLength(48);
    await expect(open(wrong, packet.enc, utf8(BOT_VOICE_HPKE_INFO), context(), packet.ct)).rejects.toThrow();
    for (const aad of [
      context("other"),
      context("call", "other"),
      context("call", "channel", "other"),
      context("call", "channel", "bot", "other"),
      context("call", "channel", "bot", request.leaseId, 8),
    ])
      await expect(open(recipient, packet.enc, utf8(BOT_VOICE_HPKE_INFO), aad, packet.ct)).rejects.toThrow();
    expect(JSON.stringify(packet)).not.toContain(toB64(key));
  });
  it("refuses expired requests and an inconsistent public key fingerprint", async () => {
    const pair = await generateEncryptionKeys();
    const request = { botId: "bot", leaseId: "lease", publicKey: toB64(await rawX25519Public(pair.publicKey)), fingerprint: "0".repeat(64), manifestRev: 1, expiresAt: Date.now() + 60_000 };
    await expect(sealBotVoiceKey(request, "call", "channel", toB64(randomBytes(32)))).rejects.toThrow("fingerprint");
    await expect(sealBotVoiceKey({ ...request, expiresAt: 1 }, "call", "channel", toB64(randomBytes(32)))).rejects.toThrow("Expired");
  });
});
