import type { Conversation, Org, ServerInfo } from "../api/schemas";
import { copy, fromUtf8, randomBytes, utf8 } from "../crypto/bytes";
import type { ConversationLocal, StoredMessage } from "../model/types";
import type { AppState, Me, UserLite } from "../state/store";
import type { LocalStore } from "../store/db";
import type { CommunityData } from "./community";
import type { NavPrefs } from "./navPrefs";

/**
 * What this browser keeps of the app between page loads (the owner, 2026-10-30: "Yes, keep snapshot"), so a reload or a
 * return draws the last view at once, as Discord and Yapin' do, and the server's answers replace it as they arrive. One
 * snapshot, for the account signed in here: its conversations and channel lists, the communities' categories, the people
 * shown, unread and mention counts, and the newest messages of the conversations opened most recently. Sealed with an
 * AES-GCM key this browser made for it (non-extractable, kept beside it like the account tokens' key: auth/tokenVault.ts)
 * and bound to the account, so another account's never opens here. Erased with everything else on signing out, a removed
 * browser or a deleted account (LocalStore.erase); dropped quietly when it can't be read (another version, a wrong key,
 * tampering) or belongs to someone else.
 */
export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY = "snapshot";
export const SNAPSHOT_CRYPTO_KEY = "snapshotKey";
/** The most it may take on disk; past it, the oldest conversations' messages go first. */
export const SNAPSHOT_MAX_BYTES = 5 * 1024 * 1024;
/** Conversations whose messages are kept, the most recently opened first, and how many of each one's newest. */
export const SNAPSHOT_CONVERSATIONS = 12;
export const SNAPSHOT_MESSAGES = 50;
/** Changes are written once they've settled for this long (and at once when the tab is hidden or closed). */
export const SNAPSHOT_SAVE_DELAY_MS = 4000;

export interface SnapshotData {
  me: Me | null;
  server: ServerInfo | null;
  orgs: Org[];
  conversations: Conversation[];
  users: UserLite[];
  local: ConversationLocal[];
  nav: Record<string, NavPrefs>;
  communities: Record<string, CommunityData>;
  /** Conversation ids, the most recently opened first. */
  recent: string[];
  messages: Record<string, StoredMessage[]>;
}

interface Sealed {
  v: number;
  userId: string;
  at: number;
  iv: Uint8Array;
  data: Uint8Array;
}

/** The parts of the state a snapshot keeps, with the newest messages of the [recent] conversations. */
export function snapshotOf(s: AppState, recent: readonly string[]): SnapshotData {
  const kept = recent.filter((id) => s.messages[id]?.items.length && !s.messages[id]?.detached).slice(0, SNAPSHOT_CONVERSATIONS);
  return {
    me: s.me,
    server: s.server,
    orgs: s.orgs,
    conversations: Object.values(s.conversations),
    users: Object.values(s.users),
    local: Object.values(s.local),
    nav: s.nav,
    communities: s.communities,
    recent: kept,
    messages: Object.fromEntries(kept.map((id) => [id, s.messages[id]!.items.slice(-SNAPSHOT_MESSAGES)])),
  };
}

/** [s] drawn from a snapshot: what the server hasn't answered yet comes from it; anything already loaded stays. */
export function withSnapshot(s: AppState, d: SnapshotData): AppState {
  const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));
  const messages = { ...s.messages };
  for (const [id, items] of Object.entries(d.messages)) if (!messages[id] && items.length) messages[id] = { items, hasMore: true, preview: true };
  return {
    ...s,
    me: s.me ?? d.me,
    server: s.server ?? d.server,
    orgs: s.orgs.length ? s.orgs : d.orgs,
    conversations: Object.keys(s.conversations).length ? s.conversations : byId(d.conversations),
    users: { ...byId(d.users), ...s.users },
    local: { ...byId(d.local), ...s.local },
    nav: { ...d.nav, ...s.nav },
    communities: { ...d.communities, ...s.communities },
    messages,
  };
}

/** The snapshot as written: whole if it fits [maxBytes], else without the oldest conversations' messages; null if even the lists don't fit. */
export function fitSnapshot(d: SnapshotData, maxBytes = SNAPSHOT_MAX_BYTES): { data: SnapshotData; bytes: Uint8Array } | null {
  for (let keep = d.recent.length; keep >= 0; keep--) {
    const data = keep === d.recent.length ? d : withRecent(d, keep);
    const bytes = utf8(JSON.stringify(data));
    if (bytes.length <= maxBytes) return { data, bytes };
  }
  return null;
}

/** [d] keeping only its [keep] most recently opened conversations' messages. */
export function withRecent(d: SnapshotData, keep: number): SnapshotData {
  const recent = d.recent.slice(0, keep);
  return { ...d, recent, messages: Object.fromEntries(recent.map((id) => [id, d.messages[id] ?? []])) };
}

/** A rough check of what came back: the lists a snapshot always has, with the types the app relies on. */
function isSnapshot(x: unknown): x is SnapshotData {
  if (!x || typeof x !== "object") return false;
  const d = x as Partial<SnapshotData>;
  return (
    Array.isArray(d.orgs) &&
    Array.isArray(d.conversations) &&
    Array.isArray(d.users) &&
    Array.isArray(d.local) &&
    Array.isArray(d.recent) &&
    d.recent.every((id) => typeof id === "string") &&
    !!d.messages &&
    typeof d.messages === "object" &&
    Object.values(d.messages).every(Array.isArray) &&
    !!d.nav &&
    typeof d.nav === "object" &&
    !!d.communities &&
    typeof d.communities === "object"
  );
}

const isQuota = (e: unknown): boolean => e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");

/** Reads, writes and erases the sealed snapshot of [userId] in this browser's database. */
export class SnapshotVault {
  constructor(
    private readonly store: LocalStore,
    private readonly userId: string,
    private readonly maxBytes = SNAPSHOT_MAX_BYTES,
  ) {}

  private aad(): Uint8Array<ArrayBuffer> {
    return utf8(`meldiq-snapshot|${SNAPSHOT_VERSION}|${this.userId}`);
  }

  private async key(create: boolean): Promise<CryptoKey | null> {
    const existing = await this.store.getValue<CryptoKey>(SNAPSHOT_CRYPTO_KEY);
    if (existing instanceof CryptoKey) return existing;
    if (!create) return null;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await this.store.setValue(SNAPSHOT_CRYPTO_KEY, key);
    return key;
  }

  /** The snapshot, or null; one that isn't this account's, this version's, or readable with this browser's key is erased. */
  async load(): Promise<SnapshotData | null> {
    const sealed = await this.store.getValue<Sealed>(SNAPSHOT_KEY).catch(() => undefined);
    if (!sealed) return null;
    try {
      if (sealed.v !== SNAPSHOT_VERSION || sealed.userId !== this.userId) throw new Error("not this snapshot");
      const key = await this.key(false);
      if (!key) throw new Error("no key");
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy(sealed.iv), additionalData: this.aad() }, key, copy(sealed.data));
      const data: unknown = JSON.parse(fromUtf8(new Uint8Array(plain)));
      if (!isSnapshot(data)) throw new Error("unreadable");
      return data;
    } catch {
      await this.erase();
      return null;
    }
  }

  /**
   * Writes [d], within the size limit. When the browser's storage is full, the oldest conversations' messages go until it
   * fits; if nothing fits, nothing is written (and the last snapshot goes, rather than drawing a stale one later).
   */
  async save(d: SnapshotData): Promise<void> {
    const fit = fitSnapshot(d, this.maxBytes);
    if (!fit) return this.erase();
    const key = await this.key(true);
    if (!key) return;
    for (let keep = fit.data.recent.length; keep >= 0; keep--) {
      const bytes = keep === fit.data.recent.length ? fit.bytes : utf8(JSON.stringify(withRecent(fit.data, keep)));
      const iv = randomBytes(12);
      const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: this.aad() }, key, copy(bytes)));
      try {
        await this.store.setValue(SNAPSHOT_KEY, { v: SNAPSHOT_VERSION, userId: this.userId, at: Date.now(), iv, data } satisfies Sealed);
        return;
      } catch (e) {
        if (!isQuota(e)) throw e;
      }
    }
    await this.erase();
  }

  async erase(): Promise<void> {
    await this.store.deleteValue(SNAPSHOT_KEY).catch(() => undefined);
  }
}

/** The slices whose changes are worth writing down. */
const KEPT: (keyof AppState)[] = ["me", "server", "orgs", "conversations", "users", "local", "nav", "communities"];

/**
 * Keeps the snapshot current while the app runs: written once changes have settled for SNAPSHOT_SAVE_DELAY_MS, and at
 * once when the tab is hidden or closed; only after the server has answered once (never a half-loaded state), and only
 * while the session is good (not while it asks for the password, never after this browser was removed).
 */
export class SnapshotKeeper {
  private recent: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private unsubscribe: (() => void) | null = null;
  private seen: AppState | null = null;
  private saving: Promise<void> = Promise.resolve();

  constructor(
    private readonly vault: SnapshotVault,
    private readonly state: { get(): AppState; subscribe(l: () => void): () => void },
    private readonly delayMs = SNAPSHOT_SAVE_DELAY_MS,
  ) {}

  /** The snapshot to draw from, or null (none, or unreadable: then erased). */
  async restore(): Promise<SnapshotData | null> {
    const d = await this.vault.load();
    if (d) this.recent = d.recent;
    return d;
  }

  /** A conversation was opened: its messages are among the ones kept. */
  opened(id: string): void {
    this.recent = [id, ...this.recent.filter((x) => x !== id)].slice(0, SNAPSHOT_CONVERSATIONS);
    this.schedule();
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.unsubscribe = this.state.subscribe(() => {
      if (this.changed(this.state.get())) this.schedule();
    });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onHidden);
    if (typeof window !== "undefined") window.addEventListener("pagehide", this.onPageHide);
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onHidden);
    if (typeof window !== "undefined") window.removeEventListener("pagehide", this.onPageHide);
  }

  /** Writes the snapshot now (when there's something worth keeping). */
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const save = async () => {
      // Draft, timer and page-hide saves can overlap. Read the latest state when this write starts, in order.
      const s = this.state.get();
      if (this.stopped || s.phase !== "ready" || !s.synced) return;
      this.seen = s;
      await this.vault.save(snapshotOf(s, this.recent)).catch(() => undefined);
    };
    this.saving = this.saving.then(save, save);
    await this.saving;
  }

  private schedule(): void {
    if (this.stopped) return;
    if (this.timer) return; // Keep a bounded save interval even while presence/messages keep changing.
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  private changed(s: AppState): boolean {
    const was = this.seen;
    if (!was) return true;
    return KEPT.some((k) => s[k] !== was[k]) || this.recent.some((id) => s.messages[id] !== was.messages[id]);
  }

  private readonly onHidden = () => {
    if (document.visibilityState === "hidden") void this.flush();
  };

  private readonly onPageHide = () => void this.flush();
}
