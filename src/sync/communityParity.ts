import { z } from "zod";
import { setSecurity } from "./community";
import type { Engine } from "./engine";

/**
 * Community parity, batch A (docs/MELDIQ_COMMUNITY_PARITY.md §3): the server's three batch A features and what the web
 * calls on them. Every screen shows only on a server that announces its feature; older servers keep today's UI.
 */

/** The server's feature names for batch A (GET /v1/server-info features). */
export const PARITY_FEATURES = {
  /** New permission keys, @everyone defaults, nicknames, role extras and order, channel options, stages. */
  permissions: "community-permissions",
  /** Real lock, raid protection, verification level, the new-account gate, voice bans and voice moderation. */
  safety: "community-safety",
  /** Name up to 100, background tint, links, custom and never-expiring invite links, the onboarding gate. */
  settings: "community-settings",
  /** Paid promotion in Discover: boosts and the Promoted row (community parity E, src/ui/workspace/promote). */
  promote: "discovery-promote",
} as const;

const enc = encodeURIComponent;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long a lock lasts, as the server takes it. */
export type LockDuration = "15m" | "1h" | "8h" | "1d";

export interface LockChoice {
  label: string;
  duration: LockDuration;
  ms: number;
}

/** How long Lock lasts, from the community menu (the reference's four steps). */
export const LOCK_CHOICES: readonly LockChoice[] = [
  { label: "15 minutes", duration: "15m", ms: 15 * MINUTE },
  { label: "1 hour", duration: "1h", ms: HOUR },
  { label: "8 hours", duration: "8h", ms: 8 * HOUR },
  { label: "1 day", duration: "1d", ms: DAY },
];

/** The Profile page's three quick locks (the reference offers 15 min / 1 hour / a day there). */
export const PROFILE_LOCK_CHOICES: readonly LockChoice[] = [
  { label: "15 min", duration: "15m", ms: 15 * MINUTE },
  { label: "1 hour", duration: "1h", ms: HOUR },
  { label: "A day", duration: "1d", ms: DAY },
];

/** Who may post and react after joining (the server's levels; moderators, people with roles and bots skip it). */
export type VerificationLevel = "none" | "low" | "medium" | "high";
export const VERIFICATION_LEVELS: readonly { level: VerificationLevel; label: string; hint: string }[] = [
  { level: "none", label: "None", hint: "Anyone in the community can post." },
  { level: "low", label: "Low", hint: "Their account needs a verified email." },
  { level: "medium", label: "Medium", hint: "Low, plus an account and a membership at least 5 minutes old." },
  { level: "high", label: "High", hint: "Low, plus an account 5 minutes old and a membership 10 minutes old." },
];

/** Accounts younger than this can't join. Moderators and Meldiq staff are never held back. */
export type AccountAgeGate = "off" | "10m" | "1h" | "1d" | "7d";
export const ACCOUNT_AGE_CHOICES: readonly { gate: AccountAgeGate; label: string }[] = [
  { gate: "off", label: "Off" },
  { gate: "10m", label: "Younger than 10 minutes" },
  { gate: "1h", label: "Younger than 1 hour" },
  { gate: "1d", label: "Younger than 1 day" },
  { gate: "7d", label: "Younger than 7 days" },
];

export const NICKNAME_MAX = 32;

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

/** The name to show for someone in a community: their nickname there, else their display name. */
export function shownName(displayName: string, nickname: string | null | undefined): string {
  return nickname?.trim() ? nickname : displayName;
}

const zLockView = z.object({
  lockedUntil: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  lockReason: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});

/**
 * Locks the community for [choice] (nobody new joins, only moderators post) or unlocks it (null). Servers without
 * community-safety only have Security actions' join pause, which this falls back to.
 */
export async function lockCommunity(engine: Engine, orgId: string, choice: LockChoice | null, realLock: boolean): Promise<void> {
  if (!realLock) {
    await setSecurity(engine, orgId, { invitesPausedUntil: choice ? Date.now() + choice.ms : null });
    return;
  }
  await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/lock`, zLockView, { body: { duration: choice?.duration ?? null } });
  await engine.refreshAll();
}

/** Sets or clears a nickname in this community: your own (members.nickname) or someone else's (members.nicknames). */
export async function setCommunityNickname(engine: Engine, orgId: string, userId: string, nickname: string | null): Promise<string | null> {
  const r = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/members/${enc(userId)}/nickname`, z.object({ nickname: z.string().nullable() }), { body: { nickname } });
  return r.nickname;
}

const zStage = z.object({ conversationId: z.string(), speakerIds: z.array(z.string()) });

/** Lets someone speak on a stage (its moderators), or sends them back to the audience (also the speaker themself). */
export async function setStageSpeaker(engine: Engine, conversationId: string, userId: string, speaking: boolean): Promise<string[]> {
  const r = await engine.api.json(speaking ? "PUT" : "DELETE", `/v1/conversations/${enc(conversationId)}/stage/speakers/${enc(userId)}`, zStage);
  return r.speakerIds;
}
