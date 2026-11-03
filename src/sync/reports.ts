import { text as uiText } from "../i18n";
import { z } from "zod";
import { openEnum } from "../api/enums";
import type { Engine } from "./engine";
/**
 * Reports (batch B4, server routes/reports.ts; android ReportRules.kt). Messages are end-to-end encrypted, so a report
 * carries only what the reporter's browser shows them on the review step: the reported message, its attachments' names
 * and sizes, and up to [REPORT_CONTEXT] messages before it. The server seals it; moderators never see who reported.
 */
export const REPORT_REASONS = ["spam", "harassment", "harmful", "private_info", "illegal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_CONTEXT = 5;
export const REPORT_NOTE_MAX = 500;
const TEXT_MAX = 4000;
const CONTEXT_TEXT_MAX = 2000;
export const REASON_LABEL: Record<ReportReason, string> = {
  get spam() {
    return uiText("workspace.interface.spam_94a9eac");
  },
  get harassment() {
    return uiText("workspace.interface.harassment_or_bullying_56dc2b3");
  },
  get harmful() {
    return uiText("workspace.interface.violence_or_harmful_misinformation_0bde928");
  },
  get private_info() {
    return uiText("workspace.interface.sharing_private_information_aa1a9b1");
  },
  get illegal() {
    return uiText("workspace.interface.illegal_content_641a0f4");
  },
  get other() {
    return uiText("workspace.interface.something_else_cc72843");
  },
};
export interface ReportLine {
  id: string;
  senderUserId: string;
  text: string;
  sentAt: number;
  attachments?: {
    name: string;
    size: number | null;
    sha256: string | null;
  }[];
}
export interface ReportContent {
  text?: string | null;
  sentAt?: number | null;
  attachments?:
    | {
        name: string;
        size: number | null;
        sha256: string | null;
      }[]
    | null;
  context?:
    | {
        senderUserId: string;
        text: string;
        sentAt: number;
      }[]
    | null;
}
/** The shared content for reporting [target]: its text and attachments, and the messages just before it (text only). */
export function reportContent(target: ReportLine, conversation: readonly ReportLine[]): ReportContent {
  const ordered = [...conversation].sort((a, b) => a.sentAt - b.sentAt);
  const i = ordered.findIndex((l) => l.id === target.id);
  const before = i > 0 ? ordered.slice(Math.max(0, i - REPORT_CONTEXT), i) : [];
  const context = before.filter((l) => l.text.trim()).map((l) => ({ senderUserId: l.senderUserId, text: l.text.slice(0, CONTEXT_TEXT_MAX), sentAt: l.sentAt }));
  const attachments = (target.attachments ?? []).slice(0, 10).map((a) => ({ name: a.name.slice(0, 200), size: a.size, sha256: a.sha256 ? a.sha256.slice(0, 128) : null }));
  return {
    text: target.text.slice(0, TEXT_MAX) || null,
    sentAt: target.sentAt,
    attachments: attachments.length ? attachments : null,
    context: context.length ? context : null,
  };
}
/** Who will read a report, as the review step says it: the community's moderators (true), or Meldiq's team. */
export function goesToCommunity(reason: ReportReason, conversationType: string | null, personInCommunity: boolean): boolean {
  if (reason === "illegal") return false;
  if (conversationType !== null) return conversationType === "CHANNEL";
  return personInCommunity;
}
const zSent = z.object({ report: z.object({ id: z.string(), status: z.string(), to: openEnum(["community", "meldiq"]), repeated: z.boolean().default(false) }) });
export type SentReport = z.infer<typeof zSent>["report"];
export async function sendReport(
  engine: Engine,
  r: {
    targetUserId: string;
    reason: ReportReason;
    note?: string;
    conversationId?: string;
    messageId?: string;
    orgId?: string;
    content?: ReportContent;
  },
): Promise<SentReport> {
  const body = { ...r, note: r.note?.trim() || undefined };
  return (await engine.api.json("POST", "/v1/reports", zSent, { body })).report;
}
const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const zPerson = z
  .object({ id: z.string(), username: nullableString, displayName: nullableString })
  .nullish()
  .transform((v) => v ?? null);
export const zReport = z.object({
  id: z.string(),
  orgId: nullableString,
  reason: z.string(),
  note: nullableString,
  status: openEnum(["open", "actioned", "dismissed"]),
  createdAt: z.number(),
  handledAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  handledBy: zPerson,
  handledNote: nullableString,
  target: zPerson,
  conversationId: nullableString,
  conversationName: nullableString,
  messageId: nullableString,
  content: z
    .object({
      text: nullableString,
      sentAt: z.number().nullish(),
      attachments: z.array(z.object({ name: z.string(), size: z.number().nullish(), sha256: nullableString })).nullish(),
      context: z.array(z.object({ senderUserId: z.string(), text: z.string(), sentAt: z.number() })).nullish(),
    })
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
});
export type ModeratorReport = z.infer<typeof zReport>;
const zReports = z.object({ reports: z.array(zReport), open: z.number().int().default(0), nextBefore: z.number().nullish() });
const enc = encodeURIComponent;
export async function communityReports(engine: Engine, orgId: string, status: "open" | "closed", before?: number | null) {
  const q = new URLSearchParams({ status });
  if (before) q.set("before", String(before));
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/reports?${q}`, zReports);
}
export async function setReportStatus(engine: Engine, id: string, status: "open" | "actioned" | "dismissed", note: string | null): Promise<ModeratorReport> {
  return (await engine.api.json("PATCH", `/v1/reports/${enc(id)}`, z.object({ report: zReport }), { body: { status, ...(note?.trim() ? { note: note.trim() } : {}) } })).report;
}
/** Security actions' pauses (android SecurityRules): 1 hour, 6 hours, 24 hours, 7 days (the server allows at most 7 days). */
export const PAUSE_CHOICES: {
  label: string;
  ms: number;
}[] = [
  {
    get label() {
      return uiText("workspace.interface.1_hour_f8b8883");
    },
    ms: 3600000,
  },
  {
    get label() {
      return uiText("organization.interface.6_hours_4105ae3");
    },
    ms: 6 * 3600000,
  },
  {
    get label() {
      return uiText("workspace.interface.24_hours_f0514e8");
    },
    ms: 24 * 3600000,
  },
  {
    get label() {
      return uiText("workspace.interface.7_days_7f920bb");
    },
    ms: 7 * 24 * 3600000,
  },
];
/** Timeouts (MOD-06, android TimeoutRules): 60 seconds to a week. */
export const TIMEOUT_CHOICES: {
  label: string;
  ms: number;
}[] = [
  {
    get label() {
      return uiText("workspace.interface.60_seconds_03d25c3");
    },
    ms: 60000,
  },
  {
    get label() {
      return uiText("organization.interface.5_minutes_3170543");
    },
    ms: 5 * 60000,
  },
  {
    get label() {
      return uiText("workspace.interface.10_minutes_b075b6e");
    },
    ms: 10 * 60000,
  },
  {
    get label() {
      return uiText("workspace.interface.1_hour_f8b8883");
    },
    ms: 3600000,
  },
  {
    get label() {
      return uiText("workspace.interface.1_day_fa665d9");
    },
    ms: 24 * 3600000,
  },
  {
    get label() {
      return uiText("workspace.interface.1_week_c8cc522");
    },
    ms: 7 * 24 * 3600000,
  },
];
export const running = (until: number | null | undefined, now: number = Date.now()): boolean => until != null && until > now;
/** Audit log filters (batch B4, android AuditFilters): the server matches an action and anything under it. */
export const AUDIT_FILTERS: {
  action: string | null;
  label: string;
}[] = [
  {
    action: null,
    get label() {
      return uiText("settings.ap_all");
    },
  },
  {
    action: "member",
    get label() {
      return uiText("workspace.members");
    },
  },
  {
    action: "channel",
    get label() {
      return uiText("organization.channels");
    },
  },
  {
    action: "category",
    get label() {
      return uiText("workspace.interface.categories_b8b1d89");
    },
  },
  {
    action: "role",
    get label() {
      return uiText("organization.roles");
    },
  },
  {
    action: "invite",
    get label() {
      return uiText("workspace.interface.invites_f212a98");
    },
  },
  {
    action: "community",
    get label() {
      return uiText("organization.community");
    },
  },
  {
    action: "report",
    get label() {
      return uiText("workspace.interface.reports_dacca3c");
    },
  },
];
