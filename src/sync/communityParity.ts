import type { Engine } from "./engine";
import { setSecurity } from "./community";

/**
 * Community parity, batch A (docs/MELDIQ_COMMUNITY_PARITY.md §3): what the web needs from the server fields batch A adds.
 * Everything here is typed now so the screens can be laid out; each TODO names the route or field it waits for. Nothing
 * calls a route that doesn't exist yet: until the server announces a feature, its screen stays hidden.
 */

/** The server's feature flags for batch A (GET /v1/server features). None is sent yet. */
export const PARITY_FEATURES = {
  /** Real lock: no joins and only moderators chat. Until then Lock falls back to pausing joins. */
  lock: "community-lock",
  /** A per-community nickname (Change nickname in the community menu). */
  nicknames: "community-nicknames",
  /** Background tint, verification level and the new-account gate in Community settings. */
  settingsPlus: "community-settings-plus",
  /** A separate list of people banned from voice rooms (Bans page). */
  voiceBans: "voice-bans",
  /** Paid promotion in Discover (an owner decision; no page until it exists). */
  promote: "community-promote",
} as const;

export interface LockChoice {
  label: string;
  ms: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** How long Lock lasts, from the community menu (the reference's four steps). */
export const LOCK_CHOICES: readonly LockChoice[] = [
  { label: "15 minutes", ms: 15 * MINUTE },
  { label: "1 hour", ms: HOUR },
  { label: "8 hours", ms: 8 * HOUR },
  { label: "1 day", ms: 24 * HOUR },
];

/** How much a newcomer must pass before posting (the server defines each step; Medium: account and stay over 5 minutes). */
export type VerificationLevel = "none" | "low" | "medium" | "high";
export const VERIFICATION_LEVELS: readonly { level: VerificationLevel; label: string; hint: string }[] = [
  { level: "none", label: "None", hint: "Anyone who joins can post." },
  { level: "low", label: "Low", hint: "A light check on new accounts." },
  { level: "medium", label: "Medium", hint: "Low, and an account older than 5 minutes that's been here 5 minutes." },
  { level: "high", label: "High", hint: "The strictest check the server offers." },
];

/** Accounts younger than this can't join (null: off). Moderators and staff are never held back. */
export const ACCOUNT_AGE_CHOICES: readonly { label: string; ms: number | null }[] = [
  { label: "Off", ms: null },
  { label: "10 minutes", ms: 10 * MINUTE },
  { label: "1 hour", ms: HOUR },
  { label: "1 day", ms: 24 * HOUR },
  { label: "7 days", ms: 7 * 24 * HOUR },
];

export const NICKNAME_MAX = 32;

/**
 * The fields batch A adds to a community (org) and its members. Optional: older servers don't send them.
 * TODO(community-parity A): read these from zOrg / zOrgAdminDetail once the server sends them.
 */
export interface CommunityParityFields {
  /** A real lock's end (ms), or null. */
  lockedUntil?: number | null;
  verificationLevel?: VerificationLevel;
  /** The new-account gate, in ms, or null when off. */
  minAccountAgeMs?: number | null;
  /** "#rrggbb" behind the community's channels, or null. */
  backgroundTint?: string | null;
  /** This person's nickname here, or null for their username. */
  myNickname?: string | null;
}

/** The nickname to send: trimmed, empty means "use my username". */
export function cleanNickname(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

/** Why a nickname can't be saved, or null when it can. */
export function nicknameProblem(text: string): string | null {
  const nickname = cleanNickname(text);
  if (nickname === null) return null;
  if ([...nickname].length > NICKNAME_MAX) return `Keep it to ${NICKNAME_MAX} characters.`;
  return null;
}

class NotYetAvailable extends Error {
  constructor(what: string) {
    super(`${what} isn't available on this server yet.`);
    this.name = "NotYetAvailable";
  }
}

/**
 * Lock the community until [until] (ms). For now this is Security actions' "Pause joining": nobody new can join.
 * TODO(community-parity A): POST /v1/orgs/:id/lock { until } when the server has PARITY_FEATURES.lock; that also
 * limits chat to moderators.
 */
export async function lockCommunity(engine: Engine, orgId: string, until: number): Promise<void> {
  await setSecurity(engine, orgId, { invitesPausedUntil: until });
}

/** Ends a lock early. TODO(community-parity A): DELETE /v1/orgs/:id/lock with PARITY_FEATURES.lock. */
export async function unlockCommunity(engine: Engine, orgId: string): Promise<void> {
  await setSecurity(engine, orgId, { invitesPausedUntil: null });
}

/** TODO(community-parity A): PATCH /v1/orgs/:id/members/me { nickname } with PARITY_FEATURES.nicknames. */
export async function setCommunityNickname(_engine: Engine, _orgId: string, _nickname: string | null): Promise<void> {
  throw new NotYetAvailable("Nicknames");
}

/** TODO(community-parity A): PATCH /v1/orgs/:id/branding { backgroundTint } with PARITY_FEATURES.settingsPlus. */
export async function setCommunityTint(_engine: Engine, _orgId: string, _tint: string | null): Promise<void> {
  throw new NotYetAvailable("Background tint");
}

/**
 * TODO(community-parity A): PATCH /v1/orgs/:id/security { verificationLevel, minAccountAgeMs } with
 * PARITY_FEATURES.settingsPlus.
 */
export async function setJoinChecks(_engine: Engine, _orgId: string, _change: { verificationLevel?: VerificationLevel; minAccountAgeMs?: number | null }): Promise<void> {
  throw new NotYetAvailable("Verification");
}

/** TODO(community-parity A): GET /v1/orgs/:id/voice-bans with PARITY_FEATURES.voiceBans, listed on the Bans page. */
export interface VoiceBan {
  userId: string;
  reason: string | null;
  at: number;
}
