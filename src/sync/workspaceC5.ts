import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Workspace templates, user groups, guest end dates and scheduled meetings (server docs/WORKSPACE_C5.md, android round 7
 * slice C5). Every rule is the server's; these are its calls and the meeting editor's time rules (android MeetingRules).
 */
const enc = encodeURIComponent;

// ───────────── Templates ─────────────

const zWsTemplate = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  channels: z.array(z.object({ name: z.string(), topic: z.string().nullable().optional(), kind: z.string(), voice: z.boolean().optional() })),
});
export type WorkspaceTemplate = z.infer<typeof zWsTemplate>;

export async function workspaceTemplates(engine: Engine): Promise<WorkspaceTemplate[]> {
  return (await engine.api.json("GET", "/v1/workspace-templates", z.object({ templates: z.array(zWsTemplate) }))).templates;
}
/** Adds only what's missing (by channel name) and a welcome document; never people, apps or private channels. */
export async function applyWorkspaceTemplate(engine: Engine, orgId: string, templateId: string): Promise<{ channels: unknown[]; document: string | null }> {
  return (
    await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/apply-template`, z.object({ applied: z.object({ channels: z.array(z.unknown()), document: z.string().nullable() }) }), {
      body: { templateId },
    })
  ).applied;
}

// ───────────── Groups ─────────────

const zGroup = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string(),
  description: z.string().nullable(),
  members: z.array(z.object({ id: z.string(), name: z.string().nullable(), username: z.string() })),
  updatedAt: z.number(),
});
export type Group = z.infer<typeof zGroup>;
export interface GroupInput {
  name: string;
  description: string | null;
  memberIds: string[];
}

export async function listGroups(engine: Engine, orgId: string): Promise<Group[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/groups`, z.object({ groups: z.array(zGroup) }))).groups;
}
export async function createGroup(engine: Engine, orgId: string, input: GroupInput): Promise<Group> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/groups`, z.object({ group: zGroup }), { body: input })).group;
}
export async function updateGroup(engine: Engine, orgId: string, id: string, input: GroupInput): Promise<Group> {
  return (await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/groups/${enc(id)}`, z.object({ group: zGroup }), { body: input })).group;
}
export async function deleteGroup(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/orgs/${enc(orgId)}/groups/${enc(id)}`);
}
/** Adds the group's current members to a channel, each checked like adding them one by one; a group grants nothing itself. */
export async function addGroupToChannel(engine: Engine, conversationId: string, groupId: string): Promise<{ added: number; skipped: number }> {
  return engine.api.json("POST", `/v1/conversations/${enc(conversationId)}/add-group`, z.object({ added: z.number(), skipped: z.number() }), { body: { groupId } });
}

// ───────────── Guests ─────────────

export async function setGuestPolicy(engine: Engine, orgId: string, guestsAllowed: boolean, guestMaxDays: number | null): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/guest-policy`, { body: { guestsAllowed, guestMaxDays } });
}
/** A guest's end date (null: none, within the policy's maximum). */
export async function setGuestExpiry(engine: Engine, orgId: string, userId: string, expiresAt: number | null): Promise<void> {
  await engine.api.call("PUT", `/v1/orgs/${enc(orgId)}/members/${enc(userId)}/expiry`, { body: { expiresAt } });
}

// ───────────── Meetings ─────────────

export const RESPONSES = ["accepted", "tentative", "declined"] as const;
export type MeetingResponse = (typeof RESPONSES)[number];
export const RESPONSE_LABEL: Record<string, string> = { accepted: "Going", tentative: "Maybe", declined: "Not going", pending: "No answer yet" };
export const DURATIONS = [15, 30, 45, 60, 90] as const;

const zMeeting = z.object({
  id: z.string(),
  orgId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  room: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  startsAt: z.number(),
  endsAt: z.number(),
  timeZone: z.string(),
  organizer: z.object({ id: z.string(), name: z.string().nullable() }),
  participants: z.array(z.object({ id: z.string(), name: z.string().nullable(), response: z.string() })),
  myResponse: z.string().nullable(),
  cancelled: z.boolean(),
  canEdit: z.boolean(),
  rev: z.number(),
});
export type Meeting = z.infer<typeof zMeeting>;
export interface MeetingInput {
  roomId: string;
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number;
  timeZone: string;
  participantIds: string[];
  groupIds: string[];
}

export async function listMeetings(engine: Engine, orgId: string): Promise<Meeting[]> {
  return (await engine.api.json("GET", `/v1/orgs/${enc(orgId)}/meetings`, z.object({ meetings: z.array(zMeeting) }))).meetings;
}
export async function getMeeting(engine: Engine, id: string): Promise<Meeting> {
  return (await engine.api.json("GET", `/v1/meetings/${enc(id)}`, z.object({ meeting: zMeeting }))).meeting;
}
/** Everyone invited must already be able to open the room; the server refuses and names them otherwise. */
export async function createMeeting(engine: Engine, orgId: string, input: MeetingInput): Promise<Meeting> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/meetings`, z.object({ meeting: zMeeting }), { body: input })).meeting;
}
export async function updateMeeting(engine: Engine, id: string, rev: number, input: MeetingInput): Promise<Meeting> {
  return (await engine.api.json("PUT", `/v1/meetings/${enc(id)}`, z.object({ meeting: zMeeting }), { body: { ...input, rev } })).meeting;
}
export async function cancelMeeting(engine: Engine, id: string): Promise<Meeting> {
  return (await engine.api.json("POST", `/v1/meetings/${enc(id)}/cancel`, z.object({ meeting: zMeeting }), { body: {} })).meeting;
}
export async function respondToMeeting(engine: Engine, id: string, response: MeetingResponse): Promise<Meeting> {
  return (await engine.api.json("POST", `/v1/meetings/${enc(id)}/respond`, z.object({ meeting: zMeeting }), { body: { response } })).meeting;
}

// ───── the editor's time rules (android MeetingRules): entered in the person's zone, sent as UTC with the zone ─────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The wall clock in [zone] at [utcMs], as the parts of a UTC date (so they can be added to and printed). */
function wall(utcMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcMs);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (w: number) => {
  const d = new Date(w);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const isoTime = (w: number) => {
  const d = new Date(w);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** UTC ms for [date] "YYYY-MM-DD" at [time] "HH:MM" in [zone], or null when either doesn't parse (DST-correct). */
export function startMs(date: string, time: string, zone: string): number | null {
  if (!DATE.test(date) || !TIME.test(time)) return null;
  try {
    const [y, m, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const guess = Date.UTC(y, m - 1, d, h, mi);
    let t = guess - (wall(guess, zone) - guess);
    const second = wall(t, zone) - t;
    t = guess - second;
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
}

/** The next half hour from [nowMs] in [zone], as ["YYYY-MM-DD", "HH:MM"]. */
export function nextSlot(nowMs: number, zone: string): [string, string] {
  const w = wall(nowMs, zone);
  const d = new Date(w);
  const next = w - d.getUTCSeconds() * 1000 + (30 - (d.getUTCMinutes() % 30)) * 60_000;
  return [isoDate(next), isoTime(next)];
}

/** ["YYYY-MM-DD", "HH:MM", minutes] for an existing meeting, in [zone]. */
export function meetingFields(startsAt: number, endsAt: number, zone: string): [string, string, number] {
  const w = wall(startsAt, zone);
  return [isoDate(w), isoTime(w), Math.round((endsAt - startsAt) / 60_000)];
}

/** What's missing before Save, in order; empty when the server can be asked. */
export function meetingProblems(title: string, roomId: string | null, date: string, time: string, zone: string, nowMs: number): string[] {
  const out: string[] = [];
  if (!title.trim()) out.push("Give the meeting a title");
  if (!roomId) out.push("Pick a voice room");
  const start = startMs(date, time, zone);
  if (start === null) out.push("Set the date as YYYY-MM-DD and the time as HH:MM");
  else if (start < nowMs - 5 * 60_000) out.push("Pick a time that hasn't passed yet");
  return out;
}

/** "Mon 20 Oct, 14:30–15:00" in [zone]. */
export function whenText(startsAt: number, endsAt: number, zone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short" }).format(startsAt).replace(",", "");
  const hm = (t: number) => new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t);
  return `${day}, ${hm(startsAt)}–${hm(endsAt)}`;
}

/** An iCalendar file for "Add to my calendar": Meldiq reads nothing from the calendar and asks for no permission. */
export function meetingIcs(m: Pick<Meeting, "id" | "title" | "description" | "startsAt" | "endsAt" | "room">): string {
  const stamp = (t: number) =>
    new Date(t)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const text = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/[,;]/g, (c) => `\\${c}`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meldiq//Meetings//EN",
    "BEGIN:VEVENT",
    `UID:${m.id}@meldiq`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(m.startsAt)}`,
    `DTEND:${stamp(m.endsAt)}`,
    `SUMMARY:${text(m.title)}`,
    ...(m.description ? [`DESCRIPTION:${text(m.description)}`] : []),
    `LOCATION:${text(m.room?.name ? `Meldiq voice room #${m.room.name}` : "Meldiq")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/** A `meeting.soon` frame: the meeting as this person may see it, as a system notification (once, from the server). */
export async function meetingSoon(engine: Engine, meetingId: string, notify?: (title: string, body: string, roomId: string | null) => void): Promise<void> {
  if (!notify) return;
  try {
    const m = await getMeeting(engine, meetingId);
    if (m.cancelled || m.myResponse === "declined") return;
    notify(`Starting soon: ${m.title}`, `${whenText(m.startsAt, m.endsAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}${m.room?.name ? ` · #${m.room.name}` : ""}`, m.room?.id ?? null);
  } catch {
    /* gone or no longer visible: nothing to say */
  }
}
