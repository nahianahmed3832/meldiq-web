import { z } from "zod";
import { ApiError } from "../api/client";
import type { Conversation, Org } from "../api/schemas";
import type { Engine } from "./engine";

/**
 * A community's rules channel and its rules (API 0.65.0, feature rules-channel; server docs/SETTINGS_PARITY_API.md):
 * only people who can edit the community post in the rules channel, everyone reads and reacts there, and a community can
 * ask members to agree to its rules before they post or react. The server decides every one of these; the web mirrors
 * them so the right controls show.
 */

export const RULES_FEATURE = "rules-channel";
export const RULES_LIMITS = { rules: 25, title: 100, description: 1000 } as const;

const zRule = z.object({
  id: z.string(),
  title: z.string(),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});
export type Rule = z.infer<typeof zRule>;

export const zRulesView = z.object({
  channelId: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  required: z.boolean(),
  rules: z.array(zRule),
  updatedAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  agreedAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  mustAgree: z.boolean(),
});
export type RulesView = z.infer<typeof zRulesView>;

export type RulesSummary = NonNullable<Org["rulesChannel"]>;

/** A rule as an editor types it: an id for one that's saved already. */
export interface RuleDraft {
  id?: string;
  title: string;
  description: string;
}

export interface RulesSettings {
  channelId: string | null;
  required: boolean;
  rules: RuleDraft[];
}

const enc = encodeURIComponent;

export function communityRules(engine: Engine, orgId: string): Promise<RulesView> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/rules`, zRulesView);
}

/** Saves the rules channel, the rules and the "must agree" switch (people who can edit the community). */
export async function saveCommunityRules(engine: Engine, orgId: string, settings: RulesSettings): Promise<RulesView> {
  const view = await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/rules`, zRulesView, { body: rulesBody(settings) });
  await engine.refreshAll();
  return view;
}

/** This account agrees to the community's rules; the composer opens up once the community list has refreshed. */
export async function agreeToRules(engine: Engine, orgId: string): Promise<RulesView> {
  const view = await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/rules/agree`, zRulesView);
  await engine.refreshAll();
  return view;
}

/** What PUT takes: blank rules left out, text trimmed, an empty description sent as null. */
export function rulesBody(settings: RulesSettings): { channelId: string | null; required: boolean; rules: { id?: string; title: string; description: string | null }[] } {
  const rules = settings.rules
    .map((r) => ({ ...(r.id ? { id: r.id } : {}), title: r.title.trim(), description: r.description.trim() || null }))
    .filter((r) => r.title.length > 0)
    .slice(0, RULES_LIMITS.rules);
  return { channelId: settings.channelId || null, required: settings.required && rules.length > 0, rules };
}

/** Why the settings can't be saved yet, or null. */
export function rulesProblem(settings: RulesSettings): string | null {
  const titled = settings.rules.filter((r) => r.title.trim());
  if (settings.rules.some((r) => !r.title.trim() && r.description.trim())) return "Every rule needs a title.";
  if (titled.length > RULES_LIMITS.rules) return `A community can have up to ${RULES_LIMITS.rules} rules.`;
  if (settings.required && titled.length === 0) return "Add a rule before asking members to agree.";
  return null;
}

/** A rule moved one place up (-1) or down (+1); the list unchanged at either end. */
export function moveRule<T>(list: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Whether [conversationId] is [org]'s rules channel. */
export function isRulesChannel(org: Pick<Org, "rulesChannel"> | null | undefined, conversationId: string): boolean {
  return !!org?.rulesChannel?.channelId && org.rulesChannel.channelId === conversationId;
}

/** What this account may do in a conversation, the community's rules applied on top of the server's canPost. */
export interface PostingState {
  post: boolean;
  react: boolean;
  /** The community asks this account to agree to its rules first. */
  mustAgree: boolean;
  rulesChannel: boolean;
}

export function postingState(c: Pick<Conversation, "id" | "type" | "canPost" | "archived" | "timedOutUntil">, org: Pick<Org, "rulesChannel"> | null | undefined, now = Date.now()): PostingState {
  const channel = c.type === "CHANNEL";
  const mustAgree = channel && !!org?.rulesChannel?.mustAgree;
  const rulesChannel = channel && isRulesChannel(org, c.id);
  const timedOut = !!c.timedOutUntil && c.timedOutUntil > now;
  const react = !mustAgree && (c.canPost || (rulesChannel && !c.archived && !timedOut));
  return { post: c.canPost && !mustAgree, react, mustAgree, rulesChannel };
}

/** The orgs list after the server said this account hasn't agreed to [orgId]'s rules: the prompt shows at once. */
export function withMustAgree(orgs: readonly Org[], orgId: string): Org[] {
  return orgs.map((o) => (o.id === orgId ? { ...o, rulesChannel: { channelId: null, count: 0, ...o.rulesChannel, required: true, agreedAt: null, mustAgree: true } } : o));
}

/** The community a "rules_not_agreed" refusal names, or null for any other error. */
export function rulesRefusalOrg(e: unknown): string | null {
  if (!(e instanceof ApiError) || e.code !== "rules_not_agreed") return null;
  const orgId = (e.details as { orgId?: unknown } | undefined)?.orgId;
  return typeof orgId === "string" ? orgId : null;
}
