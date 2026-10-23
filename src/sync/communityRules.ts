import type { Category, Overwrite } from "../api/communitySchemas";

/**
 * Communities in the browser, as android CommunityRules.kt, CommunityPanelRules.kt and CommunityMenuRules.kt decide
 * them (docs/COMMUNITY_REBUILD_2026-10-21.md, docs/product/MELDIQ_COMMUNITY_CHAT_SPEC.md): channel types, channels
 * grouped by category in their order, what each menu offers, permission overwrites and layout moves. Pure and tested
 * with the phone's cases (test/community-rules.test.ts). Hiding a control is for clarity only: the server decides
 * every change again.
 */

export type ChannelType = "text" | "announcement" | "forum" | "voice";

export function channelTypeOf(kind: string | null, voice: boolean, format: string | null): ChannelType {
  if (voice) return "voice";
  if (format === "forum") return "forum";
  if (kind === "ANNOUNCEMENT") return "announcement";
  return "text";
}

/** What to send when creating a channel of [type]: its kind, voice flag and format. Private applies to text, forum and voice. */
export function channelRequest(type: ChannelType, isPrivate: boolean): { kind: "PUBLIC" | "PRIVATE" | "ANNOUNCEMENT"; voice: boolean; format: "text" | "forum" } {
  const open = isPrivate ? "PRIVATE" : "PUBLIC";
  switch (type) {
    case "announcement":
      return { kind: "ANNOUNCEMENT", voice: false, format: "text" };
    case "voice":
      return { kind: open, voice: true, format: "text" };
    case "forum":
      return { kind: open, voice: false, format: "forum" };
    case "text":
      return { kind: open, voice: false, format: "text" };
  }
}

/** Key of the section holding channels without a category (shown first), and of each category's section. */
export const UNCATEGORISED = "category:none";
export const sectionKey = (categoryId: string | null): string => (categoryId ? `category:${categoryId}` : UNCATEGORISED);

/** A channel as the grouping needs it. */
export interface ChannelRef {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  position: number;
}

export interface ChannelSection<T> {
  key: string;
  categoryId: string | null;
  title: string | null;
  channels: T[];
}

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * [items] grouped by category: uncategorised channels first, then the categories in their order (a category the list
 * doesn't know, from a stale copy, goes last by its name), channels by position then name. [keepEmpty]: also list
 * known categories without channels (for the people arranging them).
 */
export function channelSections<T extends ChannelRef>(items: readonly T[], categories: readonly Category[], keepEmpty = false): ChannelSection<T>[] {
  const ordered = [...categories].sort((a, b) => a.position - b.position || byText(lower(a.name), lower(b.name)) || byText(a.id, b.id));
  const rank = new Map(ordered.map((c, i) => [c.id, i]));
  const known = new Map(categories.map((c) => [c.id, c]));
  const byCategory = new Map<string | null, T[]>();
  for (const it of items) {
    const key = it.categoryId || null;
    byCategory.set(key, [...(byCategory.get(key) ?? []), it]);
  }
  const sortChannels = (list: T[]) => [...list].sort((a, b) => a.position - b.position || byText(lower(a.name), lower(b.name)) || byText(a.id, b.id));
  const out: ChannelSection<T>[] = [];
  const none = byCategory.get(null);
  if (none) out.push({ key: UNCATEGORISED, categoryId: null, title: null, channels: sortChannels(none) });
  const ids = new Set<string>([...[...byCategory.keys()].filter((k): k is string => k !== null), ...(keepEmpty ? known.keys() : [])]);
  const nameOf = (id: string) => known.get(id)?.name ?? byCategory.get(id)?.[0]?.categoryName ?? "";
  [...ids]
    .sort((a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER) || byText(lower(nameOf(a)), lower(nameOf(b))) || byText(a, b))
    .forEach((id) => out.push({ key: sectionKey(id), categoryId: id, title: nameOf(id), channels: sortChannels(byCategory.get(id) ?? []) }));
  return out;
}

/** One channel in the community panel: one you're in, or one you may see but haven't joined (dimmed until opened). */
export interface PanelChannel extends ChannelRef {
  kind: string | null;
  voice: boolean;
  format: string;
  topic: string | null;
  joined: boolean;
  unread: number;
  mentions: number;
  muted: boolean;
  liveCall: boolean;
  canManage: boolean;
  archived: boolean;
}

export const hasNews = (ch: Pick<PanelChannel, "unread" | "mentions">): boolean => ch.unread > 0 || ch.mentions > 0;

export interface PanelSection extends ChannelSection<PanelChannel> {
  /** The channels drawn now (a collapsed category still shows those with news and the open one). */
  shown: PanelChannel[];
  collapsed: boolean;
  unreadChannels: number;
}

export interface PanelOptions {
  collapsed: ReadonlySet<string>;
  selectedId?: string | null;
  hideMuted?: boolean;
  unreadOnly?: boolean;
  /** Channels shown in Starred or the person's own sections instead. */
  placed?: ReadonlySet<string>;
  /** People who may add channels see empty categories (to fill them). */
  keepEmpty?: boolean;
  /** Batch B3: hidden channels; they still show while they mention you or are open. */
  hidden?: ReadonlySet<string>;
}

/**
 * The panel's sections in the community's order (android CommunityPanelRules.sections). A section left with nothing to
 * show stays while it's collapsed (to open it again) and, for the people who may add channels, while it has no
 * channels at all; otherwise it's left out.
 */
export function panelSections(channels: readonly PanelChannel[], categories: readonly Category[], o: PanelOptions): PanelSection[] {
  const listed = channels.filter((c) => !o.placed?.has(c.id));
  return channelSections(listed, categories, !!o.keepEmpty).flatMap((s) => {
    const isCollapsed = o.collapsed.has(s.key);
    const shown = s.channels.filter((ch) => {
      const open = ch.id === o.selectedId;
      const muteOk = !o.hideMuted || !ch.muted || ch.mentions > 0;
      const unreadOk = !o.unreadOnly || hasNews(ch) || open;
      const collapseOk = !isCollapsed || hasNews(ch) || open;
      const hiddenOk = !o.hidden?.has(ch.id) || ch.mentions > 0 || open;
      return muteOk && unreadOk && collapseOk && hiddenOk;
    });
    const keep = shown.length > 0 || (isCollapsed && !o.unreadOnly) || (!!o.keepEmpty && !o.unreadOnly && s.channels.length === 0);
    return keep ? [{ ...s, shown, collapsed: isCollapsed, unreadChannels: s.channels.filter((c) => c.unread > 0 && !c.muted).length }] : [];
  });
}

/** "Mark as read" for a community or a category: the joined channels with something unread. */
export const markReadTargets = (channels: readonly PanelChannel[]): string[] => channels.filter((c) => c.joined && hasNews(c)).map((c) => c.id);

/** Whether every joined channel is muted (the community or category's Mute item then says Unmute). */
export function allMuted(channels: readonly PanelChannel[]): boolean {
  const joined = channels.filter((c) => c.joined);
  return joined.length > 0 && joined.every((c) => c.muted);
}

/** The joined channels a Mute (or Unmute) of the whole community or category changes. */
export const muteTargets = (channels: readonly PanelChannel[], mute: boolean): string[] => channels.filter((c) => c.joined && c.muted !== mute).map((c) => c.id);

/** [orgs] in the person's rail order: arranged ones first in that order, then the rest as they came. */
export function railOrdered<T>(orgs: readonly T[], order: readonly string[] | undefined, id: (t: T) => string): T[] {
  if (!order?.length) return [...orgs];
  const rank = new Map(order.map((x, i) => [x, i]));
  return orgs
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (rank.get(id(a.o)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(id(b.o)) ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
    .map((x) => x.o);
}

/** [ids] with [id] moved one place up ([delta] -1) or down (+1); unchanged at either end. */
export function moved(ids: readonly string[], id: string, delta: number): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  out.splice(j, 0, ...out.splice(i, 1));
  return out;
}

export interface LayoutChannel {
  id: string;
  categoryId: string | null;
  position: number;
}

/** The layout entries for every channel of a category, in [orderedIds] order. */
export const layoutPositions = (categoryId: string | null, orderedIds: readonly string[]): LayoutChannel[] => orderedIds.map((id, position) => ({ id, categoryId, position }));

/** Moving [channelId] into [toCategory]: it goes last there. */
export const moveToCategory = (channelId: string, toCategory: string | null, targetIds: readonly string[]): LayoutChannel[] =>
  layoutPositions(toCategory, [...targetIds.filter((x) => x !== channelId), channelId]);

// ───────────── menus ─────────────

export type ChannelMenuItem =
  "markRead" | "favourite" | "unfavourite" | "mute" | "unmute" | "hide" | "show" | "copyName" | "edit" | "permissions" | "moveTo" | "moveUp" | "moveDown" | "archive" | "restore" | "delete";

export interface ChannelMenuInput {
  starred: boolean;
  canArrange: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  canHide?: boolean;
  hidden?: boolean;
}

/** A channel's menu (android CommunityMenuRules.channel). Channels you haven't joined offer nothing personal. */
export function channelMenu(ch: PanelChannel, i: ChannelMenuInput): ChannelMenuItem[] {
  const out: ChannelMenuItem[] = [];
  if (ch.joined) {
    if (hasNews(ch)) out.push("markRead");
    out.push(i.starred ? "unfavourite" : "favourite");
    out.push(ch.muted ? "unmute" : "mute");
  }
  if (i.canHide) out.push(i.hidden ? "show" : "hide");
  out.push("copyName");
  if (ch.canManage) {
    if (!ch.archived) out.push("edit");
    out.push("permissions");
  }
  if (i.canArrange) {
    out.push("moveTo");
    if (i.canMoveUp) out.push("moveUp");
    if (i.canMoveDown) out.push("moveDown");
  }
  if (ch.canManage) {
    out.push(ch.archived ? "restore" : "archive");
    if (i.canDelete) out.push("delete");
  }
  return out;
}

export type CategoryMenuItem = "markRead" | "collapse" | "expand" | "collapseAll" | "mute" | "unmute" | "notify" | "newChannel" | "rename" | "permissions" | "moveUp" | "moveDown" | "delete";

export interface CategoryMenuInput {
  isCategory: boolean;
  collapsed: boolean;
  hasNews: boolean;
  hasJoined: boolean;
  allMuted: boolean;
  canCreate: boolean;
  canManage: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canSetLevel?: boolean;
}

/** A category's menu (android CommunityMenuRules.category); [isCategory] false for the channels without one. */
export function categoryMenu(i: CategoryMenuInput): CategoryMenuItem[] {
  const out: CategoryMenuItem[] = [];
  if (i.hasNews) out.push("markRead");
  out.push(i.collapsed ? "expand" : "collapse");
  out.push("collapseAll");
  if (i.hasJoined) out.push(i.allMuted ? "unmute" : "mute");
  if (i.isCategory && i.canSetLevel) out.push("notify");
  if (i.canCreate) out.push("newChannel");
  if (i.isCategory && i.canManage) {
    out.push("rename", "permissions");
    if (i.canMoveUp) out.push("moveUp");
    if (i.canMoveDown) out.push("moveDown");
    out.push("delete");
  }
  return out;
}

/** Typing a channel's name to delete it: with or without the leading "#", ignoring surrounding spaces. */
export function deleteConfirmed(channelName: string, typed: string): boolean {
  return !!channelName.trim() && typed.trim().replace(/^#/, "").trim() === channelName.trim();
}

// ───────────── permission overwrites ─────────────

export const EVERYONE = "everyone";
export const USER_PREFIX = "user:";
export type OverwriteState = "allow" | "inherit" | "deny";

export function overwriteState(o: Pick<Overwrite, "allow" | "deny"> | undefined, capability: string): OverwriteState {
  if (!o) return "inherit";
  if (o.allow.includes(capability)) return "allow";
  if (o.deny.includes(capability)) return "deny";
  return "inherit";
}

/** [o]'s allow and deny after setting [capability] to [state]; nothing else changes. */
export function withState(o: Pick<Overwrite, "allow" | "deny"> | undefined, capability: string, state: OverwriteState): { allow: string[]; deny: string[] } {
  const allow = (o?.allow ?? []).filter((c) => c !== capability);
  const deny = (o?.deny ?? []).filter((c) => c !== capability);
  if (state === "allow") return { allow: [...allow, capability], deny };
  if (state === "deny") return { allow, deny: [...deny, capability] };
  return { allow, deny };
}

/** Overwrites in the order they apply: @everyone, roles, then members. */
export function orderedOverwrites<T extends Pick<Overwrite, "kind" | "label">>(list: readonly T[]): T[] {
  const rank = (k: string) => (k === "everyone" ? 0 : k === "role" ? 1 : 2);
  return [...list].sort((a, b) => rank(a.kind) - rank(b.kind) || byText(lower(a.label), lower(b.label)));
}

/** A channel with no rules of its own follows its category exactly ("synced"). */
export const overwritesSynced = (channel: readonly Pick<Overwrite, "allow" | "deny">[]): boolean => channel.every((o) => o.allow.length === 0 && o.deny.length === 0);

/** The rules "Sync with category" removes: every subject with something set on the channel itself. */
export const syncTargets = (channel: readonly Pick<Overwrite, "subject" | "allow" | "deny">[]): string[] => channel.filter((o) => o.allow.length || o.deny.length).map((o) => o.subject);

/** Hidden from people without a role: the lock on a channel's or category's name. */
export const overwritesGated = (list: readonly Pick<Overwrite, "subject" | "deny">[]): boolean => list.some((o) => o.subject === EVERYONE && o.deny.includes("channels.view"));

// ───────────── timed choices ─────────────

/** Mute for (batch B3, android ChannelControlSheets): 15 minutes to 24 hours, or until turned back on (null). */
export const MUTE_CHOICES: { label: string; ms: number | null }[] = [
  { label: "For 15 minutes", ms: 15 * 60_000 },
  { label: "For 1 hour", ms: 3_600_000 },
  { label: "For 3 hours", ms: 3 * 3_600_000 },
  { label: "For 8 hours", ms: 8 * 3_600_000 },
  { label: "For 24 hours", ms: 24 * 3_600_000 },
  { label: "Until I turn it back on", ms: null },
];

/** Slowmode steps the server accepts (seconds; 0 is off), with their labels. */
export const SLOWMODE_CHOICES: { sec: number; label: string }[] = [
  { sec: 0, label: "Off" },
  { sec: 5, label: "5 seconds" },
  { sec: 10, label: "10 seconds" },
  { sec: 30, label: "30 seconds" },
  { sec: 60, label: "1 minute" },
  { sec: 300, label: "5 minutes" },
  { sec: 900, label: "15 minutes" },
  { sec: 3600, label: "1 hour" },
  { sec: 21600, label: "6 hours" },
];

export function slowmodeLabel(sec: number): string {
  return SLOWMODE_CHOICES.find((c) => c.sec === sec)?.label ?? `${sec} seconds`;
}

/** How long until [at], for "You can send again in …" (rounded up to the next second). */
export function waitText(at: number, now: number): string {
  const s = Math.max(0, Math.ceil((at - now) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60 ? `${s % 60} s` : ""}`.trim();
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
}

// ───────────── permissions, Basic view (android A3, OverwriteRules.privacy / access / whoCanView) ─────────────

/** The one capability the Basic view changes: who can see the channel (or the category's channels). */
export const VIEW = "channels.view";

/** Private: @everyone can't see it. */
export const isPrivate = (list: readonly Pick<Overwrite, "subject" | "deny">[]): boolean => overwritesGated(list);

/** The roles and members allowed to see it (its "Who can access" list), @everyone aside. */
export function whoCanView<T extends Pick<Overwrite, "subject" | "kind" | "label" | "allow">>(list: readonly T[]): T[] {
  return orderedOverwrites(list.filter((o) => o.subject !== EVERYONE && o.allow.includes(VIEW)));
}

/** @everyone's rule after making it private (deny seeing it) or not (seeing it inherits again); its other rules stay. */
export function privacyRule(list: readonly Pick<Overwrite, "subject" | "allow" | "deny">[], makePrivate: boolean): { subject: string; allow: string[]; deny: string[] } {
  const everyone = list.find((o) => o.subject === EVERYONE);
  return { subject: EVERYONE, ...withState(everyone, VIEW, makePrivate ? "deny" : "inherit") };
}

/** [subject]'s rule after giving it access (allow seeing it) or taking it away (inherit again); its other rules stay. */
export function accessRule(list: readonly Pick<Overwrite, "subject" | "allow" | "deny">[], subject: string, grant: boolean): { subject: string; allow: string[]; deny: string[] } {
  const current = list.find((o) => o.subject === subject);
  return { subject, ...withState(current, VIEW, grant ? "allow" : "inherit") };
}
