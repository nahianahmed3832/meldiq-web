import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Workspace workflows (server docs/WORKFLOWS.md, android round 7 slice C3 WorkflowRules): "when this happens in the
 * workspace, do that". A trigger with a real server event behind it, optional conditions, one to five actions from a
 * fixed set. They run on the server with their owner's rights, which it checks on every run.
 */
export const RECURRENCES = ["daily", "weekdays", "weekly", "monthly"] as const;
export const OPS = ["is", "is_not", "contains"] as const;
export const ACTION_TYPES = ["post_channel", "add_to_channels", "email_admins"] as const;
export const MAX_ACTIONS = 5;
export const MAX_CONDITIONS = 5;
export const MAX_TEXT = 300;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const zSchedule = z.object({ recurrence: z.string(), localTime: z.string(), anchorDate: z.string(), timeZone: z.string() });
export type WfSchedule = z.infer<typeof zSchedule>;
const zTrigger = z.object({ type: z.string(), schedule: zSchedule.optional() });
export type WfTrigger = z.infer<typeof zTrigger>;
const zCondition = z.object({ field: z.string(), op: z.string(), value: z.string() });
export type WfCondition = z.infer<typeof zCondition>;
const zAction = z.object({ type: z.string(), channelId: z.string().optional(), channelIds: z.array(z.string()).optional(), subject: z.string().optional(), text: z.string().optional() });
export type WfAction = z.infer<typeof zAction>;

export interface WfInput {
  name: string;
  trigger: WfTrigger;
  conditions: WfCondition[];
  actions: WfAction[];
  enabled: boolean;
}

const zWorkflow = z.object({
  id: z.string(),
  name: z.string(),
  trigger: zTrigger,
  conditions: z.array(zCondition),
  actions: z.array(zAction),
  enabled: z.boolean(),
  owner: z.object({ id: z.string(), name: z.string().nullable(), allowed: z.boolean() }),
  nextRunAt: z.number().nullable(),
  rev: z.number(),
  updatedAt: z.number(),
  lastRun: z.object({ state: z.string(), at: z.number(), finishedAt: z.number().nullable(), errorKind: z.string().nullable() }).nullable(),
});
export type Workflow = z.infer<typeof zWorkflow>;

const zCatalog = z.object({
  triggers: z.array(z.object({ type: z.string(), label: z.string(), description: z.string() })),
  conditions: z.array(z.object({ field: z.string(), triggers: z.array(z.string()) })),
  actions: z.array(z.object({ type: z.string(), label: z.string(), description: z.string() })),
  unavailable: z.array(z.object({ type: z.string(), reason: z.string() })).default([]),
});
export type WfCatalog = z.infer<typeof zCatalog>;
const zTemplate = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  needs: z.array(z.string()),
  workflow: z.object({ trigger: zTrigger, conditions: z.array(zCondition).default([]), actions: z.array(zAction) }),
});
export type WfTemplate = z.infer<typeof zTemplate>;

const zOutcome = z.object({ type: z.string(), status: z.string(), detail: z.string() });
export type WfOutcome = z.infer<typeof zOutcome>;
const zRun = z.object({
  id: z.string(),
  state: z.string(),
  attempts: z.number(),
  createdAt: z.number(),
  finishedAt: z.number().nullable(),
  errorKind: z.string().nullable(),
  outcomes: z.array(zOutcome),
  event: z.object({ type: z.string(), member: z.object({ name: z.string() }).optional(), channel: z.object({ name: z.string() }).optional(), occurrenceAt: z.number().optional() }),
});
export type WfRun = z.infer<typeof zRun>;
const zTest = z.object({ conditionsHoldForSample: z.boolean(), nextRunAt: z.number().nullable(), outcomes: z.array(zOutcome) });
export type WfTest = z.infer<typeof zTest>;

const enc = encodeURIComponent;
const base = (orgId: string) => `/v1/orgs/${enc(orgId)}/workflows`;

export async function workflowCatalog(engine: Engine, orgId: string): Promise<{ catalog: WfCatalog; templates: WfTemplate[] }> {
  return engine.api.json("GET", `${base(orgId)}/catalog`, z.object({ catalog: zCatalog, templates: z.array(zTemplate) }));
}
export async function listWorkflows(engine: Engine, orgId: string): Promise<Workflow[]> {
  return (await engine.api.json("GET", base(orgId), z.object({ workflows: z.array(zWorkflow) }))).workflows;
}
export async function createWorkflow(engine: Engine, orgId: string, input: WfInput): Promise<Workflow> {
  return (await engine.api.json("POST", base(orgId), z.object({ workflow: zWorkflow }), { body: input })).workflow;
}
/** Saving makes you its owner: it then runs with your rights. A stale [rev] is refused (409). */
export async function updateWorkflow(engine: Engine, orgId: string, id: string, rev: number, input: WfInput): Promise<Workflow> {
  return (await engine.api.json("PUT", `${base(orgId)}/${enc(id)}`, z.object({ workflow: zWorkflow }), { body: { ...input, rev } })).workflow;
}
export async function deleteWorkflow(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("DELETE", `${base(orgId)}/${enc(id)}`);
}
/** A dry run for a sample event: what each action would do, changing nothing. */
export async function testWorkflow(engine: Engine, orgId: string, input: WfInput): Promise<WfTest> {
  return (await engine.api.json("POST", `${base(orgId)}/test`, z.object({ test: zTest }), { body: input })).test;
}
export async function workflowRuns(engine: Engine, orgId: string, id: string): Promise<WfRun[]> {
  return (await engine.api.json("GET", `${base(orgId)}/${enc(id)}/runs`, z.object({ runs: z.array(zRun) }))).runs;
}
export async function cancelRun(engine: Engine, orgId: string, runId: string): Promise<void> {
  await engine.api.call("POST", `/v1/orgs/${enc(orgId)}/workflow-runs/${enc(runId)}/cancel`, { body: {} });
}

/** The editable parts of a saved workflow. */
export const inputOf = (w: Workflow): WfInput => ({ name: w.name, trigger: w.trigger, conditions: w.conditions, actions: w.actions, enabled: w.enabled });

/** A template with its placeholders filled: the channel the person picked, today's date and their time zone. */
export function fromTemplate(t: WfTemplate, channelId: string | null, today: string, timeZone: string): WfInput {
  const fill = (s: string | undefined) => s?.replace("{channel}", channelId ?? "") || undefined;
  const tr = t.workflow.trigger;
  const trigger: WfTrigger = tr.schedule
    ? { ...tr, schedule: { ...tr.schedule, anchorDate: tr.schedule.anchorDate.replace("{today}", today), timeZone: tr.schedule.timeZone.replace("{timeZone}", timeZone) } }
    : tr;
  return {
    name: t.name,
    trigger,
    conditions: t.workflow.conditions,
    actions: t.workflow.actions.map((a) => ({ ...a, channelId: fill(a.channelId), channelIds: a.channelIds?.map((c) => fill(c)).filter((c): c is string => !!c) })),
    enabled: true,
  };
}

/** A fresh workflow: someone joins, post in a channel to be picked. */
export const blankWorkflow = (): WfInput => ({ name: "", trigger: { type: "member.joined" }, conditions: [], actions: [{ type: "post_channel", text: "" }], enabled: true });

export const defaultSchedule = (today: string, timeZone: string): WfSchedule => ({ recurrence: "weekly", localTime: "09:00", anchorDate: today, timeZone });

/** Condition fields that apply to [trigger], from the server's catalog. */
export function fieldsFor(catalog: WfCatalog | null, trigger: string): string[] {
  return (catalog?.conditions ?? []).filter((c) => c.triggers.includes(trigger)).map((c) => c.field);
}

/** Which actions fit [trigger]: adding to channels needs a member trigger. */
export function actionsFor(trigger: string): string[] {
  return trigger === "member.joined" || trigger === "member.role_changed" ? [...ACTION_TYPES] : ACTION_TYPES.filter((t) => t !== "add_to_channels");
}

export function newAction(type: string): WfAction {
  if (type === "add_to_channels") return { type, channelIds: [] };
  if (type === "email_admins") return { type, subject: "", text: "" };
  return { type, text: "" };
}

/** Changing the trigger drops what no longer fits it and sets or clears the schedule. */
export function withTrigger(input: WfInput, catalog: WfCatalog | null, trigger: string, today: string, timeZone: string): WfInput {
  const fields = new Set(fieldsFor(catalog, trigger));
  const actions = input.actions.filter((a) => actionsFor(trigger).includes(a.type));
  return {
    ...input,
    trigger: trigger === "schedule" ? { type: trigger, schedule: input.trigger.schedule ?? defaultSchedule(today, timeZone) } : { type: trigger },
    conditions: input.conditions.filter((c) => fields.has(c.field)),
    actions: actions.length ? actions : [newAction("post_channel")],
  };
}

/** What still needs filling in before Save, in the order it appears; empty when the server can be asked. */
export function workflowProblems(input: WfInput): string[] {
  const out: string[] = [];
  if (!input.name.trim()) out.push("Give the workflow a name");
  const s = input.trigger.schedule;
  if (s && !TIME.test(s.localTime)) out.push("Set the time as HH:MM, for example 09:00");
  if (input.trigger.type === "schedule" && !s) out.push("Set the schedule");
  input.conditions.forEach((c, i) => !c.value.trim() && out.push(`Condition ${i + 1} needs a value`));
  if (!input.actions.length) out.push("Add an action");
  input.actions.forEach((a, i) => {
    const n = i + 1;
    if (a.type === "post_channel") {
      if (!a.channelId) out.push(`Action ${n}: pick a channel`);
      if (!a.text?.trim()) out.push(`Action ${n}: write the message`);
    } else if (a.type === "add_to_channels") {
      if (!a.channelIds?.length) out.push(`Action ${n}: pick at least one channel`);
    } else if (a.type === "email_admins") {
      if (!a.subject?.trim()) out.push(`Action ${n}: write a subject`);
      if (!a.text?.trim()) out.push(`Action ${n}: write the email`);
    }
    if ((a.text?.length ?? 0) > MAX_TEXT) out.push(`Action ${n}: at most ${MAX_TEXT} characters`);
  });
  return out;
}

export const opLabel = (op: string): string => op.replace(/_/g, " ");
export const fieldLabel = (field: string): string => field.replace(/\./g, " ").replace(/_/g, " ");

/** A short line for the list: "3 actions · 1 condition · daily at 09:00". */
export function workflowSummary(input: Pick<WfInput, "trigger" | "conditions" | "actions">): string {
  let s = input.actions.length === 1 ? "1 action" : `${input.actions.length} actions`;
  if (input.conditions.length) s += ` · ${input.conditions.length} condition${input.conditions.length === 1 ? "" : "s"}`;
  if (input.trigger.schedule) s += ` · ${input.trigger.schedule.recurrence} at ${input.trigger.schedule.localTime}`;
  return s;
}
