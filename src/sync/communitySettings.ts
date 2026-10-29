import { z } from "zod";
import { zCommunityLink } from "../api/schemas";
import type { Engine } from "./engine";

/**
 * A community's settings from the reference's Server Profile, Theme and Onboarding pages (community parity A3, feature
 * community-settings; server docs/COMMUNITY_SETTINGS_API.md): name, accent and background tint, links, the custom
 * invite link, onboarding's "must finish" and the channel people land in, and each member's never-expiring invite link.
 */

const enc = encodeURIComponent;

export const SETTINGS_LIMITS = { name: 100, links: 5, linkLabel: 40, linkUrl: 500, slugMin: 3, slugMax: 32 } as const;

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

export const zCommunitySettings = z.object({
  name: z.string(),
  accent: nullableString,
  background: nullableString,
  links: z.array(zCommunityLink).default([]),
  inviteSlug: nullableString,
  inviteSlugMinMembers: z.number().int().default(5),
  memberCount: z.number().int().default(0),
  onboardingRequired: z.boolean().default(false),
  onboardingRequiredSince: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  startChannelId: nullableString,
});
export type CommunitySettings = z.infer<typeof zCommunitySettings>;

export interface CommunitySettingsChange {
  name?: string;
  accent?: string | null;
  background?: string | null;
  links?: { label: string; url: string }[];
  inviteSlug?: string | null;
  onboardingRequired?: boolean;
  startChannelId?: string | null;
}

export function communitySettings(engine: Engine, orgId: string): Promise<CommunitySettings> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/settings`, zCommunitySettings);
}

export async function saveCommunitySettings(engine: Engine, orgId: string, change: CommunitySettingsChange): Promise<CommunitySettings> {
  const r = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/settings`, zCommunitySettings, { body: change });
  await engine.refreshAll();
  return r;
}

const zStandardInvite = z.object({ invite: z.object({ id: z.string(), code: z.string(), uses: z.number().int().default(0) }) });

/** The caller's never-expiring invite link: the same code every time while it works. */
export async function standardInvite(engine: Engine, orgId: string): Promise<string> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/invites/standard`, zStandardInvite)).invite.code;
}

export const zOnboardingStatus = z.object({
  onboardingRequired: z.boolean().default(false),
  onboardingDone: z.boolean().default(true),
  startChannelId: nullableString,
  mustFinishOnboarding: z.boolean().default(false),
});
export type OnboardingStatus = z.infer<typeof zOnboardingStatus>;

/** Finishes (or redoes) onboarding, after the required answers and the rules; answers where to land. */
export async function finishOnboarding(engine: Engine, orgId: string): Promise<OnboardingStatus> {
  const r = await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/onboarding/finish`, zOnboardingStatus);
  await engine.refreshAll();
  return r;
}

/** Why the custom invite link can't be set yet (5 members), or null when it can. */
export function slugLockedReason(memberCount: number, minMembers: number): string | null {
  if (memberCount >= minMembers) return null;
  const more = minMembers - memberCount;
  return `Unlocks at ${minMembers} members. ${more === 1 ? "1 more person" : `${more} more people`} to go.`;
}

/** What's wrong with a custom invite link before sending it (the server checks again, reserved words included). */
export function slugProblem(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (s === "") return null;
  if (s.length < SETTINGS_LIMITS.slugMin || s.length > SETTINGS_LIMITS.slugMax) return `Use ${SETTINGS_LIMITS.slugMin} to ${SETTINGS_LIMITS.slugMax} characters.`;
  if (!/^[a-z0-9-]+$/.test(s)) return "Use lowercase letters, digits and hyphens.";
  if (s.startsWith("-") || s.endsWith("-")) return "It can't start or end with a hyphen.";
  return null;
}

/** What's wrong with a link before sending it: a label and an https address. */
export function linkProblem(link: { label: string; url: string }): string | null {
  if (!link.label.trim()) return "Give the link a name.";
  try {
    if (new URL(link.url.trim()).protocol !== "https:") return "Use a link that starts with https://";
  } catch {
    return "Use a link that starts with https://";
  }
  return null;
}
