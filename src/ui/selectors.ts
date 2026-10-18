import type { Conversation } from "../api/schemas";
import type { AppState } from "../state/store";

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

export function people(s: AppState): Conversation[] {
  return Object.values(s.conversations).filter(isPeople).sort(byActivity(s));
}

export function unreadOf(s: AppState, id: string): number {
  return s.local[id]?.unread ?? 0;
}

/** Unread direct messages and groups. */
export function unreadPeopleCount(s: AppState): number {
  return Object.values(s.conversations).filter((c) => isPeople(c) && unreadOf(s, c.id) > 0).length;
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
export function orgUnread(s: AppState, orgId: string): number {
  return Object.values(s.conversations).filter((c) => c.type === "CHANNEL" && c.orgId === orgId && unreadOf(s, c.id) > 0).length;
}
