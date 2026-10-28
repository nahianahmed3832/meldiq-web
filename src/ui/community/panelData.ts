import type { Category } from "../../api/communitySchemas";
import type { Conversation } from "../../api/schemas";
import type { AppState } from "../../state/store";
import { type PanelChannel, railOrdered } from "../../sync/communityRules";
import { isHidden, levelOf, mutedUntil, PERSONAL } from "../../sync/navPrefs";
import { isArchived } from "../selectors";

/**
 * The community panel's data from the app state (android CommunityPanelRules.channels): channels you're in, with this
 * browser's unread counts, and from the server's list those you may see but haven't joined, drawn dimmed until opened.
 */
export function panelChannels(s: AppState, orgId: string): PanelChannel[] {
  const prefs = s.nav[orgId];
  const now = Date.now();
  const joined = Object.values(s.conversations)
    .filter((c) => c.type === "CHANNEL" && c.orgId === orgId && c.joined && !c.archived && !isArchived(s, c.id))
    .map((c) => toPanel(c, true, s.local[c.id]?.unread ?? 0, s.local[c.id]?.mentions ?? 0, levelOf(prefs, c.id, c.categoryId, now) === "none", !!s.calls[c.id] || !!c.activeCall));
  const known = new Set(joined.map((c) => c.id));
  const others = (s.communities[orgId]?.channels ?? []).filter((c) => !c.joined && !c.archived && !known.has(c.id)).map((c) => toPanel(c, false, 0, 0, false, !!c.activeCall));
  return [...joined, ...others];
}

function toPanel(c: Conversation, joined: boolean, unread: number, mentions: number, muted: boolean, liveCall: boolean): PanelChannel {
  return {
    id: c.id,
    name: c.name ?? "channel",
    categoryId: c.categoryId,
    categoryName: c.categoryName,
    categoryPosition: c.categoryPosition,
    position: c.position,
    kind: c.kind,
    voice: c.voice,
    format: c.format,
    topic: c.topic,
    joined,
    unread,
    mentions,
    muted,
    liveCall,
    canManage: c.canManage,
    archived: c.archived,
  };
}

export function categoriesOf(s: AppState, orgId: string | null): Category[] {
  return orgId ? (s.communities[orgId]?.categories ?? []) : [];
}

export const hiddenSet = (s: AppState, orgId: string): Set<string> => new Set(s.nav[orgId]?.hidden ?? []);
export const channelHidden = (s: AppState, orgId: string, id: string): boolean => isHidden(s.nav[orgId], id);

/** The soonest end of a timed mute in [orgId]'s channels, so the panel draws them unmuted when it passes. */
export function nextMuteEnd(s: AppState, orgId: string): number | null {
  const now = Date.now();
  const ends = Object.keys(s.nav[orgId]?.mutedUntil ?? {})
    .map((id) => mutedUntil(s.nav[orgId], id, now))
    .filter((t): t is number => t !== null);
  return ends.length ? Math.min(...ends) : null;
}

/** The person's communities in their rail order (personal document, batch B2). */
export function orderedOrgs(s: AppState) {
  return railOrdered(s.orgs, s.nav[PERSONAL]?.railOrder, (o) => o.id);
}

/** A community's signals on the rail: something unread in a channel you haven't muted, and unread mentions. */
export function railBadge(s: AppState, orgId: string): { unread: boolean; mentions: number } {
  let unread = false;
  let mentions = 0;
  for (const c of Object.values(s.conversations)) {
    if (c.type !== "CHANNEL" || c.orgId !== orgId || !c.joined || isArchived(s, c.id)) continue;
    const l = s.local[c.id];
    if (!l) continue;
    mentions += l.mentions;
    if (l.unread > 0 && levelOf(s.nav[orgId], c.id, c.categoryId) !== "none") unread = true;
  }
  return { unread, mentions };
}
