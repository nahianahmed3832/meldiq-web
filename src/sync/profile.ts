import { z } from "zod";
import { type Member, zMember, zProfile } from "../api/schemas";
import type { Engine } from "./engine";

/**
 * The person's own profile, privacy and blocks (docs/PROFILE_AND_PRIVACY.md; server/src/routes/users.ts). The server
 * decides who sees each field; nothing hidden is sent to people who may not see it.
 */

export const AUDIENCES = ["everyone", "contacts", "nobody"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const PRIVACY_FIELDS = ["photo", "bio", "name", "birthday", "phone", "lastSeen", "findByPhone", "findByUsername"] as const;
export type PrivacyField = (typeof PRIVACY_FIELDS)[number];
export type Privacy = Record<PrivacyField, Audience>;

const zAudience = z.enum(AUDIENCES);
const zPrivacy = z.object(Object.fromEntries(PRIVACY_FIELDS.map((f) => [f, zAudience])) as Record<PrivacyField, typeof zAudience>);

const opt = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

export const zMyProfile = zProfile.extend({ birthday: opt, phone: opt, privacy: zPrivacy.partial().optional() });
export type MyProfile = z.infer<typeof zMyProfile>;

export async function myProfile(engine: Engine): Promise<MyProfile> {
  return (await engine.api.json("GET", "/v1/users/me", z.object({ user: zMyProfile }))).user;
}

export interface ProfileChange {
  displayName?: string;
  statusText?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthday?: string | null;
  phone?: string | null;
  username?: string;
}

export async function updateMyProfile(engine: Engine, change: ProfileChange): Promise<MyProfile> {
  const { user } = await engine.api.json("PATCH", "/v1/users/me", z.object({ user: zMyProfile }), { body: change });
  await engine.refreshAll();
  return user;
}

export async function setMyPhoto(engine: Engine, jpeg: Uint8Array): Promise<void> {
  await engine.api.call("PUT", "/v1/users/me/photo", { raw: jpeg });
  await engine.refreshAll();
}

export async function removeMyPhoto(engine: Engine): Promise<void> {
  await engine.api.call("DELETE", "/v1/users/me/photo");
  await engine.refreshAll();
}

export async function setPrivacy(engine: Engine, change: Partial<Privacy>): Promise<Privacy> {
  return (await engine.api.json("PUT", "/v1/users/me/privacy", z.object({ privacy: zPrivacy }), { body: change })).privacy;
}

export async function blockedIds(engine: Engine): Promise<string[]> {
  return (await engine.api.json("GET", "/v1/blocks", z.object({ userIds: z.array(z.string()) }))).userIds;
}

export async function block(engine: Engine, userId: string): Promise<void> {
  await engine.api.call("POST", "/v1/blocks", { body: { userId } });
}

export async function unblock(engine: Engine, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/blocks/${encodeURIComponent(userId)}`);
}

/** Someone by exact phone number, if they allow it (never a list; the same answer when nobody has it). */
export async function findByPhone(engine: Engine, phone: string): Promise<Member | null> {
  try {
    const r = await engine.api.json("GET", `/v1/users/by-phone?phone=${encodeURIComponent(phone.replace(/[\s()-]/g, ""))}`, z.object({ user: zMember.nullable().optional() }));
    return r.user ?? null;
  } catch {
    return null;
  }
}

/** "2026-03-14" or "--03-14" (day and month only), as the server stores birthdays. */
export function birthdayProblem(v: string): string | null {
  if (!v.trim()) return null;
  const m = v.trim().match(/^(\d{4}|--)-?(\d{2})-(\d{2})$/);
  if (!m) return "Use YYYY-MM-DD, or --MM-DD without the year.";
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "That isn't a real date.";
  return null;
}

export function phoneProblem(v: string): string | null {
  if (!v.trim()) return null;
  return /^\+[1-9]\d{6,14}$/.test(v.replace(/[\s()-]/g, "")) ? null : "Start with + and the country code, e.g. +8801712345678.";
}
