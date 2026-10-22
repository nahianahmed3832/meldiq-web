import { type Call, zCall } from "../api/schemas";

/**
 * The realtime protocol on /v1/ws (server docs/api/realtime.schema.json), in one place: frames are read from the
 * socket's text (readFrame), the ones the engine acts on are checked and typed (parseFrame), and what this browser
 * sends is typed to the schema's ClientEvent (ClientFrame, writeFrame). Unknown frame names and extra fields are
 * ignored, as the contract asks.
 */

/** Any frame as it arrives: a JSON object with a string `t`. */
export interface Frame {
  t: string;
  [key: string]: unknown;
}

/** What this browser sends (ClientEvent): sign-in first, then pings, acknowledgements and typing. */
export type ClientFrame = { t: "auth"; token: string } | { t: "ping" } | { t: "ack"; ids: number[]; backlog?: boolean } | { t: "typing"; c: string; on: boolean };

const MAX_FRAME_CHARS = 4 * 1024 * 1024;

/** A frame from the socket's text, or null for anything that isn't one (too large, not JSON, no `t`). */
export function readFrame(data: unknown): Frame | null {
  if (typeof data !== "string" || data.length > MAX_FRAME_CHARS) return null;
  try {
    const f = JSON.parse(data) as unknown;
    return f && typeof f === "object" && !Array.isArray(f) && typeof (f as Frame).t === "string" ? (f as Frame) : null;
  } catch {
    return null;
  }
}

/** The text of a frame this browser sends: only the fields the schema allows. */
export function writeFrame(f: ClientFrame): string {
  switch (f.t) {
    case "auth":
      return JSON.stringify({ t: f.t, token: f.token });
    case "ping":
      return JSON.stringify({ t: f.t });
    case "ack":
      return JSON.stringify(f.backlog === undefined ? { t: f.t, ids: f.ids } : { t: f.t, ids: f.ids, backlog: f.backlog });
    case "typing":
      return JSON.stringify({ t: f.t, c: f.c, on: f.on });
  }
}

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
  | { t: "meeting.updated" }
  | { t: "meeting.soon"; meetingId: string | null }
  | { t: "reminders.changed" | "reminder.due" }
  | { t: "prefs.updated"; workspaceId: string }
  | { t: "org.deleted"; orgId: string }
  | { t: "devices.changed"; userId: string }
  | { t: "call"; call: Call; event: string | null; extra: { from?: { displayName?: unknown }; reason?: unknown; action?: unknown } }
  | { t: "queue.drained" };

/** Frame names the engine handles. Others (pong, which the socket answers, org.alert, frames of retired modules such as inbox.* and integration.event, …) are ignored, as the contract asks. */
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
  "meeting.updated",
  "meeting.soon",
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

/** The frame as the engine acts on it, or null when it's one to ignore: unknown, or missing what it needs. */
export function parseFrame(f: Frame): ServerFrame | null {
  const t = f.t;
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
    case "conv.updated": {
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
