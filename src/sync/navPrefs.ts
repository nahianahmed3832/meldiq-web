import { z } from "zod";
import { ApiError } from "../api/client";

/**
 * Personal navigation preferences (docs/WORKSPACE_ADMINISTRATION.md › Personal sections; android NavPrefsRules.kt):
 * starred conversations, custom sections, collapsed groups and notification levels, one document per workspace
 * ("personal" for DMs and groups, an organisation id for its channels), shared by every device of the person. They only
 * arrange what the person can already see.
 */

export const PERSONAL = "personal";
export const NOTIFY_LEVELS = ["all", "mentions", "none"] as const;
export type NotifyLevel = (typeof NOTIFY_LEVELS)[number];

const SECTION_NAME_MAX = 60;
const MAX_SECTIONS = 30;
const MAX_STARRED = 200;
const MAX_SAVED = 500;
const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

const zSection = z.object({ id: z.string(), name: z.string(), items: z.array(z.string()), collapsed: z.boolean().default(false) });
/**
 * A message saved for later (android Home › Later, server `saved-items`): ids and times only, in the personal document.
 * The content stays end-to-end encrypted in the conversation.
 */
const zSavedItem = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  savedAt: z.number(),
  remindAt: z.number().nullable().default(null),
  done: z.boolean().default(false),
});
export type SavedItem = z.infer<typeof zSavedItem>;
export const zNavPrefs = z.object({
  starred: z.array(z.string()).default([]),
  sections: z.array(zSection).default([]),
  collapsed: z.array(z.string()).default([]),
  notify: z.record(z.string(), z.enum(NOTIFY_LEVELS)).default({}),
  // Optional on purpose: a document written without it keeps the server's list (servers before saved items, or a
  // workspace document, never touch it).
  saved: z.array(zSavedItem).optional(),
  /** Batch B2, community documents: the level its channels follow unless they have their own, and Ignore @everyone. */
  community: z
    .object({
      level: z.enum(NOTIFY_LEVELS).default("all"),
      suppressEveryone: z.boolean().default(false),
      /** API 0.46.0: the whole community muted until then (epoch ms), its channels' own levels included. */
      mutedUntil: z.number().nullable().optional(),
    })
    .optional(),
  /** Batch B2, personal document: the person's communities in rail order. */
  railOrder: z.array(z.string()).optional(),
  /** Batch B3: mutes that end by themselves (conversation id → epoch ms). */
  mutedUntil: z.record(z.string(), z.number()).optional(),
  /** Batch B3, community documents: a category's own level, which its channels follow unless they have one. */
  categoryNotify: z.record(z.string(), z.enum(NOTIFY_LEVELS)).optional(),
  /** Batch B3, community documents: channels hidden from the channel list (they stay joined). */
  hidden: z.array(z.string()).optional(),
});
export type NavPrefs = z.infer<typeof zNavPrefs>;
export type NavSection = NavPrefs["sections"][number];
export const zNavDoc = z.object({ workspaceId: z.string(), rev: z.number(), prefs: zNavPrefs });
export type NavDoc = z.infer<typeof zNavDoc>;

export const EMPTY_PREFS: NavPrefs = { starred: [], sections: [], collapsed: [], notify: {} };

/** One change, kept until the server has it and replayed onto its latest copy (so devices merge, not overwrite). */
export type NavOp =
  | { op: "place"; conversationId: string; sectionId: string | null; starred: boolean }
  | { op: "move"; conversationId: string; delta: number }
  | { op: "addSection"; id: string; name: string }
  | { op: "renameSection"; id: string; name: string }
  | { op: "deleteSection"; id: string }
  | { op: "collapse"; key: string; collapsed: boolean }
  | { op: "collapseSection"; id: string; collapsed: boolean }
  // Saved for later (personal document only), as android NavPrefsRules: saving again moves it to the top and keeps its
  // reminder unless a new one is given; done clears the reminder; a reminder reopens a done item.
  | { op: "save"; conversationId: string; messageId: string; savedAt: number; remindAt: number | null }
  | { op: "unsave"; messageId: string }
  | { op: "savedDone"; messageId: string; done: boolean }
  | { op: "remind"; messageId: string; remindAt: number | null }
  // Batch B2 and B3, as android NavPrefsRules: [categoryId] lets "all" stay stored while that category is quieter.
  | { op: "notify"; conversationId: string; level: NotifyLevel; categoryId?: string | null }
  | { op: "community"; level?: NotifyLevel; suppressEveryone?: boolean; mutedUntil?: number | null }
  | { op: "notifyReset"; conversationId: string }
  | { op: "railOrder"; orgIds: string[] }
  | { op: "muteUntil"; conversationId: string; until: number | null }
  | { op: "categoryNotify"; categoryId: string; level: NotifyLevel | null }
  | { op: "hide"; conversationId: string; hidden: boolean };

export type NavPlace = { k: "default" } | { k: "starred" } | { k: "section"; id: string };

export function placeOf(p: NavPrefs, conversationId: string): NavPlace {
  if (p.starred.includes(conversationId)) return { k: "starred" };
  const s = p.sections.find((x) => x.items.includes(conversationId));
  return s ? { k: "section", id: s.id } : { k: "default" };
}

/**
 * The level that applies to a conversation now (android NavPrefsRules.level): "none" during a timed mute; else its own
 * level; else its category's ([categoryId]); else its community's; else "all".
 */
export function levelOf(p: NavPrefs | undefined, conversationId: string, categoryId: string | null = null, now: number = Date.now()): NotifyLevel {
  // A muted community mutes every channel in it, even those with a level of their own (as Discord's Mute Server).
  if (mutedUntil(p, conversationId, now) !== null || communityMutedUntil(p, now) !== null) return "none";
  return p?.notify[conversationId] ?? parentLevel(p, categoryId);
}

/** What a channel follows when it has no level of its own: its category's level, else the community's. */
export function parentLevel(p: NavPrefs | undefined, categoryId: string | null): NotifyLevel {
  return (categoryId ? p?.categoryNotify?.[categoryId] : undefined) ?? communityLevel(p);
}

/** "Until I turn it back on": a mute that never ends by itself (the latest time a Date can hold). */
export const MUTE_FOREVER = 8.64e15;

/** When the whole community's mute (API 0.46.0, the rail's Mute community) ends, if one is running at [now]. */
export function communityMutedUntil(p: NavPrefs | undefined, now: number = Date.now()): number | null {
  const t = p?.community?.mutedUntil;
  return typeof t === "number" && t > now ? t : null;
}

export const communityLevel = (p: NavPrefs | undefined, now: number = Date.now()): NotifyLevel => (communityMutedUntil(p, now) !== null ? "none" : (p?.community?.level ?? "all"));

/** Whether @everyone counts as a mention in this community (Ignore @everyone off). */
export const countsEveryone = (p: NavPrefs | undefined): boolean => p?.community?.suppressEveryone !== true;

/** When a timed mute of [conversationId] ends, if one is running at [now]. */
export function mutedUntil(p: NavPrefs | undefined, conversationId: string, now: number = Date.now()): number | null {
  const t = p?.mutedUntil?.[conversationId];
  return t !== undefined && t > now ? t : null;
}

/**
 * The details page's Mute button (batch B14, android DetailsActionsRow): mute what notifies; unmute ends a timed mute and
 * goes back to what the conversation inherits, or turns it on when that is off too.
 */
export function muteToggle(p: NavPrefs | undefined, conversationId: string, categoryId: string | null, now: number = Date.now()): NavOp[] {
  if (levelOf(p, conversationId, categoryId, now) !== "none") return [{ op: "notify", conversationId, level: "none" }];
  const ops: NavOp[] = [];
  if (mutedUntil(p, conversationId, now) !== null) ops.push({ op: "muteUntil", conversationId, until: null });
  if (parentLevel(p, categoryId) === "none") ops.push({ op: "notify", conversationId, level: "all" });
  else if (p?.notify[conversationId] !== undefined) ops.push({ op: "notifyReset", conversationId });
  return ops;
}

export const isHidden = (p: NavPrefs | undefined, conversationId: string): boolean => !!p?.hidden?.includes(conversationId);

/**
 * Whether a message notifies at a conversation's level (docs/MENTIONS.md): "mentions" lets mentions and @everyone
 * through, "none" (muted) only a mention of the person by name.
 */
export function shouldNotify(level: NotifyLevel, mention: "me" | "all" | null): boolean {
  if (level === "none") return mention === "me";
  if (level === "mentions") return mention !== null;
  return true;
}

/** Conversations in Starred or a custom section, so they aren't listed again in their default group. */
export function placed(p: NavPrefs): Set<string> {
  return new Set([...p.starred, ...p.sections.flatMap((s) => s.items)]);
}

function omit<V>(m: Record<string, V>, key: string): Record<string, V> {
  const next = { ...m };
  delete next[key];
  return next;
}

function without<T>(list: readonly T[], x: T): T[] {
  return list.filter((y) => y !== x);
}

function shifted(list: string[], id: string, delta: number): string[] {
  const i = list.indexOf(id);
  if (i < 0) return list;
  const j = Math.max(0, Math.min(list.length - 1, i + delta));
  if (i === j) return list;
  const out = without(list, id);
  out.splice(j, 0, id);
  return out;
}

function place(p: NavPrefs, id: string, sectionId: string | null, star: boolean): NavPrefs {
  // Out of wherever it was first: a conversation sits in one place only.
  const starred = without(p.starred, id);
  const sections = p.sections.map((s) => ({ ...s, items: without(s.items, id) }));
  if (star) return starred.length >= MAX_STARRED ? p : { ...p, starred: [...starred, id], sections };
  if (sectionId !== null) {
    if (!sections.some((s) => s.id === sectionId)) return p;
    return { ...p, starred, sections: sections.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, id] } : s)) };
  }
  return { ...p, starred, sections };
}

export function applyOp(p: NavPrefs, o: NavOp): NavPrefs {
  switch (o.op) {
    case "place":
      return place(p, o.conversationId, o.sectionId, o.starred);
    case "move":
      return { ...p, starred: shifted(p.starred, o.conversationId, o.delta), sections: p.sections.map((s) => ({ ...s, items: shifted(s.items, o.conversationId, o.delta) })) };
    case "notify": {
      // "All" is only stored while the category or community is quieter; choosing a level also ends a timed mute.
      const notify = { ...p.notify };
      if (o.level === "all" && parentLevel(p, o.categoryId ?? null) === "all") delete notify[o.conversationId];
      else notify[o.conversationId] = o.level;
      return { ...p, notify, ...(p.mutedUntil ? { mutedUntil: omit(p.mutedUntil, o.conversationId) } : {}) };
    }
    case "notifyReset":
      return { ...p, notify: omit(p.notify, o.conversationId) };
    case "community": {
      const current = p.community ?? { level: "all" as NotifyLevel, suppressEveryone: false };
      const until = o.mutedUntil !== undefined ? o.mutedUntil : (p.community?.mutedUntil ?? null);
      const next = { level: o.level ?? current.level, suppressEveryone: o.suppressEveryone ?? current.suppressEveryone, ...(until !== null ? { mutedUntil: until } : {}) };
      // Back to "all": an "all" override says nothing any more, unless category levels make it mean something.
      const dropAll = next.level === "all" && !Object.keys(p.categoryNotify ?? {}).length;
      return { ...p, community: next, notify: dropAll ? Object.fromEntries(Object.entries(p.notify).filter(([, l]) => l !== "all")) : p.notify };
    }
    case "railOrder":
      return { ...p, railOrder: [...new Set(o.orgIds)] };
    case "muteUntil":
      return { ...p, mutedUntil: o.until === null ? omit(p.mutedUntil ?? {}, o.conversationId) : { ...(p.mutedUntil ?? {}), [o.conversationId]: o.until } };
    case "categoryNotify":
      return { ...p, categoryNotify: o.level === null ? omit(p.categoryNotify ?? {}, o.categoryId) : { ...(p.categoryNotify ?? {}), [o.categoryId]: o.level } };
    case "hide":
      return { ...p, hidden: o.hidden ? [...without(p.hidden ?? [], o.conversationId), o.conversationId] : without(p.hidden ?? [], o.conversationId) };
    case "addSection": {
      const name = o.name.trim().slice(0, SECTION_NAME_MAX);
      if (!name || p.sections.length >= MAX_SECTIONS || p.sections.some((s) => s.id === o.id)) return p;
      return { ...p, sections: [...p.sections, { id: o.id, name, items: [], collapsed: false }] };
    }
    case "renameSection": {
      const name = o.name.trim().slice(0, SECTION_NAME_MAX);
      return name ? { ...p, sections: p.sections.map((s) => (s.id === o.id ? { ...s, name } : s)) } : p;
    }
    case "deleteSection":
      // Its conversations go back to their default groups.
      return { ...p, sections: p.sections.filter((s) => s.id !== o.id) };
    case "collapse":
      return { ...p, collapsed: o.collapsed ? [...without(p.collapsed, o.key), o.key] : without(p.collapsed, o.key) };
    case "collapseSection":
      return { ...p, sections: p.sections.map((s) => (s.id === o.id ? { ...s, collapsed: o.collapsed } : s)) };
    case "save": {
      const current = p.saved ?? [];
      const previous = current.find((x) => x.messageId === o.messageId);
      const item: SavedItem = { conversationId: o.conversationId, messageId: o.messageId, savedAt: o.savedAt, remindAt: o.remindAt ?? previous?.remindAt ?? null, done: false };
      return { ...p, saved: [item, ...current.filter((x) => x.messageId !== o.messageId)].slice(0, MAX_SAVED) };
    }
    case "unsave":
      return { ...p, saved: (p.saved ?? []).filter((x) => x.messageId !== o.messageId) };
    case "savedDone":
      return { ...p, saved: (p.saved ?? []).map((x) => (x.messageId === o.messageId ? { ...x, done: o.done, remindAt: o.done ? null : x.remindAt } : x)) };
    case "remind":
      return { ...p, saved: (p.saved ?? []).map((x) => (x.messageId === o.messageId ? { ...x, remindAt: o.remindAt, done: false } : x)) };
  }
}

export function replay(p: NavPrefs, ops: readonly NavOp[]): NavPrefs {
  return ops.reduce(applyOp, p);
}

/** A new section's id: "s_" and 12 random letters or digits (android NavPrefsRules.newSectionId). */
export function newSectionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `s_${[...bytes].map((b) => ID_CHARS[b % ID_CHARS.length]).join("")}`;
}

/** Which document a conversation's arrangement lives in. */
export function workspaceOf(orgId: string | null): string {
  return orgId ?? PERSONAL;
}

// ───────────────────────── syncing with the server ─────────────────────────

/** What NavSync needs from the engine (kept small so the rules above stay testable without one). */
export interface NavSyncHost {
  get(path: string): Promise<unknown>;
  put(path: string, body: unknown): Promise<unknown>;
  load(key: string): Promise<unknown>;
  save(key: string, value: unknown): Promise<void>;
  /** The documents as the server last sent them, with this device's unsent changes on top. */
  publish(docs: Record<string, NavPrefs>): void;
}

const PENDING_KEY = "nav.pending";
const MAX_CONFLICT_RETRIES = 3;

/**
 * Keeps the server's copy of each workspace's document and this device's unsent changes. A change shows at once; it is
 * sent with the revision it was based on, and if another device wrote first (409) it is replayed onto that copy and sent
 * again. Unsent changes survive a reload and go out when the connection returns (android NavPreferences.kt).
 */
export class NavSync {
  private docs = new Map<string, { rev: number; prefs: NavPrefs }>();
  private pending: Record<string, NavOp[]> = {};
  private flushing: Promise<void> | null = null;
  private loaded = false;

  constructor(private readonly host: NavSyncHost) {}

  private async loadPending(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const saved = (await this.host.load(PENDING_KEY)) as Record<string, NavOp[]> | undefined;
    if (saved && typeof saved === "object") this.pending = { ...saved, ...this.pending };
  }

  private publish(): void {
    const out: Record<string, NavPrefs> = {};
    const ids = new Set([...this.docs.keys(), ...Object.keys(this.pending)]);
    for (const id of ids) out[id] = replay(this.docs.get(id)?.prefs ?? EMPTY_PREFS, this.pending[id] ?? []);
    this.host.publish(out);
  }

  /** Fetches the documents of [workspaceIds] (start, reconnect, or a prefs.updated frame), then sends what's unsent. */
  async refresh(workspaceIds: readonly string[]): Promise<void> {
    await this.loadPending();
    await Promise.all(
      workspaceIds.map(async (id) => {
        try {
          const doc = zNavDoc.parse(await this.host.get(`/v1/me/preferences/${encodeURIComponent(id)}`));
          this.docs.set(id, { rev: doc.rev, prefs: doc.prefs });
        } catch {
          /* an older server without preferences, or offline: keep what we have */
        }
      }),
    );
    this.publish();
    await this.flush();
  }

  async change(workspaceId: string, op: NavOp): Promise<void> {
    await this.loadPending();
    this.pending = { ...this.pending, [workspaceId]: [...(this.pending[workspaceId] ?? []), op] };
    this.publish();
    await this.host.save(PENDING_KEY, this.pending);
    await this.flush();
  }

  /** Sends every workspace's unsent changes; one flush at a time. */
  flush(): Promise<void> {
    this.flushing ??= this.flushAll().finally(() => (this.flushing = null));
    return this.flushing;
  }

  private async flushAll(): Promise<void> {
    for (const id of Object.keys(this.pending)) await this.flushOne(id);
  }

  private async flushOne(workspaceId: string): Promise<void> {
    for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
      const ops = this.pending[workspaceId] ?? [];
      if (ops.length === 0) return;
      const base = this.docs.get(workspaceId) ?? { rev: 0, prefs: EMPTY_PREFS };
      try {
        const doc = zNavDoc.parse(await this.host.put(`/v1/me/preferences/${encodeURIComponent(workspaceId)}`, { baseRev: base.rev, prefs: replay(base.prefs, ops) }));
        this.docs.set(workspaceId, { rev: doc.rev, prefs: doc.prefs });
        // Changes made while this was being sent stay pending.
        const rest = (this.pending[workspaceId] ?? []).slice(ops.length);
        const next = { ...this.pending };
        if (rest.length) next[workspaceId] = rest;
        else delete next[workspaceId];
        this.pending = next;
        await this.host.save(PENDING_KEY, this.pending);
        this.publish();
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          const current = zNavDoc.safeParse((e.details as { current?: unknown } | undefined)?.current);
          if (current.success) this.docs.set(workspaceId, { rev: current.data.rev, prefs: current.data.prefs });
          continue; // replay onto the newer copy
        }
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
          // Not a member of that workspace any more, or a change the server can't take: drop it rather than retry forever.
          const next = { ...this.pending };
          delete next[workspaceId];
          this.pending = next;
          await this.host.save(PENDING_KEY, this.pending);
          this.publish();
        }
        return; // offline or busy: kept, sent on the next flush
      }
    }
  }
}

/** Saved messages still to deal with (newest first), then the finished ones (android NavPrefsRules.savedOpen/savedDone). */
export function savedOpen(p: NavPrefs | undefined): SavedItem[] {
  return (p?.saved ?? []).filter((x) => !x.done);
}

export function savedDone(p: NavPrefs | undefined): SavedItem[] {
  return (p?.saved ?? []).filter((x) => x.done);
}

/** Saved messages whose reminder time has passed. */
export function savedOverdue(p: NavPrefs | undefined, now: number): number {
  return savedOpen(p).filter((x) => (x.remindAt ?? Number.MAX_SAFE_INTEGER) <= now).length;
}
