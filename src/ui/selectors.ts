import type { Conversation } from "../api/schemas";
import type { AppState } from "../state/store";
import { levelOf, type NavPrefs, PERSONAL, placed, savedOverdue, workspaceOf } from "../sync/navPrefs";

/**
 * What the sidebar and the three sections list, from the server's conversations and this browser's unread counts
 * (android WorkspaceHomeRules). Direct messages and personal groups have no workspace, so they show in every workspace;
 * channels only in their own.
 */

export const isPeople = (c: Conversation): boolean => c.type === "DM" || c.type === "GROUP";

export function inWorkspace(c: Conversation, orgId: string | null): boolean {
  return c.orgId === null || c.orgId === orgId;
}

export function activityAt(s: AppState, c: Conversation): number {
  return Math.max(s.local[c.id]?.lastActivityAt ?? 0, c.createdAt);
}

export function byActivity(s: AppState): (a: Conversation, b: Conversation) => number {
  return (a, b) => activityAt(s, b) - activityAt(s, a);
}

export interface ChannelGroup {
  key: string;
  title: string;
  scope: string | null;
  channels: Conversation[];
}

const SCOPE_ORDER: Record<string, number> = { ORG: 0, BRANCH: 1, TEAM: 2 };

/** The workspace's channels, grouped by the organisation, branch or team they belong to; each group alphabetical. */
export function channelGroups(s: AppState, orgId: string | null): ChannelGroup[] {
  const groups = new Map<string, ChannelGroup>();
  for (const c of Object.values(s.conversations)) {
    if (c.type !== "CHANNEL" || c.orgId !== orgId || !orgId) continue;
    // Voice rooms have their own section (with who is in them), so they aren't listed a second time here.
    if (c.voice) continue;
    const key = `${c.scope ?? "ORG"}:${c.scopeId ?? c.orgId}`;
    const title = c.scope === "ORG" || !c.scope ? "Channels" : (c.scopeName ?? (c.scope === "TEAM" ? "Team" : "Branch"));
    const g = groups.get(key) ?? { key, title, scope: c.scope, channels: [] };
    g.channels.push(c);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, channels: [...g.channels].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")) }))
    .sort((a, b) => (SCOPE_ORDER[a.scope ?? "ORG"] ?? 3) - (SCOPE_ORDER[b.scope ?? "ORG"] ?? 3) || a.title.localeCompare(b.title));
}

/** Archived on this browser (out of the lists and badges; android ChatListRules.isArchived). */
export const isArchived = (s: AppState, id: string): boolean => !!s.local[id]?.archivedAt;

/** Muted with the synced notification level "none": its unread count shows quietly and stays out of the badges. */
export function isMuted(s: AppState, c: Conversation): boolean {
  return levelOf(s.nav[workspaceOf(c.orgId)], c.id, c.categoryId) === "none";
}

/** Batch B6: a message request waiting for you, listed apart (DMs › Message requests) with no badge. */
export const isRequest = (c: Conversation): boolean => c.request?.incoming === true;

/** Message requests waiting for this person, newest first. */
export function messageRequests(s: AppState): Conversation[] {
  return Object.values(s.conversations).filter(isRequest).sort(byActivity(s));
}

/** Direct messages and groups, newest first, without the ones archived here or requests waiting for you. */
export function people(s: AppState): Conversation[] {
  return Object.values(s.conversations)
    .filter((c) => isPeople(c) && !isArchived(s, c.id) && !isRequest(c))
    .sort(byActivity(s));
}

export function archivedPeople(s: AppState): Conversation[] {
  return Object.values(s.conversations)
    .filter((c) => isPeople(c) && isArchived(s, c.id) && !isRequest(c))
    .sort(byActivity(s));
}

export function unreadOf(s: AppState, id: string): number {
  return s.local[id]?.unread ?? 0;
}

/** Unread direct messages and groups (archived and muted ones aside). */
export function unreadPeopleCount(s: AppState): number {
  return Object.values(s.conversations).filter((c) => isPeople(c) && unreadOf(s, c.id) > 0 && !isArchived(s, c.id) && !isMuted(s, c) && !isRequest(c)).length;
}

export interface HomeSection {
  /** "personal" or the organisation id whose document holds it. */
  workspaceId: string;
  id: string;
  name: string;
  collapsed: boolean;
  ids: string[];
}

export interface HomeLayout {
  starred: string[];
  sections: HomeSection[];
  /** Conversations shown in Starred or a section, left out of their default groups. */
  placed: Set<string>;
}

/**
 * Home's personal arrangement for a workspace (docs/WORKSPACE_ADMINISTRATION.md §5): Starred and the custom sections
 * from the workspace's document (its channels) and the personal one (direct messages and groups), in the person's order;
 * only conversations this account has and that belong in this workspace's view.
 */
export function homeLayout(s: AppState, orgId: string | null): HomeLayout {
  const docs: [string, NavPrefs | undefined][] = [...(orgId ? ([[orgId, s.nav[orgId]]] as [string, NavPrefs | undefined][]) : []), [PERSONAL, s.nav[PERSONAL]]];
  const shown = (id: string) => {
    const c = s.conversations[id];
    return !!c && inWorkspace(c, orgId) && !isArchived(s, id);
  };
  const starred: string[] = [];
  const sections: HomeSection[] = [];
  const all = new Set<string>();
  for (const [ws, p] of docs) {
    if (!p) continue;
    starred.push(...p.starred.filter(shown));
    for (const sec of p.sections) sections.push({ workspaceId: ws, id: sec.id, name: sec.name, collapsed: sec.collapsed, ids: sec.items.filter(shown) });
    for (const id of placed(p)) all.add(id);
  }
  return { starred, sections, placed: all };
}

/** Conversations in this workspace's view with unread @mentions of me. */
export function mentionConversations(s: AppState, orgId: string | null): Conversation[] {
  return Object.values(s.conversations)
    .filter((c) => (s.local[c.id]?.mentions ?? 0) > 0 && (orgId === null || inWorkspace(c, orgId)))
    .sort(byActivity(s));
}

export function mentionCount(s: AppState): number {
  return Object.values(s.local).reduce((n, l) => n + (s.conversations[l.id] ? l.mentions : 0), 0);
}

/** Channels with unread messages in a workspace (the rail's badge). */
/**
 * What "Mark all as read" clears (round 3; android WorkspaceHomeRules.markAllReadTargets): this workspace's channels
 * you're in with anything unread. DMs and groups keep their state.
 */
export function markAllReadTargets(s: AppState, orgId: string | null): string[] {
  if (!orgId) return [];
  return Object.values(s.conversations)
    .filter((c) => c.type === "CHANNEL" && c.orgId === orgId && c.joined !== false && (unreadOf(s, c.id) > 0 || (s.local[c.id]?.mentions ?? 0) > 0))
    .map((c) => c.id);
}

export type ActivityFilter = "all" | "mentions" | "unreads" | "threads" | "calls";

/** Which Activity sections a filter chip shows (round 3, the reference's Activity chips); All doesn't repeat Unreads (B5). */
export function activityShows(filter: ActivityFilter, section: Exclude<ActivityFilter, "all">): boolean {
  return filter === section || (filter === "all" && section !== "unreads");
}

export interface UnreadGroup {
  /** null: direct messages and groups. */
  orgId: string | null;
  title: string;
  ids: string[];
}

/**
 * Activity › Unreads (batch B5, android ActivityRules.unreads): conversations with unread messages, newest first, without
 * muted, archived, hidden ones or message requests; direct messages and groups first, then each community by its name.
 */
export function unreadGroups(s: AppState): UnreadGroup[] {
  const unread = Object.values(s.conversations)
    .filter((c) => unreadOf(s, c.id) > 0 && !isMuted(s, c) && !isArchived(s, c.id) && !isRequest(c) && !(c.orgId && s.nav[c.orgId]?.hidden?.includes(c.id)))
    .sort(byActivity(s));
  const direct = unread.filter((c) => c.type !== "CHANNEL");
  const byOrg = new Map<string, string[]>();
  for (const c of unread) if (c.type === "CHANNEL" && c.orgId) byOrg.set(c.orgId, [...(byOrg.get(c.orgId) ?? []), c.id]);
  return [
    ...(direct.length ? [{ orgId: null, title: "Direct messages and groups", ids: direct.map((c) => c.id) }] : []),
    ...[...byOrg].map(([orgId, ids]) => ({ orgId, title: s.orgs.find((o) => o.id === orgId)?.name ?? "Community", ids })),
  ];
}

/**
 * A community's rolled-up activity for its rail icon: unread events and mentions of you across the channels this account
 * can see (the conversation list holds only those), muted channels left out except for mentions.
 */
export function orgActivity(s: AppState, orgId: string): { unread: number; mentions: number } {
  let unread = 0;
  let mentions = 0;
  for (const c of Object.values(s.conversations)) {
    if (c.type !== "CHANNEL" || c.orgId !== orgId) continue;
    mentions += s.local[c.id]?.mentions ?? 0;
    if (!isMuted(s, c)) unread += unreadOf(s, c.id);
  }
  return { unread, mentions };
}

export function orgUnread(s: AppState, orgId: string): number {
  return Object.values(s.conversations).filter((c) => c.type === "CHANNEL" && c.orgId === orgId && unreadOf(s, c.id) > 0 && !isMuted(s, c)).length;
}

/** Saved messages whose reminder time has passed, plus server reminders that went off and weren't dealt with. */
export function laterDue(s: AppState): number {
  return savedOverdue(s.nav[PERSONAL], Date.now()) + s.reminders.items.filter((r) => r.state === "fired").length;
}

/**
 * Who is in a voice room now (user ids): the live call's connected devices once its events arrive, else the server's
 * list on the conversation; empty when the room has no call (android VoiceRooms.roomPeople).
 */
export function roomPeople(s: AppState, conversationId: string): string[] {
  const call = s.calls[conversationId];
  if (!call) return [];
  if (call.participants) return [...new Set(call.participants.map((p) => p.userId))];
  return s.conversations[conversationId]?.activeCall?.participantIds ?? [];
}

export interface LiveCallSummary {
  video: boolean;
  /** Who is in the call (each once). */
  people: string[];
  /** Who is sharing their screen, among them. */
  sharing: string[];
}

/**
 * A conversation's live call for its row (community-first brief §E): voice or video, who is in it and who is sharing,
 * from the call's own events, or the server's conversation list before any arrive. Null when nothing is live. Rows only
 * exist for conversations this account may see, and call events reach only their members.
 */
export function liveCallOf(s: AppState, conversationId: string): LiveCallSummary | null {
  const call = s.calls[conversationId];
  const listed = s.conversations[conversationId]?.activeCall ?? s.communities[s.conversations[conversationId]?.orgId ?? ""]?.channels.find((c) => c.id === conversationId)?.activeCall ?? null;
  if (!call && !listed) return null;
  const people = roomPeople(s, conversationId);
  const fromList = people.length ? people : (listed?.participantIds ?? []);
  return {
    video: call?.video ?? listed?.video ?? false,
    people: fromList,
    sharing: (call?.sharing ?? []).filter((u) => fromList.includes(u)),
  };
}

/** The workspace's voice rooms this person is in, alphabetical (android WorkspaceHomeScreen voiceRooms). */
export function voiceRooms(s: AppState, orgId: string | null): Conversation[] {
  if (!orgId) return [];
  return Object.values(s.conversations)
    .filter((c) => c.voice && c.orgId === orgId && c.joined && !c.archived)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}
