import type { BotVoiceKeyRequest } from "../api/schemas";
import { fromB64, sha256, toB64, utf8 } from "../crypto/bytes";
import { seal } from "../crypto/hpke";

export const BOT_VOICE_HPKE_INFO = "meldiq-bot-voice-v1";
export const botVoiceAad = (callId: string, channelId: string, botId: string, leaseId: string, manifestRev: number) =>
  JSON.stringify([BOT_VOICE_HPKE_INFO, callId, channelId, botId, leaseId, manifestRev]);

/** Only transient HPKE ciphertext leaves the call manager. This function never persists a call key. */
export async function sealBotVoiceKey(request: BotVoiceKeyRequest, callId: string, channelId: string, key: string) {
  if (request.expiresAt <= Date.now()) throw new Error("bot_voice_key_expired");
  const publicKey = fromB64(request.publicKey),
    mediaKey = fromB64(key);
  if (publicKey.length !== 32 || toB64(publicKey) !== request.publicKey || mediaKey.length !== 32) throw new Error("bot_voice_key_invalid");
  const fingerprint = [...(await sha256(publicKey))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (fingerprint !== request.fingerprint) throw new Error("bot_voice_fingerprint_mismatch");
  return seal(request.publicKey, utf8(BOT_VOICE_HPKE_INFO), utf8(botVoiceAad(callId, channelId, request.botId, request.leaseId, request.manifestRev)), mediaKey);
}
