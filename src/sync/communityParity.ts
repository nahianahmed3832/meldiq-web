import { text as uiText } from "../i18n";
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
const MINUTE = 60000;
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
  {
    get label() {
      return uiText("organization.interface.15_minutes_2f18bc2");
    },
    duration: "15m",
    ms: 15 * MINUTE,
  },
  {
    get label() {
      return uiText("workspace.interface.1_hour_f8b8883");
    },
    duration: "1h",
    ms: HOUR,
  },
  {
    get label() {
      return uiText("organization.interface.8_hours_1ee36a4");
    },
    duration: "8h",
    ms: 8 * HOUR,
  },
  {
    get label() {
      return uiText("workspace.interface.1_day_fa665d9");
    },
    duration: "1d",
    ms: DAY,
  },
];
/** The Profile page's three quick locks (the reference offers 15 min / 1 hour / a day there). */
export const PROFILE_LOCK_CHOICES: readonly LockChoice[] = [
  {
    get label() {
      return uiText("organization.interface.15_min_8d616d3");
    },
    duration: "15m",
    ms: 15 * MINUTE,
  },
  {
    get label() {
      return uiText("workspace.interface.1_hour_f8b8883");
    },
    duration: "1h",
    ms: HOUR,
  },
  {
    get label() {
      return uiText("organization.interface.a_day_087fcff");
    },
    duration: "1d",
    ms: DAY,
  },
];
/** Who may post and react after joining (the server's levels; moderators, people with roles and bots skip it). */
export type VerificationLevel = "none" | "low" | "medium" | "high";
export const VERIFICATION_LEVELS: readonly {
  level: VerificationLevel;
  label: string;
  hint: string;
}[] = [
  {
    level: "none",
    get label() {
      return uiText("settings.ap_none");
    },
    get hint() {
      return uiText("organization.interface.anyone_in_the_community_can_post_f28b449");
    },
  },
  {
    level: "low",
    get label() {
      return uiText("organization.interface.low_f793de2");
    },
    get hint() {
      return uiText("organization.interface.their_account_needs_a_verified_email_4c01c86");
    },
  },
  {
    level: "medium",
    get label() {
      return uiText("organization.interface.medium_8e588cd");
    },
    get hint() {
      return uiText("organization.interface.low_plus_an_account_and_a_membership_at_least_5_minutes_old_4e2c01d");
    },
  },
  {
    level: "high",
    get label() {
      return uiText("calls.interface.high_c4ebc6d");
    },
    get hint() {
      return uiText("organization.interface.low_plus_an_account_5_minutes_old_and_a_membership_10_minutes_old_3156127");
    },
  },
];
/** Accounts younger than this can't join. Moderators and Meldiq staff are never held back. */
export type AccountAgeGate = "off" | "10m" | "1h" | "1d" | "7d";
export const ACCOUNT_AGE_CHOICES: readonly {
  gate: AccountAgeGate;
  label: string;
}[] = [
  {
    gate: "off",
    get label() {
      return uiText("messaging.interface.off_ca7981b");
    },
  },
  {
    gate: "10m",
    get label() {
      return uiText("organization.interface.younger_than_10_minutes_9124b9f");
    },
  },
  {
    gate: "1h",
    get label() {
      return uiText("organization.interface.younger_than_1_hour_64510f9");
    },
  },
  {
    gate: "1d",
    get label() {
      return uiText("organization.interface.younger_than_1_day_e5602aa");
    },
  },
  {
    gate: "7d",
    get label() {
      return uiText("organization.interface.younger_than_7_days_3bc0b6e");
    },
  },
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
  if ([...nickname].length > NICKNAME_MAX) return uiText("organization.interface.keep_it_to_value0_characters_243f5c3", { value0: NICKNAME_MAX });
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
