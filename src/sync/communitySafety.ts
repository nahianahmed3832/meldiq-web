import { z } from "zod";
import { type Ban, zBan } from "../api/communitySchemas";
import { type SafetySettings, zSafetySettings } from "../api/schemas";
import type { AccountAgeGate, VerificationLevel } from "./communityParity";
import type { Engine } from "./engine";

/**
 * A community's safety (community parity A2, feature community-safety; server docs/COMMUNITY_SAFETY_API.md): the
 * verification level, the new-account gate and raid protection, voice bans, and server mutes and disconnects in its
 * voice channels. Every change is checked by the server again.
 */

const enc = encodeURIComponent;

export function safetySettings(engine: Engine, orgId: string): Promise<SafetySettings> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/safety`, zSafetySettings);
}

export interface SafetyChange {
  verificationLevel?: VerificationLevel;
  newAccountGate?: AccountAgeGate;
  raidProtection?: boolean;
}

export async function setSafetySettings(engine: Engine, orgId: string, change: SafetyChange): Promise<SafetySettings> {
  const r = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/safety`, zSafetySettings, { body: change });
  await engine.refreshAll();
  return r;
}

/** A voice ban: the person still reads and chats, but can't join the community's voice channels. */
export type VoiceBan = Ban;
const zVoiceBans = z.object({ voiceBans: z.array(zBan) });

export async function voiceBans(engine: Engine, orgId: string): Promise<VoiceBan[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/voice-bans`, zVoiceBans)).voiceBans;
}

export async function voiceBan(engine: Engine, orgId: string, userId: string, reason: string | null): Promise<VoiceBan[]> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/voice-bans`, zVoiceBans, { body: { userId, reason: reason?.trim() || null } })).voiceBans;
}

export async function liftVoiceBan(engine: Engine, orgId: string, userId: string): Promise<VoiceBan[]> {
  return (await engine.api.json("DELETE", `/v1/orgs/${enc(orgId)}/voice-bans/${enc(userId)}`, zVoiceBans)).voiceBans;
}

/** A server mute in every voice channel of the community, until a moderator unmutes (voice.mute_members). */
export async function setVoiceMute(engine: Engine, orgId: string, userId: string, muted: boolean): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/voice/members/${enc(userId)}/mute`, { body: { muted } });
}

/** Takes someone out of the voice call they're in (voice.move_members); they may join again. */
export async function disconnectVoice(engine: Engine, orgId: string, userId: string): Promise<void> {
  await engine.api.call("POST", `/v1/orgs/${enc(orgId)}/voice/members/${enc(userId)}/disconnect`);
}
