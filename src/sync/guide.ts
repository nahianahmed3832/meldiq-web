import { z } from "zod";
import type { Org } from "../api/schemas";
import type { LocalStore } from "../store/db";
import type { Engine } from "./engine";

/**
 * The community guide and onboarding questions (batch B8b; server routes/guide.ts, onboarding.ts; android GuideRules,
 * OnboardingRules). Which guide tasks someone did is kept on this browser, as the phone keeps it on the phone.
 */
export type Guide = NonNullable<Org["guide"]>;
const enc = encodeURIComponent;

export interface GuideItemInput {
  id?: string;
  title: string;
  channelId: string;
}

/** Saves the guide (people who can edit the community); null or an empty one removes it. */
export async function setGuide(engine: Engine, orgId: string, guide: { welcome: string | null; tasks: GuideItemInput[]; resources: GuideItemInput[] } | null): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/guide`, { body: guide });
  await engine.refreshAll();
}

const DONE_KEY = "guide.done";
const HIDDEN_KEY = "guide.hidden";

/** [done] after opening [channelId] in [orgId]: its guide tasks that point there are ticked (android GuideRules.visit). */
export function visitGuide(done: Readonly<Record<string, string[]>>, orgId: string, guide: Guide | null, channelId: string): Record<string, string[]> {
  const ids = (guide?.tasks ?? [])
    .filter((t) => t.channelId === channelId)
    .map((t) => t.id)
    .filter((x): x is string => !!x);
  if (ids.length === 0) return { ...done };
  const mine = done[orgId] ?? [];
  const next = [...new Set([...mine, ...ids])];
  return next.length === mine.length ? { ...done } : { ...done, [orgId]: next };
}

/** How many of the guide's tasks are done, of how many. */
export function guideProgress(guide: Guide, done: readonly string[]): [number, number] {
  return [guide.tasks.filter((t) => !!t.id && done.includes(t.id)).length, guide.tasks.length];
}

export async function guideDone(store: LocalStore): Promise<Record<string, string[]>> {
  return (await store.getValue<Record<string, string[]>>(DONE_KEY)) ?? {};
}

/** A channel was opened: any guide task pointing to it is done (kept on this browser). True when that changed anything. */
export async function noteGuideVisit(store: LocalStore, orgId: string, guide: Guide | null, channelId: string): Promise<boolean> {
  const before = await guideDone(store);
  const after = visitGuide(before, orgId, guide, channelId);
  if ((after[orgId]?.length ?? 0) === (before[orgId]?.length ?? 0)) return false;
  await store.setValue(DONE_KEY, after);
  return true;
}

/** The guide card's × hides it for now (this browser), until the guide changes. */
export async function guideHidden(store: LocalStore): Promise<Record<string, string>> {
  return (await store.getValue<Record<string, string>>(HIDDEN_KEY)) ?? {};
}

export async function hideGuide(store: LocalStore, orgId: string, guide: Guide): Promise<void> {
  await store.setValue(HIDDEN_KEY, { ...(await guideHidden(store)), [orgId]: guideSignature(guide) });
}

/** What the guide says, to tell when it changed (a hidden card comes back then). */
export const guideSignature = (g: Guide): string => JSON.stringify([g.welcome, g.tasks.map((t) => [t.title, t.channelId]), g.resources.map((r) => [r.title, r.channelId])]);

// ───────────── onboarding ─────────────

const zOption = z.object({ id: z.string(), title: z.string(), emoji: z.string().nullish(), roleIds: z.array(z.string()).default([]), channelIds: z.array(z.string()).default([]) });
const zPrompt = z.object({ id: z.string(), title: z.string(), single: z.boolean().default(false), required: z.boolean().default(false), options: z.array(zOption) });
export type OnboardingPrompt = z.infer<typeof zPrompt>;
const zOnboarding = z.object({
  enabled: z.boolean(),
  prompts: z.array(zPrompt),
  answered: z.array(z.string()).nullish(),
  answeredAt: z.number().nullish(),
});
export type Onboarding = z.infer<typeof zOnboarding>;

export const ONBOARDING_LIMITS = { prompts: 5, options: 10, title: 100, rolesPerOption: 5, channelsPerOption: 10 } as const;

export function onboarding(engine: Engine, orgId: string): Promise<Onboarding> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/onboarding`, zOnboarding);
}

/** A question as an editor sends it: ids are kept for existing questions and answers, new ones get theirs from the server. */
export type OnboardingPromptInput = Omit<OnboardingPrompt, "id" | "options"> & { id?: string; options: (Omit<OnboardingPrompt["options"][number], "id"> & { id?: string })[] };

export async function setOnboarding(engine: Engine, orgId: string, enabled: boolean, prompts: OnboardingPromptInput[]): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/onboarding`, { body: { enabled, prompts } });
  await engine.refreshAll();
}

export async function answerOnboarding(engine: Engine, orgId: string, optionIds: string[]): Promise<void> {
  await engine.api.call("POST", `/v1/orgs/${enc(orgId)}/onboarding/answers`, { body: { optionIds } });
  await engine.refreshAll();
  await engine.community.refresh(orgId);
}

/** Choosing [optionId] in [prompt]: a single-answer question replaces its choice, others toggle (android OnboardingRules). */
export function toggleAnswer(chosen: ReadonlySet<string>, prompt: OnboardingPrompt, optionId: string): Set<string> {
  const ids = new Set(prompt.options.map((o) => o.id));
  const next = new Set(chosen);
  if (next.has(optionId)) next.delete(optionId);
  else {
    if (prompt.single) for (const id of ids) next.delete(id);
    next.add(optionId);
  }
  return next;
}

/** The first required question with no answer, or null when the answers can be sent. */
export function missingAnswer(prompts: readonly OnboardingPrompt[], chosen: ReadonlySet<string>): OnboardingPrompt | null {
  return prompts.find((p) => p.required && !p.options.some((o) => chosen.has(o.id))) ?? null;
}
