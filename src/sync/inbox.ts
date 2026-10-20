import { z } from "zod";
import type { Engine } from "./engine";

/**
 * The Unified Inbox (server docs/UNIFIED_INBOX.md, android round 8): customer conversations from a workspace's connected
 * Messenger, Instagram and WhatsApp business accounts. These messages are NOT end-to-end encrypted: the provider
 * delivers them to the server, which keeps them sealed at rest; the screens say so. Every rule is the server's; the
 * ones below are the phone's InboxRules, for what the screens offer before asking.
 */
const enc = encodeURIComponent;

export const VIEWS = ["all", "unassigned", "mine", "waiting_agent", "waiting_customer", "ai", "resolved"] as const;
export type InboxView = (typeof VIEWS)[number];
export const PROVIDERS = ["messenger", "instagram", "whatsapp", "tiktok"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const AI_MODES = ["off", "draft", "auto"] as const;
export const AUTO_INTENTS = ["greeting", "opening_hours", "product_question", "order_status_question", "shipping_question", "general_question"] as const;

export const VIEW_LABEL: Record<InboxView, string> = {
  all: "Open",
  unassigned: "Unassigned",
  mine: "Mine",
  waiting_agent: "Waiting for us",
  waiting_customer: "Waiting for customer",
  ai: "AI",
  resolved: "Resolved",
};
export const STATUS_LABEL: Record<string, string> = { waiting_agent: "Waiting for us", waiting_customer: "Waiting for customer", resolved: "Resolved" };
export const PRIORITY_LABEL: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const HANDLING_LABEL: Record<string, string> = { human: "Person", ai_draft: "AI drafts", ai_auto: "AI replies", awaiting_review: "Awaiting review", escalated: "Needs a person" };
export const AI_MODE_LABEL: Record<string, string> = { off: "Off", draft: "Drafts for review", auto: "Automatic replies" };
export const INTENT_LABEL: Record<string, string> = {
  greeting: "Greetings",
  opening_hours: "Opening hours",
  product_question: "Product questions",
  order_status_question: "Order status",
  shipping_question: "Shipping",
  general_question: "General questions",
};
export const DELIVERY_LABEL: Record<string, string> = { queued: "Sending", sent: "Sent", delivered: "Delivered", read: "Read" };
export const CLOSED_TEXT: Record<string, string> = {
  window_closed: "The reply window has closed. The customer has to write again first.",
  template_required: "More than 24 hours have passed: WhatsApp only allows an approved template now.",
  no_customer_message: "The customer hasn't written yet.",
  unsupported: "Replies aren't supported for this account yet.",
};
/** Events the server sends with ids only; these become a notice (android InboxNotifier). */
export const NOTICE_TEXT: Record<string, string> = {
  "inbox.escalated": "A customer conversation needs a person",
  "inbox.overdue": "A customer is waiting for a reply",
  "inbox.delivery_failed": "A reply to a customer wasn't delivered",
  "inbox.account_failed": "A connected business account needs attention",
};
export const INBOX_FRAMES = ["inbox.updated", ...Object.keys(NOTICE_TEXT)] as const;
const MAX_TAGS = 10;
const TAG_CHARS = 30;
const HOUR_MS = 3_600_000;

// ───────────── Schemas ─────────────

const zProvider = z.object({
  id: z.string(),
  name: z.string(),
  /** ready | needs_configuration | awaiting_access */
  state: z.string(),
  missing: z.array(z.string()).default([]),
  eligibility: z.string().default(""),
  outbound: z.array(z.string()).default([]),
  templates: z.boolean().default(false),
  textLimit: z.number().default(0),
  webhookUrl: z.string().nullable().optional(),
});
export type InboxProvider = z.infer<typeof zProvider>;

const zAccount = z.object({
  id: z.string(),
  provider: z.string(),
  providerName: z.string(),
  externalId: z.string(),
  name: z.string(),
  number: z.string().nullable().optional(),
  status: z.string(),
  lastError: z.string().nullable().optional(),
  lastEventAt: z.number().nullable().optional(),
  tokenExpiresAt: z.number().nullable().optional(),
  createdAt: z.number().default(0),
});
export type InboxAccount = z.infer<typeof zAccount>;

const zQueue = z.object({ id: z.string(), name: z.string(), memberIds: z.array(z.string()).default([]) });
export type InboxQueue = z.infer<typeof zQueue>;
const zAgent = z.object({ id: z.string(), name: z.string(), canReply: z.boolean().default(false) });
export type InboxAgent = z.infer<typeof zAgent>;

const zSettings = z.object({
  aiMode: z.string().default("off"),
  knowledgeDocumentIds: z.array(z.string()).default([]),
  autoIntents: z.array(z.string()).default([]),
  autoMinConfidence: z.number().default(80),
  autoMaxPerConversationPerHour: z.number().default(3),
  autoFallback: z.string().default(""),
  autoPaused: z.boolean().default(false),
  responseTargetMinutes: z.number().default(60),
  retentionDays: z.number().default(0),
  defaultQueueId: z.string().nullable().default(null),
});
export type InboxSettings = z.infer<typeof zSettings>;

const zConversation = z.object({
  id: z.string(),
  orgId: z.string().default(""),
  provider: z.string(),
  account: z.object({ id: z.string(), name: z.string(), status: z.string() }),
  customer: z.object({ id: z.string(), name: z.string().nullable().optional(), handle: z.string().nullable().optional() }),
  status: z.string(),
  priority: z.string().default("normal"),
  assigneeId: z.string().nullable().default(null),
  queueId: z.string().nullable().default(null),
  handling: z.string().default("human"),
  escalationReason: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  unread: z.number().default(0),
  preview: z.string().default(""),
  lastMessageAt: z.number().default(0),
  lastInboundAt: z.number().nullable().optional(),
  overdue: z.boolean().default(false),
  rev: z.number(),
});
export type InboxConversation = z.infer<typeof zConversation>;

const zMessage = z.object({
  id: z.string(),
  /** in | out | note (a note is internal: never sent to the customer) */
  direction: z.string(),
  kind: z.string().default("text"),
  text: z.string().nullable().optional(),
  attachments: z.array(z.object({ n: z.number(), type: z.string(), mime: z.string().nullable().optional() })).default([]),
  authorId: z.string().nullable().optional(),
  /** human | ai_auto | ai_draft */
  origin: z.string().default("human"),
  status: z.string().default("received"),
  errorKind: z.string().nullable().optional(),
  at: z.number().default(0),
});
export type InboxMessage = z.infer<typeof zMessage>;

const zDetail = z.object({
  conversation: zConversation,
  messages: z.array(zMessage),
  reply: z.object({
    rule: z.object({ allowed: z.boolean(), mode: z.string().nullable().optional(), reason: z.string().nullable().optional() }),
    canReply: z.boolean().default(false),
    templates: z.boolean().default(false),
    textLimit: z.number().default(0),
    windowEndsAt: z.number().nullable().optional(),
  }),
});
export type InboxDetail = z.infer<typeof zDetail>;

const zList = z.object({
  conversations: z.array(zConversation),
  next: z.number().nullable().default(null),
  counts: z
    .object({ open: z.number().default(0), unassigned: z.number().default(0), mine: z.number().default(0), escalated: z.number().default(0) })
    .default({ open: 0, unassigned: 0, mine: 0, escalated: 0 }),
});
export type InboxList = z.infer<typeof zList>;

const zReport = z.object({
  days: z.number(),
  conversations: z.object({ started: z.number(), resolved: z.number(), open: z.number(), unassigned: z.number() }),
  messages: z.object({ received: z.number(), sentByPeople: z.number(), sentAutomatically: z.number(), sentFromAiDrafts: z.number().default(0), failed: z.number() }),
  times: z.object({ medianFirstResponseMs: z.number().nullable(), medianResolutionMs: z.number().nullable() }),
  escalations: z.number().default(0),
});
export type InboxReport = z.infer<typeof zReport>;

const zTemplate = z.object({ name: z.string(), language: z.string(), category: z.string().nullable().optional() });
export type InboxTemplate = z.infer<typeof zTemplate>;
const zAnswer = z.object({ text: z.string(), provider: z.object({ id: z.string(), name: z.string() }) });
export type InboxAnswer = z.infer<typeof zAnswer>;

// ───────────── Setup (inbox admins; the server checks `inbox.manage`) ─────────────

export async function inboxProviders(engine: Engine, orgId: string): Promise<InboxProvider[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/providers`, z.object({ providers: z.array(zProvider) }))).providers;
}
export async function inboxAccounts(engine: Engine, orgId: string): Promise<InboxAccount[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/accounts`, z.object({ accounts: z.array(zAccount) }))).accounts;
}
/** [token]: the business's API token from Meta, never a password. The server checks it with Meta and stores it sealed. */
export async function connectInboxAccount(engine: Engine, orgId: string, input: { provider: string; externalId: string; token: string; businessAccountId?: string }): Promise<InboxAccount> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/inbox/accounts`, z.object({ account: zAccount }), { body: input })).account;
}
export async function disconnectInboxAccount(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/inbox/accounts/${enc(id)}`);
}
export async function checkInboxAccount(engine: Engine, orgId: string, id: string): Promise<InboxAccount> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/inbox/accounts/${enc(id)}/check`, z.object({ account: zAccount }), { body: {} })).account;
}
export async function inboxTemplates(engine: Engine, orgId: string, accountId: string): Promise<InboxTemplate[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/accounts/${enc(accountId)}/templates`, z.object({ templates: z.array(zTemplate) }))).templates;
}
export async function inboxAgents(engine: Engine, orgId: string): Promise<InboxAgent[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/agents`, z.object({ agents: z.array(zAgent) }))).agents;
}
export async function inboxQueues(engine: Engine, orgId: string): Promise<InboxQueue[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/queues`, z.object({ queues: z.array(zQueue) }))).queues;
}
export async function createInboxQueue(engine: Engine, orgId: string, name: string, memberIds: string[]): Promise<void> {
  await engine.api.call("POST", `/v1/orgs/${enc(orgId)}/inbox/queues`, { body: { name, memberIds } });
}
export async function inboxSettings(engine: Engine, orgId: string): Promise<{ settings: InboxSettings; canManage: boolean }> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/settings`, z.object({ settings: zSettings, canManage: z.boolean().default(false) }));
}
export async function saveInboxSettings(engine: Engine, orgId: string, settings: InboxSettings): Promise<InboxSettings> {
  return (await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/inbox/settings`, z.object({ settings: zSettings }), { body: settings })).settings;
}
export async function inboxReport(engine: Engine, orgId: string, days: number): Promise<InboxReport> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/report?days=${days}`, z.object({ report: zReport }))).report;
}

// ───────────── Conversations ─────────────

export async function inboxConversations(engine: Engine, orgId: string, f: { view: InboxView; provider?: string | null; q?: string }): Promise<InboxList> {
  const p = new URLSearchParams({ view: f.view });
  if (f.provider) p.set("provider", f.provider);
  if (f.q?.trim()) p.set("q", f.q.trim().slice(0, 100));
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/inbox/conversations?${p}`, zList);
}
export async function inboxConversation(engine: Engine, id: string): Promise<InboxDetail> {
  return engine.api.json("GET", `/v1/inbox/conversations/${enc(id)}`, zDetail);
}
export async function markInboxRead(engine: Engine, id: string): Promise<void> {
  await engine.api.call("POST", `/v1/inbox/conversations/${enc(id)}/read`, { body: {} });
}
/** A change on the conversation's revision: someone else's change meanwhile is refused (409), never overwritten. "" clears. */
export async function updateInboxConversation(
  engine: Engine,
  id: string,
  rev: number,
  change: { assigneeId?: string; queueId?: string; status?: string; priority?: string; tags?: string[]; handling?: string },
): Promise<InboxConversation> {
  return (await engine.api.json("PATCH", `/v1/inbox/conversations/${enc(id)}`, z.object({ conversation: zConversation }), { body: { rev, ...change } })).conversation;
}
export async function claimInboxConversation(engine: Engine, id: string): Promise<void> {
  await engine.api.call("POST", `/v1/inbox/conversations/${enc(id)}/claim`, { body: {} });
}
export async function handoffInboxConversation(engine: Engine, id: string): Promise<void> {
  await engine.api.call("POST", `/v1/inbox/conversations/${enc(id)}/handoff`, { body: {} });
}
/** An internal note: the team sees it; it's never sent to the customer or to an AI provider. */
export async function addInboxNote(engine: Engine, id: string, text: string): Promise<InboxMessage> {
  return (await engine.api.json("POST", `/v1/inbox/conversations/${enc(id)}/notes`, z.object({ message: zMessage }), { body: { text } })).message;
}
/** [fromAiDraft]: the person reviewed an AI suggestion and is sending it (counted apart in reports). */
export async function sendInboxReply(engine: Engine, id: string, text: string, fromAiDraft: boolean): Promise<InboxMessage> {
  return (await engine.api.json("POST", `/v1/inbox/conversations/${enc(id)}/replies`, z.object({ message: zMessage }), { body: { kind: "text", text, fromAiDraft } })).message;
}
export async function sendInboxTemplate(engine: Engine, id: string, t: InboxTemplate): Promise<InboxMessage> {
  return (await engine.api.json("POST", `/v1/inbox/conversations/${enc(id)}/replies`, z.object({ message: zMessage }), { body: { kind: "template", name: t.name, language: t.language } })).message;
}
/** Erases the customer's data from this workspace (inbox admins; audited). Messages already at Meta aren't affected. */
export async function eraseInboxCustomer(engine: Engine, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/inbox/conversations/${enc(id)}`);
}
/** A file the customer sent, fetched from the provider when asked; it's never copied to Meldiq's storage. */
export async function inboxAttachment(engine: Engine, messageId: string, n: number): Promise<Uint8Array> {
  return engine.api.bytes(`/v1/inbox/messages/${enc(messageId)}/attachments/${n}`);
}
/** The conversation (never the notes) goes to the workspace's AI provider; this call is the person's consent. */
export async function inboxAiDraft(engine: Engine, id: string): Promise<InboxAnswer> {
  return (await engine.api.json("POST", `/v1/inbox/conversations/${enc(id)}/ai/draft`, z.object({ result: zAnswer }), { body: { consent: true } })).result;
}
export async function inboxAiSummary(engine: Engine, id: string): Promise<InboxAnswer> {
  return (await engine.api.json("POST", `/v1/inbox/conversations/${enc(id)}/ai/summary`, z.object({ result: zAnswer }), { body: { consent: true } })).result;
}

// ───────────── Rules (android InboxRules) ─────────────

export function providerBadge(p: string): string {
  return { messenger: "Messenger", instagram: "Instagram", whatsapp: "WhatsApp", tiktok: "TikTok" }[p] ?? p;
}

/** A customer's label: only what the provider supplied (a name, a WhatsApp number), else a neutral word. */
export function customerLabel(c: Pick<InboxConversation, "customer">): string {
  return c.customer.name?.trim() || c.customer.handle || "Customer";
}

export type ComposerState = { kind: "text" } | { kind: "template_only" } | { kind: "closed"; reason: string } | { kind: "no_permission" };

/** What the composer can do now. */
export function composerState(d: InboxDetail): ComposerState {
  if (!d.reply.canReply) return { kind: "no_permission" };
  if (d.reply.rule.allowed) return { kind: "text" };
  if (d.reply.rule.reason === "template_required" && d.reply.templates) return { kind: "template_only" };
  return { kind: "closed", reason: d.reply.rule.reason ?? "unsupported" };
}

/** Whole hours left in the free reply window, or null when it's closed or unknown. */
export function hoursLeft(windowEndsAt: number | null | undefined, nowMs: number): number | null {
  if (windowEndsAt == null) return null;
  const left = windowEndsAt - nowMs;
  return left <= 0 ? null : Math.ceil(left / HOUR_MS);
}

/** Fits the provider's limit (Instagram counts UTF-8 bytes; the others count characters). */
export function fits(provider: string, text: string, limit: number): boolean {
  if (limit <= 0) return true;
  const size = provider === "instagram" ? new TextEncoder().encode(text).length : [...text].length;
  return size <= limit;
}

/** Tags typed as "a, b, c": trimmed, lowercased, unique, at most 10 of up to 30 characters. */
export function parseTags(input: string): string[] {
  const tags = input
    .split(",")
    .map((t) => t.trim().toLowerCase().slice(0, TAG_CHARS))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

export function minutesLabel(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
