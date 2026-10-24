import { z } from "zod";
import type { SharedMessage } from "./agentRules";
import type { Engine } from "./engine";

/**
 * AI Workforce (server docs/AI_WORKFORCE.md): a community's installed AI agents, their channels, jobs, approvals and
 * deliverables. What a person sends an agent (their brief, the files they choose) leaves end-to-end encryption: the
 * browser sends it in the clear to the server and its AI provider, after a notice saying so. Agents' posts and files
 * are kept by the server and are not end-to-end encrypted either; the app labels them.
 */
const enc = encodeURIComponent;
const nullableString = z.string().nullable();

export const AI_NOTICE = "What you send to an AI agent and what it makes aren't end-to-end encrypted: they're processed on Meldiq's servers and by the AI provider the platform uses.";

export const zInstall = z.object({
  id: z.string(),
  agentId: z.string(),
  version: z.number(),
  state: z.enum(["active", "disabled", "uninstalled"]),
  displayName: z.string(),
  avatar: z.object({ sha256: z.string() }).nullable(),
  avatarColor: nullableString,
  description: z.string(),
  roleTitle: z.string(),
  language: nullableString,
  style: z.string(),
  instructions: z.string(),
  tools: z.array(z.string()),
  executionMode: z.enum(["review", "auto"]),
  effectiveMode: z.enum(["review", "auto"]),
  maxJobsPerDay: z.number().nullable(),
  maxConcurrent: z.number().nullable(),
  invokers: z.object({ everyone: z.boolean(), roles: z.array(z.string()) }),
  /** How much it does on its own (server docs/AI_WORKFORCE.md §5b); older servers don't send it. */
  autonomy: z.enum(["manual", "assisted", "guarded", "continuous"]).default("assisted"),
  maxRuntimeSec: z.number().nullable().default(null),
  maxAttempts: z.number().nullable().default(null),
  activeHours: z.object({ from: z.string(), to: z.string(), timeZone: z.string() }).nullable().default(null),
  rev: z.number(),
  skill: z.object({ id: z.string(), version: z.number(), name: z.string(), category: z.string() }).nullable(),
  badge: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Install = z.infer<typeof zInstall>;

const zPerms = z.object({ canUse: z.boolean(), canManage: z.boolean(), canApprove: z.boolean() });
export type AiPermissions = z.infer<typeof zPerms>;

const zOverview = z.object({
  enabled: z.boolean(),
  paused: z.boolean(),
  aiRequestsOn: z.boolean(),
  approvalFloor: z.string(),
  mediaEngine: z.object({ available: z.boolean(), detail: z.string() }),
  permissions: zPerms,
  agents: z.array(zInstall),
  notice: z.string(),
});
export type AiOverview = z.infer<typeof zOverview>;

const zSkill = z.object({
  id: z.string(),
  version: z.number(),
  tools: z.array(z.string()),
  requiredTools: z.array(z.string()),
  modelCategories: z.array(z.string()),
  requiredModelCategories: z.array(z.string()),
  files: z.object({ min: z.number().default(0), max: z.number(), maxBytes: z.number(), types: z.array(z.string()) }),
  /** Whether a channel request may share recent messages with it (agents that read text). */
  readsMessages: z.boolean().default(false),
  /** maxRuntimeSec, maxAttempts, maxModelCalls, maxOutputFiles: an installation can only tighten them. */
  limits: z.record(z.string(), z.number()).default({}),
  approvals: z.array(z.string()),
  errors: z.array(z.string()),
  inputSchema: z.unknown(),
});
export const zAgentDef = z.object({
  id: z.string(),
  version: z.number(),
  name: z.string(),
  description: z.string(),
  roleTitle: z.string(),
  category: z.string(),
  capabilities: z.array(z.string()),
  examples: z.array(z.string()),
  avatarColor: z.string(),
  skill: zSkill,
  integrations: z.array(z.object({ tool: z.string(), label: z.string(), connected: z.boolean() })),
});
export type AgentDef = z.infer<typeof zAgentDef>;

const zSetup = z.object({ ready: z.boolean(), missing: z.array(z.string()), unavailableActions: z.array(z.string()) });
const zCatalog = z.object({
  agents: z.array(
    z.object({
      agent: zAgentDef,
      available: z.boolean(),
      unavailableReason: nullableString,
      setup: zSetup,
      installed: z.object({ installId: z.string(), state: z.string(), version: z.number(), upgradeAvailable: z.boolean() }).nullable(),
    }),
  ),
});
export type CatalogEntry = z.infer<typeof zCatalog>["agents"][number];

const zTool = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  risk: z.string(),
  platformMode: z.string(),
  granted: z.boolean(),
  required: z.boolean(),
  connected: z.boolean(),
});
export type AgentTool = z.infer<typeof zTool>;
const zAssignment = z.object({ installId: z.string(), conversationId: z.string(), activation: z.enum(["mention", "command", "explicit"]), addedBy: z.string(), addedAt: z.number() });
export type Assignment = z.infer<typeof zAssignment>;
const zAgentDetail = z.object({
  agent: zInstall,
  definition: zAgentDef.nullable(),
  upgrade: z.object({ version: z.number() }).nullable(),
  setup: zSetup.nullable(),
  channels: z.array(zAssignment),
  tools: z.array(zTool),
  permissions: zPerms,
});
export type AgentDetail = z.infer<typeof zAgentDetail>;

export const zFile = z.object({
  id: z.string(),
  role: z.string(),
  jobId: nullableString,
  kind: nullableString,
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  sha256: z.string(),
  version: z.number(),
  supersedes: nullableString,
  approvalState: z.string(),
  createdAt: z.number(),
});
export type AiFile = z.infer<typeof zFile>;

const zJobSummary = z.object({
  id: z.string(),
  agent: z.object({ installId: z.string(), agentId: z.string(), version: z.number(), displayName: z.string(), badge: z.string() }),
  skillId: z.string(),
  state: z.enum(["queued", "planning", "running", "awaiting_input", "awaiting_approval", "completed", "failed", "cancelled"]),
  progress: z.number(),
  note: nullableString,
  requestedBy: z.string(),
  conversationId: nullableString,
  parentJobId: nullableString,
  depth: z.number(),
  revision: z.number(),
  attempts: z.number(),
  maxAttempts: z.number(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  updatedAt: z.number(),
});
export type JobSummary = z.infer<typeof zJobSummary>;
export const zApproval = z.object({
  id: z.string(),
  jobId: z.string(),
  action: z.string(),
  fileId: nullableString,
  fileSha256: nullableString,
  summary: z.string(),
  state: z.string(),
  requestedAt: z.number(),
  decidedBy: nullableString,
  decidedAt: z.number().nullable(),
  note: nullableString,
});
export type Approval = z.infer<typeof zApproval>;
const zJobDetail = zJobSummary.extend({
  input: z.unknown(),
  output: z.unknown(),
  files: z.array(zFile),
  /** How many channel messages were shared with the request (the server never returns them). */
  sharedMessages: z.number().default(0),
  approvals: z.array(zApproval),
  steps: z.array(zJobSummary),
  events: z.array(z.object({ at: z.number(), kind: z.string(), detail: z.record(z.unknown()) })),
});
export type JobDetail = z.infer<typeof zJobDetail>;

const zPost = z.object({
  id: z.string(),
  conversationId: z.string(),
  threadRoot: nullableString,
  kind: z.enum(["request", "ack", "progress", "result", "approval", "error"]),
  body: z.string(),
  jobId: nullableString,
  approvalId: nullableString,
  authorId: nullableString,
  agent: z.object({ installId: z.string(), displayName: z.string(), avatarColor: nullableString, hasAvatar: z.boolean(), skill: nullableString, badge: z.string() }),
  files: z.array(zFile),
  encrypted: z.literal(false),
  createdAt: z.number(),
});
export type AgentPost = z.infer<typeof zPost>;
const zChannelAgent = zInstall.extend({ activation: z.enum(["mention", "command", "explicit"]), canInvoke: z.boolean() });
export type ChannelAgent = z.infer<typeof zChannelAgent>;

export const JOB_STATE_LABEL: Record<JobSummary["state"], string> = {
  queued: "Queued",
  planning: "Planning",
  running: "Working",
  awaiting_input: "Needs your answer",
  awaiting_approval: "Waiting for approval",
  completed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};
export const ACTIVE_STATES = new Set<JobSummary["state"]>(["queued", "planning", "running", "awaiting_input", "awaiting_approval"]);

const base = (orgId: string) => `/v1/orgs/${enc(orgId)}/ai`;

export const aiOverview = (e: Engine, orgId: string) => e.api.json("GET", base(orgId), zOverview);
export const aiCatalog = async (e: Engine, orgId: string) => (await e.api.json("GET", `${base(orgId)}/catalog`, zCatalog)).agents;
export const installAgent = (e: Engine, orgId: string, agentId: string, displayName?: string) =>
  e.api.json("POST", `${base(orgId)}/agents`, z.object({ agent: zInstall }), { body: { agentId, ...(displayName ? { displayName } : {}) } });
export const agentDetail = (e: Engine, orgId: string, installId: string) => e.api.json("GET", `${base(orgId)}/agents/${enc(installId)}`, zAgentDetail);
export const updateAgent = (e: Engine, orgId: string, installId: string, patch: Record<string, unknown> & { rev: number }) =>
  e.api.json("PATCH", `${base(orgId)}/agents/${enc(installId)}`, z.object({ agent: zInstall }), { body: patch });
export const setAgentAvatar = (e: Engine, orgId: string, installId: string, bytes: Uint8Array) =>
  e.api.json("PUT", `${base(orgId)}/agents/${enc(installId)}/avatar`, z.object({ agent: zInstall }), { raw: bytes });
export const uninstallAgent = (e: Engine, orgId: string, installId: string) => e.api.call("DELETE", `${base(orgId)}/agents/${enc(installId)}`);
export const assignChannel = (e: Engine, orgId: string, installId: string, conversationId: string, activation: Assignment["activation"]) =>
  e.api.call("PUT", `${base(orgId)}/agents/${enc(installId)}/channels/${enc(conversationId)}`, { body: { activation } });
export const unassignChannel = (e: Engine, orgId: string, installId: string, conversationId: string) => e.api.call("DELETE", `${base(orgId)}/agents/${enc(installId)}/channels/${enc(conversationId)}`);

export async function uploadAgentFile(e: Engine, orgId: string, file: File): Promise<AiFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = file.type || guessType(file.name);
  return (await e.api.json("POST", `${base(orgId)}/files?name=${enc(file.name)}&type=${enc(type)}`, z.object({ file: zFile }), { raw: bytes })).file;
}

/** A type for files the browser didn't type (subtitles, code). Text formats are sent as plain text. */
export function guessType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    html: "text/html",
    htm: "text/html",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "text/plain";
}

export interface NewJob {
  installId: string;
  input: Record<string, unknown>;
  conversationId?: string | null;
  threadRoot?: string | null;
  fileIds?: string[];
  requestText?: string | null;
  /** Messages of [conversationId] this browser decrypted and the person chose to share ([messagesToShare]). */
  channelMessages?: SharedMessage[] | null;
}
export const createJob = async (e: Engine, orgId: string, job: NewJob) =>
  (await e.api.json("POST", `${base(orgId)}/jobs`, z.object({ job: zJobDetail }), { body: { ...job, idempotencyKey: crypto.randomUUID() } })).job;
export const listJobs = async (e: Engine, orgId: string, scope: "mine" | "all", before?: number) =>
  e.api.json("GET", `${base(orgId)}/jobs?scope=${scope}${before ? `&before=${before}` : ""}`, z.object({ jobs: z.array(zJobSummary), next: z.number().nullable() }));
export const jobDetail = async (e: Engine, orgId: string, jobId: string) => (await e.api.json("GET", `${base(orgId)}/jobs/${enc(jobId)}`, z.object({ job: zJobDetail }))).job;
// One literal path per action, so each call names its server route.
export const cancelJob = (e: Engine, orgId: string, jobId: string) => e.api.json("POST", `${base(orgId)}/jobs/${enc(jobId)}/cancel`, z.object({ job: zJobSummary }), { body: {} });
export const retryJob = (e: Engine, orgId: string, jobId: string) => e.api.json("POST", `${base(orgId)}/jobs/${enc(jobId)}/retry`, z.object({ job: zJobSummary }), { body: {} });
export const reviseJob = (e: Engine, orgId: string, jobId: string, note: string) => e.api.json("POST", `${base(orgId)}/jobs/${enc(jobId)}/revise`, z.object({ job: zJobSummary }), { body: { note } });
export const answerJob = (e: Engine, orgId: string, jobId: string, text: string) => e.api.json("POST", `${base(orgId)}/jobs/${enc(jobId)}/answer`, z.object({ job: zJobSummary }), { body: { text } });
export const decide = (e: Engine, orgId: string, approvalId: string, decision: "approved" | "rejected", note: string | null = null) =>
  e.api.json("POST", `${base(orgId)}/approvals/${enc(approvalId)}`, z.object({ job: zJobSummary }), { body: { decision, note } });
export const pendingApprovals = async (e: Engine, orgId: string) => (await e.api.json("GET", `${base(orgId)}/approvals`, z.object({ approvals: z.array(zApproval) }))).approvals;
export const deliverables = (e: Engine, orgId: string, before?: number) =>
  e.api.json("GET", `${base(orgId)}/deliverables${before ? `?before=${before}` : ""}`, z.object({ files: z.array(zFile), next: z.number().nullable() }));
const zNoPerms = { canUse: false, canManage: false, canApprove: false };
export const channelAgents = (e: Engine, conversationId: string) =>
  e.api.json("GET", `/v1/conversations/${enc(conversationId)}/ai/agents`, z.object({ agents: z.array(zChannelAgent), permissions: zPerms.default(zNoPerms) }));
export const channelPosts = async (e: Engine, conversationId: string) => (await e.api.json("GET", `/v1/conversations/${enc(conversationId)}/ai/posts`, z.object({ posts: z.array(zPost) }))).posts;

/** A file's bytes as a blob URL (the download needs the bearer token, so a plain link can't fetch it). */
export async function fileUrl(e: Engine, orgId: string, f: Pick<AiFile, "id" | "mime">): Promise<string> {
  const bytes = await e.api.bytes(`${base(orgId)}/files/${enc(f.id)}`);
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: f.mime }));
}

export async function avatarUrl(e: Engine, orgId: string, installId: string): Promise<string> {
  const bytes = await e.api.bytes(`${base(orgId)}/agents/${enc(installId)}/avatar`);
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
}

// ───────────── Operations: readiness, activity, test, triggers (server docs/AI_WORKFORCE.md §5b) ─────────────

export type Autonomy = Install["autonomy"];
export const AUTONOMY_LABEL: Record<Autonomy, { title: string; body: string }> = {
  manual: { title: "Manual", body: "Works only when a person asks it (Ask, @mention). The Agent Manager can't hand it work; no triggers. Results are reviewed." },
  assisted: { title: "Assisted", body: "People and the Agent Manager can ask it. It prepares results and people review them before they're delivered." },
  guarded: { title: "Guarded autonomous", body: "Delivers its own internal results without review, within its limits. Anything outside Meldiq still needs approval." },
  continuous: { title: "Continuous", body: "As guarded, and its triggers (schedules, webhooks, handoffs) start work with nobody present, within its active hours." },
};

const zCheck = z.object({ key: z.string(), label: z.string(), status: z.enum(["ok", "missing", "advice"]), detail: z.string(), fixBy: z.enum(["operator", "community"]).nullable() });
const zReadiness = z.object({ ready: z.boolean(), checks: z.array(zCheck) });
export type Readiness = z.infer<typeof zReadiness>;

const zTrigger = z.object({
  id: z.string(),
  installId: z.string(),
  kind: z.enum(["schedule", "webhook", "after_agent"]),
  enabled: z.boolean(),
  label: z.string(),
  brief: z.string(),
  conversationId: nullableString,
  config: z.unknown(),
  sourceInstallId: nullableString,
  runAs: z.string(),
  nextRunAt: z.number().nullable(),
  lastFiredAt: z.number().nullable(),
  lastJobId: nullableString,
  lastError: nullableString,
  failures: z.number(),
  rev: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Trigger = z.infer<typeof zTrigger>;

const zActivity = z.object({
  now: z.object({ running: z.number(), queued: z.number(), waiting: z.number() }),
  week: z.object({ completed: z.number(), failed: z.number(), cancelled: z.number(), averageMs: z.number().nullable(), retries: z.number() }),
  lastSuccessAt: z.number().nullable(),
  lastFailure: z.object({ at: z.number(), code: nullableString, message: z.string() }).nullable(),
  nextRunAt: z.number().nullable(),
  triggers: z.array(zTrigger),
});
export type Activity = z.infer<typeof zActivity>;

export interface NewTrigger {
  kind: Trigger["kind"];
  label: string;
  brief: string;
  conversationId: string | null;
  config?: Record<string, unknown>;
  sourceInstallId?: string | null;
}

const agentPath = (orgId: string, installId: string) => `${base(orgId)}/agents/${enc(installId)}`;
export const agentReadiness = async (e: Engine, orgId: string, installId: string) =>
  (await e.api.json("GET", `${agentPath(orgId, installId)}/readiness`, z.object({ readiness: zReadiness }))).readiness;
export const agentActivity = async (e: Engine, orgId: string, installId: string) => (await e.api.json("GET", `${agentPath(orgId, installId)}/activity`, z.object({ activity: zActivity }))).activity;
/** A real short request through the normal path; the job shows its outcome. */
export const testAgent = async (e: Engine, orgId: string, installId: string) => (await e.api.json("POST", `${agentPath(orgId, installId)}/test`, z.object({ job: zJobDetail }))).job;
export const agentTriggers = async (e: Engine, orgId: string, installId: string) =>
  (await e.api.json("GET", `${agentPath(orgId, installId)}/triggers`, z.object({ triggers: z.array(zTrigger) }))).triggers;
/** A webhook's secret comes back this once. */
export const addTrigger = (e: Engine, orgId: string, installId: string, t: NewTrigger) =>
  e.api.json("POST", `${agentPath(orgId, installId)}/triggers`, z.object({ trigger: zTrigger, secret: nullableString, hookUrl: nullableString }), { body: t });
export const updateTrigger = async (e: Engine, orgId: string, installId: string, triggerId: string, patch: Record<string, unknown> & { rev: number }) =>
  (await e.api.json("PATCH", `${agentPath(orgId, installId)}/triggers/${enc(triggerId)}`, z.object({ trigger: zTrigger }), { body: patch })).trigger;
export const removeTrigger = (e: Engine, orgId: string, installId: string, triggerId: string) => e.api.call("DELETE", `${agentPath(orgId, installId)}/triggers/${enc(triggerId)}`);
export const runTrigger = async (e: Engine, orgId: string, installId: string, triggerId: string) =>
  (await e.api.json("POST", `${agentPath(orgId, installId)}/triggers/${enc(triggerId)}/run`, z.object({ job: zJobDetail }))).job;

// ───────────── Tasks for people (server docs/AI_WORKFORCE_2_PLAN.md, phase 4) ─────────────

const zPerson = z.object({ id: z.string(), name: z.string() });
export const TASK_STATES = ["waiting", "open", "accepted", "in_progress", "blocked", "submitted", "done", "cancelled"] as const;
export type TaskState = (typeof TASK_STATES)[number];
export const TASK_STATE_LABEL: Record<TaskState, string> = {
  waiting: "Waiting for an agent",
  open: "New",
  accepted: "Accepted",
  in_progress: "In progress",
  blocked: "Blocked",
  submitted: "Handed in",
  done: "Done",
  cancelled: "Cancelled",
};
const zTaskSummary = z.object({
  id: z.string(),
  title: z.string(),
  state: z.enum(TASK_STATES),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  overdue: z.boolean(),
  dueAt: z.number().nullable(),
  assignee: zPerson,
  createdBy: zPerson,
  agent: z.object({ installId: z.string(), name: z.string() }).nullable(),
  jobId: nullableString,
  updatedAt: z.number(),
});
export type TaskSummary = z.infer<typeof zTaskSummary>;
const zTaskActions = z.object({
  accept: z.boolean(),
  start: z.boolean(),
  block: z.boolean(),
  submit: z.boolean(),
  approve: z.boolean(),
  return: z.boolean(),
  cancel: z.boolean(),
  reassign: z.boolean(),
});
export type TaskAction = keyof z.infer<typeof zTaskActions>;
const zTask = zTaskSummary.extend({
  instructions: z.string(),
  deliverables: z.string(),
  conversationId: nullableString,
  blockedReason: nullableString,
  submissionNote: nullableString,
  returnReason: nullableString,
  returns: z.number(),
  reminders: z.number(),
  escalatedAt: z.number().nullable(),
  cancelReason: nullableString,
  rev: z.number(),
  createdAt: z.number(),
  openedAt: z.number().nullable(),
  acceptedAt: z.number().nullable(),
  submittedAt: z.number().nullable(),
  doneAt: z.number().nullable(),
  doneBy: zPerson.nullable(),
  files: z.array(zFile),
  references: z.array(zFile),
  can: zTaskActions,
});
export type Task = z.infer<typeof zTask>;
const zTaskEvent = z.object({ at: z.number(), actor: zPerson.nullable(), kind: z.string(), detail: z.record(z.string(), z.unknown()) });
export type TaskEvent = z.infer<typeof zTaskEvent>;
const zTaskReport = z.object({
  byState: z.record(z.string(), z.number()),
  overdue: z.number(),
  byAssignee: z.array(z.object({ person: zPerson, active: z.number(), overdue: z.number() })),
});
export type TaskReport = z.infer<typeof zTaskReport>;
const zTaskSettings = z.object({
  roles: z.array(z.string()),
  users: z.array(z.string()),
  updatedAt: z.number().nullable(),
  eligible: z.array(z.object({ id: z.string(), name: z.string(), roles: z.array(z.string()) })),
});
export type TaskSettings = z.infer<typeof zTaskSettings>;

const tasksPath = (orgId: string) => `${base(orgId)}/tasks`;
export const listTasks = (e: Engine, orgId: string, scope: "mine" | "created" | "all", state?: TaskState) =>
  e.api.json("GET", `${tasksPath(orgId)}?scope=${scope}${state ? `&state=${state}` : ""}`, z.object({ tasks: z.array(zTaskSummary), next: z.number().nullable(), report: zTaskReport.nullable() }));
export const getTask = (e: Engine, orgId: string, taskId: string) => e.api.json("GET", `${tasksPath(orgId)}/${enc(taskId)}`, z.object({ task: zTask, events: z.array(zTaskEvent) }));
export interface NewTask {
  title: string;
  instructions: string;
  deliverables: string;
  assigneeId: string;
  dueAt: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  conversationId: string | null;
}
export const createTask = async (e: Engine, orgId: string, t: NewTask) => (await e.api.json("POST", tasksPath(orgId), z.object({ task: zTask }), { body: t })).task;
/** Any change: the version it was read at, and what that change needs (a reason, a note, files, a person). */
const zTaskAnswer = z.object({ task: zTask });
/** Any change: the version it was read at, and what that change needs. One call per route, spelled out, so the contract test can match each to the server's. */
export async function taskAction(
  e: Engine,
  orgId: string,
  task: Pick<Task, "id" | "rev">,
  action: TaskAction,
  body: { reason?: string; note?: string; fileIds?: string[]; assigneeId?: string } = {},
): Promise<Task> {
  const o = { body: { rev: task.rev, ...body } };
  const id = enc(task.id);
  switch (action) {
    case "accept":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/accept`, zTaskAnswer, o)).task;
    case "start":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/start`, zTaskAnswer, o)).task;
    case "block":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/block`, zTaskAnswer, o)).task;
    case "submit":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/submit`, zTaskAnswer, o)).task;
    case "approve":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/approve`, zTaskAnswer, o)).task;
    case "return":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/return`, zTaskAnswer, o)).task;
    case "cancel":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/cancel`, zTaskAnswer, o)).task;
    case "reassign":
      return (await e.api.json("POST", `${tasksPath(orgId)}/${id}/reassign`, zTaskAnswer, o)).task;
  }
}
export const taskSettings = async (e: Engine, orgId: string) => (await e.api.json("GET", `${tasksPath(orgId)}/settings`, z.object({ settings: zTaskSettings }))).settings;
export const setTaskSettings = async (e: Engine, orgId: string, roles: string[], users: string[]) =>
  (await e.api.json("PUT", `${tasksPath(orgId)}/settings`, z.object({ settings: zTaskSettings }), { body: { roles, users } })).settings;

// ───────────── Agents reading conversations (server docs/AI_WORKFORCE_2_PLAN.md phase 5) ─────────────

const zReaderView = z.object({
  readerId: z.string(),
  orgId: z.string(),
  installId: z.string(),
  agentUserId: z.string(),
  name: z.string(),
  conversationId: z.string(),
  conversationName: nullableString,
  mode: z.enum(["channel", "direct"]),
  state: z.enum(["on", "off"]),
  since: z.number(),
  turnedOnBy: z.object({ id: z.string(), name: z.string() }),
  reason: z.string(),
});
export type ReaderView = z.infer<typeof zReaderView>;
const zConversationReaders = z.object({ readingEnabled: z.boolean(), readers: z.array(zReaderView.extend({ myChoice: z.enum(["share", "keep"]).nullable() })) });
export type ConversationReaders = z.infer<typeof zConversationReaders>;

/** The agents reading [conversationId] and this person's choice for each (the same cache the send path uses). */
export async function conversationReaders(e: Engine, conversationId: string, force = false): Promise<ConversationReaders> {
  return zConversationReaders.parse(await e.directory.readerChoices(conversationId, force));
}
/** Share this person's messages here with a reader, or keep them out: their apps wrap to it, or don't. */
export async function chooseReader(e: Engine, conversationId: string, readerId: string, choice: "share" | "keep"): Promise<ConversationReaders> {
  const r = await e.api.json("PUT", `/v1/conversations/${enc(conversationId)}/ai/readers/${enc(readerId)}/choice`, zConversationReaders, { body: { choice } });
  e.directory.setReaderChoices(conversationId, r);
  return r;
}
export const installReaders = (e: Engine, orgId: string, installId: string) =>
  e.api.json("GET", `${agentPath(orgId, installId)}/readers`, z.object({ readingEnabled: z.boolean(), readers: z.array(zReaderView) }));
export const turnOnReader = async (e: Engine, orgId: string, installId: string, conversationId: string, reason: string) =>
  (await e.api.json("POST", `${agentPath(orgId, installId)}/readers`, z.object({ reader: zReaderView }), { body: { conversationId, reason } })).reader;
export const readEverywhere = async (e: Engine, orgId: string, installId: string, scope: "assigned" | "all", reason: string) =>
  (await e.api.json("POST", `${agentPath(orgId, installId)}/read-scope`, z.object({ readers: z.array(zReaderView) }), { body: { scope, reason } })).readers;
export const turnOffReader = async (e: Engine, orgId: string, installId: string, readerId: string, reason: string) =>
  (await e.api.json("POST", `${agentPath(orgId, installId)}/readers/${enc(readerId)}/off`, z.object({ reader: zReaderView }), { body: { reason } })).reader;
/** The person's direct conversation with an agent (created on first use). */
export async function directConversation(e: Engine, orgId: string, installId: string): Promise<string> {
  const { conversationId } = await e.api.json("POST", `${agentPath(orgId, installId)}/direct`, z.object({ conversationId: z.string(), reader: zReaderView }));
  await e.ensureConversation(conversationId);
  return conversationId;
}
