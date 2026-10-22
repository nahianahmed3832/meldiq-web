import { z } from "zod";
import { openEnum } from "../api/enums";
import { type Conversation, zConversation, zMember } from "../api/schemas";
import { createInvitation } from "./workspaces";
import type { Engine } from "./engine";
import { setNotificationsPaused } from "./status";
import { inviteLink } from "./inviteCodes";

/**
 * People and DMs (batches B6, B6b, B12; server routes/connections.ts, users.ts; android ConnectionRules, RequestRules,
 * PresenceRules): connections, message requests, who may message you, presence choices, pronouns and group photos. No
 * suggestions or mutual lists: only what each person did. The server decides every answer.
 */

const enc = encodeURIComponent;

// ───────────── connections ─────────────

const zEntry = z.object({ user: zMember, at: z.number() });
export const zConnections = z.object({ connected: z.array(zMember), incoming: z.array(zEntry), outgoing: z.array(zEntry) });
export type Connections = z.infer<typeof zConnections>;
export type ConnectionState = "none" | "sent" | "received" | "connected";

export function connectionState(lists: Connections | null | undefined, userId: string): ConnectionState {
  if (!lists) return "none";
  if (lists.connected.some((u) => u.id === userId)) return "connected";
  if (lists.incoming.some((e) => e.user.id === userId)) return "received";
  if (lists.outgoing.some((e) => e.user.id === userId)) return "sent";
  return "none";
}

/** What "Add by username" sends: the name without a leading @ and spaces; null when nothing is left. */
export function cleanUsername(raw: string): string | null {
  const u = raw.trim().replace(/^@/, "").trim();
  return u && u.length <= 64 ? u : null;
}

export function connections(engine: Engine): Promise<Connections> {
  return engine.api.json("GET", "/v1/connections", zConnections);
}

/** Sends a request, or accepts theirs when they already asked. */
export async function connect(engine: Engine, to: { userId: string } | { username: string }): Promise<"pending" | "accepted"> {
  return (await engine.api.json("POST", "/v1/connections", z.object({ state: z.enum(["pending", "accepted"]) }), { body: to })).state;
}

export async function acceptConnection(engine: Engine, userId: string): Promise<void> {
  await engine.api.call("POST", `/v1/connections/${enc(userId)}/accept`);
}

/** Cancels your request, declines theirs, or removes a connection; the other person isn't told which. */
export async function removeConnection(engine: Engine, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/connections/${enc(userId)}`);
}

// ───────────── message requests and who may message you ─────────────

export const DM_POLICIES = ["everyone", "communities", "connections"] as const;
export const REQUEST_POLICIES = ["everyone", "communities", "nobody"] as const;
export type DmPolicy = (typeof DM_POLICIES)[number];
export type RequestPolicy = (typeof REQUEST_POLICIES)[number];
export const DM_POLICY_LABEL: Record<DmPolicy, string> = { everyone: "Everyone", communities: "People in your communities", connections: "Only your connections" };
export const REQUEST_POLICY_LABEL: Record<RequestPolicy, string> = { everyone: "Everyone", communities: "People in your communities", nobody: "Nobody" };

const zMessaging = z.object({ dmPolicy: openEnum(DM_POLICIES), requestPolicy: openEnum(REQUEST_POLICIES) });
export type MessagingSettings = z.infer<typeof zMessaging>;

export function messagingSettings(engine: Engine): Promise<MessagingSettings> {
  return engine.api.json("GET", "/v1/users/me/messaging", zMessaging);
}

export function setMessagingSettings(engine: Engine, change: Partial<MessagingSettings>): Promise<MessagingSettings> {
  return engine.api.json("PUT", "/v1/users/me/messaging", zMessaging, { body: change });
}

/** A message request waiting for this person (the DMs list leaves them out; android RequestRules.incoming). */
export const isIncomingRequest = (c: Conversation): boolean => c.request?.incoming === true;

/** Messages you may still send before they answer your request. */
export const remaining = (sent: number, limit: number): number => Math.max(0, limit - sent);

export async function answerRequest(engine: Engine, conversationId: string, action: "accept" | "decline" | "block"): Promise<void> {
  await engine.api.call("POST", `/v1/conversations/${enc(conversationId)}/request`, { body: { action } });
  await engine.refreshAll();
}

export async function requestConversations(engine: Engine): Promise<Conversation[]> {
  return (await engine.api.json("GET", "/v1/conversations?requests=1", z.object({ conversations: z.array(zConversation) }))).conversations;
}

// ───────────── presence (batch B6b) ─────────────

export const PRESENCE_MODES = ["auto", "idle", "dnd", "invisible"] as const;
export type PresenceMode = (typeof PRESENCE_MODES)[number];
export type ShownPresence = "online" | "idle" | "dnd" | "offline";
export const PRESENCE_LABEL: Record<PresenceMode, { label: string; hint: string }> = {
  auto: { label: "Online", hint: "Automatic: online while Meldiq is open" },
  idle: { label: "Idle", hint: "Shows you're away" },
  dnd: { label: "Do not disturb", hint: "Pauses notifications on all your devices for as long" },
  invisible: { label: "Invisible", hint: "You appear offline, and your last seen doesn't change" },
};
export const PRESENCE_MAX_MS = 30 * 24 * 3_600_000;
/** Ends a choice can have (null: until you change it). */
export const PRESENCE_DURATIONS: { label: string; ms: number | null }[] = [
  { label: "1 hour", ms: 3_600_000 },
  { label: "8 hours", ms: 8 * 3_600_000 },
  { label: "24 hours", ms: 24 * 3_600_000 },
  { label: "7 days", ms: 7 * 24 * 3_600_000 },
  { label: "Until I change it", ms: null },
];

/** The choice still running: a timed one that has ended is automatic again. */
export function currentPresence(mode: string | null | undefined, until: number | null | undefined, now: number): PresenceMode {
  if (!mode || mode === "auto" || (until != null && until <= now)) return "auto";
  return (PRESENCE_MODES as readonly string[]).includes(mode) ? (mode as PresenceMode) : "auto";
}

/** Do not disturb pauses notifications as long as it lasts; "until changed" pauses for the longest the server allows. */
export const dndPauseUntil = (until: number | null, now: number): number => until ?? now + PRESENCE_MAX_MS;

/** What others see: "Idle", "Do not disturb", "Online", or nothing for offline (last seen is said elsewhere). */
export function presenceWords(p: ShownPresence | null | undefined, online: boolean | null | undefined): string | null {
  if (p === "idle") return "Idle";
  if (p === "dnd") return "Do not disturb";
  if (p === "online" || (p == null && online)) return "Online";
  return null;
}

/** Sets this person's presence; do not disturb also pauses notifications on every device (as android does). */
export async function setPresence(engine: Engine, mode: PresenceMode, until: number | null, wasDnd: boolean): Promise<void> {
  await engine.api.call("PUT", "/v1/users/me/presence", { body: { mode, until } });
  if (mode === "dnd") await setNotificationsPaused(engine, dndPauseUntil(until, Date.now()));
  else if (wasDnd) await setNotificationsPaused(engine, null);
  else await engine.refreshAll();
}

// ───────────── group photos (batch B6b) ─────────────

export async function setGroupPhoto(engine: Engine, conversationId: string, jpeg: Uint8Array): Promise<void> {
  await engine.api.call("PUT", `/v1/conversations/${enc(conversationId)}/photo`, { raw: jpeg });
  await engine.ensureConversation(conversationId);
}

export async function removeGroupPhoto(engine: Engine, conversationId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/conversations/${enc(conversationId)}/photo`);
}

// ───────────── invite from a profile (batch B4b, DM-08) ─────────────

export const PROFILE_INVITE_HOURS = 7 * 24;

/** The communities offered: not ones where this account is only a guest (android ProfileInvite.offered). */
export function invitableCommunities<T extends { myRole: string | null; name: string }>(orgs: readonly T[]): T[] {
  return orgs.filter((o) => o.myRole !== null && o.myRole !== "GUEST").sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** The DM text: the community's name and the link (android ProfileInvite.message). */
export const profileInviteMessage = (communityName: string, link: string): string => `${communityName}: ${link}`;

/**
 * Invites someone to one of your communities from their profile: a one-use invitation valid 7 days, sent as the https
 * link in your DM with them.
 */
export async function inviteFromProfile(engine: Engine, orgId: string, orgName: string, dmId: string): Promise<void> {
  const inv = await createInvitation(engine, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: PROFILE_INVITE_HOURS });
  await engine.sendText(dmId, profileInviteMessage(orgName, inviteLink(inv.code)));
}
