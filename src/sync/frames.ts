import { type Call, zCall } from "../api/schemas";
import type { Frame } from "../realtime/socket";
import { INBOX_FRAMES } from "./inbox";

type InboxFrame = "inbox.updated" | "inbox.escalated" | "inbox.overdue" | "inbox.delivery_failed" | "inbox.account_failed";

/** A server frame the engine acts on, with the fields it needs checked (docs/api/realtime.schema.json on the server). */
export type ServerFrame =
  | { t: "hello" }
  | { t: "queue"; items: unknown[]; backlog: boolean }
  | { t: "typing"; c: string; u: string; on: boolean }
  | { t: "presence"; userId: string; online: boolean; presence: string | null }
  | { t: "connections.updated" }
  | { t: "conv.updated"; conversationId: string }
  | { t: "org.updated" }
  | { t: "org.applications" | "org.application" | "org.reports" }
  | { t: "integration.event"; conversationId: string }
  | { t: "meeting.updated" }
  | { t: "meeting.soon"; meetingId: string | null }
  | { t: InboxFrame; conversationId: string | null }
  | { t: "reminders.changed" | "reminder.due" }
  | { t: "prefs.updated"; workspaceId: string }
  | { t: "org.deleted"; orgId: string }
  | { t: "devices.changed"; userId: string }
  | { t: "call"; call: Call; event: string | null; extra: { from?: { displayName?: unknown }; reason?: unknown; action?: unknown } }
  | { t: "queue.drained" };

/** Frame names the engine handles. Others (pong, which the socket answers, org.alert, …) are ignored, as the contract asks. */
export const HANDLED_FRAMES: ReadonlySet<string> = new Set<ServerFrame["t"]>([
  "hello",
  "queue",
  "typing",
  "presence",
  "connections.updated",
  "conv.updated",
  "org.updated",
  "org.applications",
  "org.application",
  "org.reports",
  "integration.event",
  "meeting.updated",
  "meeting.soon",
  ...(INBOX_FRAMES as readonly InboxFrame[]),
  "reminders.changed",
  "reminder.due",
  "prefs.updated",
  "org.deleted",
  "devices.changed",
  "call",
  "queue.drained",
]);

/** An id-like string field: present, non-empty and short. */
export function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= 128 ? v : null;
}

function isInbox(t: string): t is InboxFrame {
  return (INBOX_FRAMES as readonly string[]).includes(t);
}

/** The frame as the engine acts on it, or null when it's one to ignore: unknown, or missing what it needs. */
export function parseFrame(f: Frame): ServerFrame | null {
  const t = f.t;
  if (isInbox(t)) return { t, conversationId: str(f.conversationId) };
  switch (t) {
    case "hello":
    case "connections.updated":
    case "org.updated":
    case "org.applications":
    case "org.application":
    case "org.reports":
    case "meeting.updated":
    case "reminders.changed":
    case "reminder.due":
    case "queue.drained":
      return { t };
    case "queue":
      return { t, items: Array.isArray(f.items) ? (f.items as unknown[]) : [], backlog: f.backlog === true };
    case "typing": {
      const c = str(f.c);
      const u = str(f.u);
      return c && u ? { t, c, u, on: f.on === true } : null;
    }
    case "presence": {
      const userId = str(f.userId);
      return userId ? { t, userId, online: f.online === true, presence: typeof f.presence === "string" ? f.presence : null } : null;
    }
    case "conv.updated":
    case "integration.event": {
      const conversationId = str(f.conversationId);
      return conversationId ? { t, conversationId } : null;
    }
    case "meeting.soon":
      return { t, meetingId: typeof f.meetingId === "string" ? f.meetingId : null };
    case "prefs.updated": {
      const workspaceId = str(f.workspaceId);
      return workspaceId ? { t, workspaceId } : null;
    }
    case "org.deleted": {
      const orgId = str(f.orgId);
      return orgId ? { t, orgId } : null;
    }
    case "devices.changed": {
      const userId = str(f.userId);
      return userId ? { t, userId } : null;
    }
    case "call": {
      const parsed = zCall.safeParse(f.call);
      return parsed.success
        ? { t, call: parsed.data, event: typeof f.event === "string" ? f.event : null, extra: f as { from?: { displayName?: unknown }; reason?: unknown; action?: unknown } }
        : null;
    }
    default:
      return null;
  }
}
