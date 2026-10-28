import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { QueueItem } from "../api/schemas";
import { fromB64 } from "../crypto/bytes";
import { importEd25519Public, importX25519Public, unsealEd25519, unsealX25519 } from "../crypto/keyStorage";
import type { ConversationLocal, DeviceRecord, OutboxItem, PinnedIdentity, StoredMessage } from "../model/types";
import { forgetAllMedia } from "./mediaCache";

/**
 * What this browser keeps. Since API 0.57.0 (the owner's decision, 2026-10-28) the server stores every message and
 * serves it to each device (docs/SERVER_MESSAGES.md): the browser keeps only its sign-in on disk (the device record
 * and the account session's sealed tokens, in IndexedDB). Messages, conversations, the send queue and everything
 * else live in memory for this page and are loaded from the server again on the next one. "Sign out" deletes the disk
 * part.
 *
 * The database still has the object stores of earlier versions, which kept history on this computer: the update reads
 * them once to upload that history to the server (legacyImport.ts), then empties them.
 */

interface PendingControl {
  /** The control's own message id. */
  id: string;
  conversationId: string;
  target: string;
  senderUserId: string;
  payloadJson: string;
  serverTs: number;
  receivedAt: number;
}

interface HeldItem {
  queueId: number;
  senderUserId: string;
  item: QueueItem;
  heldAt: number;
}

interface OrbitDB extends DBSchema {
  kv: { key: string; value: unknown };
  messages: { key: string; value: StoredMessage; indexes: { byConversation: [string, number]; byThread: string } };
  conversations: { key: string; value: ConversationLocal };
  outbox: { key: string; value: OutboxItem };
  pins: { key: string; value: PinnedIdentity };
  held: { key: number; value: HeldItem; indexes: { bySender: string } };
  pendingControls: { key: string; value: PendingControl; indexes: { byTarget: [string, string] } };
}

export type { HeldItem, OrbitDB, PendingControl };

export const DB_NAME = "orbit-web";
/** 2: messages indexed by thread root. 3: server-stored messages, the old stores kept only to be uploaded once. */
const VERSION = 3;

/** The only values written to disk: this browser's device (its sign-in keys) and the account session's sealed tokens. */
const ON_DISK = new Set(["device", "accountTokenKey", "accountTokens", "legacy.imported"]);

/** The repository the sync engine reads and writes. */
export type MessageWriteListener = (ids: string[]) => void;

const newestFirst = (a: StoredMessage, b: StoredMessage) => b.sortTs - a.sortTs;
const oldestFirst = (a: StoredMessage, b: StoredMessage) => a.sortTs - b.sortTs;

export class LocalStore {
  private readonly writeListeners = new Set<MessageWriteListener>();
  private readonly memory = new Map<string, unknown>();
  private readonly messages = new Map<string, StoredMessage>();
  private readonly convs = new Map<string, ConversationLocal>();
  private readonly outboxItems = new Map<string, OutboxItem>();
  private readonly pins = new Map<string, PinnedIdentity>();
  private readonly held = new Map<number, HeldItem>();
  private readonly pendingControls = new Map<string, PendingControl>();

  private constructor(
    private readonly db: IDBPDatabase<OrbitDB>,
    readonly name: string,
  ) {}

  static async open(name = DB_NAME): Promise<LocalStore> {
    const db: IDBPDatabase<OrbitDB> = await openDB<OrbitDB>(name, VERSION, {
      // Sign-out (here or in another tab) deletes the database: an open connection must let go, or the deletion and
      // every later open wait behind it.
      blocking() {
        db.close();
      },
      upgrade(d, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          d.createObjectStore("kv");
          d.createObjectStore("messages", { keyPath: "id" }).createIndex("byConversation", ["conversationId", "sortTs"]);
          d.createObjectStore("conversations", { keyPath: "id" });
          d.createObjectStore("outbox", { keyPath: "messageId" });
          d.createObjectStore("pins", { keyPath: "userId" });
          d.createObjectStore("held", { keyPath: "queueId" }).createIndex("bySender", "senderUserId");
          d.createObjectStore("pendingControls", { keyPath: "id" }).createIndex("byTarget", ["conversationId", "target"]);
        }
        if (oldVersion < 2) tx.objectStore("messages").createIndex("byThread", "threadRootId");
      },
    });
    return new LocalStore(db, name);
  }

  /** The database itself, for the one-time upload of what earlier versions kept on this computer (legacyImport.ts). */
  get legacy(): IDBPDatabase<OrbitDB> {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  /** Closes and deletes everything this browser stored, the kept media included. */
  static async erase(store: LocalStore | null, name = store?.name ?? DB_NAME): Promise<void> {
    store?.close();
    await forgetAllMedia();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("couldn't erase local data"));
      req.onblocked = () => resolve(); // another tab still has it open: it is deleted once that tab closes it
    });
  }

  // ───── device ─────
  async device(): Promise<DeviceRecord | null> {
    const d = (await this.db.get("kv", "device")) as DeviceRecord | undefined;
    if (!d) return null;
    const { sealedEncryption, sealedSigning } = d.keys;
    // Stored sealed (WebKit's X25519; both keys where the browser lacks native Ed25519/X25519): rebuild the session's
    // non-extractable key pairs.
    const encryption = sealedEncryption ? { privateKey: await unsealX25519(sealedEncryption), publicKey: await importX25519Public(fromB64(d.keys.encryptionPublic)) } : d.keys.encryption;
    const signing = sealedSigning ? { privateKey: await unsealEd25519(sealedSigning), publicKey: await importEd25519Public(fromB64(d.keys.signingPublic)) } : d.keys.signing;
    return sealedEncryption || sealedSigning ? { ...d, keys: { ...d.keys, encryption, signing } } : d;
  }

  async saveDevice(d: DeviceRecord): Promise<void> {
    // A sealed encryption key is stored only in its sealed form: the browser couldn't read the CryptoKey back.
    // So is a sealed signing key.
    const keys = { ...d.keys, ...(d.keys.sealedEncryption ? { encryption: null } : {}), ...(d.keys.sealedSigning ? { signing: null } : {}) };
    const stored = d.keys.sealedEncryption || d.keys.sealedSigning ? { ...d, keys } : d;
    await this.db.put("kv", stored, "device");
  }

  // ───── values: the sign-in on disk, everything else for this page only ─────
  async getValue<T>(key: string): Promise<T | undefined> {
    if (ON_DISK.has(key)) return (await this.db.get("kv", key)) as T | undefined;
    return this.memory.get(key) as T | undefined;
  }

  async setValue(key: string, value: unknown): Promise<void> {
    if (ON_DISK.has(key)) await this.db.put("kv", value, key);
    else this.memory.set(key, value);
  }

  async deleteValue(key: string): Promise<void> {
    if (ON_DISK.has(key)) await this.db.delete("kv", key);
    else this.memory.delete(key);
  }

  /** Every value whose key starts with [prefix] (e.g. "transfer:"), with its key. */
  async valuesWithPrefix<T>(prefix: string): Promise<{ key: string; value: T }[]> {
    return [...this.memory].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value: value as T }));
  }

  // ───── messages (this page's copy of what the server serves) ─────
  async message(id: string): Promise<StoredMessage | null> {
    return this.messages.get(id) ?? null;
  }

  /** Hears the ids of messages written here (the send queue and views listen). */
  onMessagesWritten(listener: MessageWriteListener): () => void {
    this.writeListeners.add(listener);
    return () => this.writeListeners.delete(listener);
  }

  private written(ids: string[]): void {
    if (ids.length) for (const l of this.writeListeners) l(ids);
  }

  async putMessage(m: StoredMessage): Promise<void> {
    this.messages.set(m.id, m);
    this.written([m.id]);
  }

  async putMessages(list: StoredMessage[], opts: { fromHistory?: boolean } = {}): Promise<void> {
    for (const m of list) this.messages.set(m.id, m);
    if (!opts.fromHistory) this.written(list.map((m) => m.id));
  }

  /** Adds [m] unless a message with its id exists. True when it was added. */
  async insertMessageIfAbsent(m: StoredMessage): Promise<boolean> {
    if (this.messages.has(m.id)) return false;
    this.messages.set(m.id, m);
    this.written([m.id]);
    return true;
  }

  async messageIds(): Promise<string[]> {
    return [...this.messages.keys()];
  }

  private inConversation(conversationId: string): StoredMessage[] {
    return [...this.messages.values()].filter((m) => m.conversationId === conversationId);
  }

  /** The newest [limit] messages of a conversation before [beforeSortTs], oldest first. */
  async latestMessages(conversationId: string, limit: number, beforeSortTs = Number.MAX_SAFE_INTEGER): Promise<StoredMessage[]> {
    return this.inConversation(conversationId)
      .filter((m) => m.sortTs < beforeSortTs)
      .sort(newestFirst)
      .slice(0, limit)
      .reverse();
  }

  /** Every thread reply loaded on this page, oldest first. */
  async threadReplies(): Promise<StoredMessage[]> {
    return [...this.messages.values()].filter((m) => m.threadRootId).sort(oldestFirst);
  }

  /** Newest messages first, for previews: the first one [accept] takes. */
  async newestMessage(conversationId: string, accept: (m: StoredMessage) => boolean): Promise<StoredMessage | null> {
    return this.inConversation(conversationId).sort(newestFirst).find(accept) ?? null;
  }

  async outgoingUpTo(conversationId: string, upTo: number): Promise<StoredMessage[]> {
    return this.inConversation(conversationId).filter((m) => m.sortTs <= upTo && m.outgoing && (m.serverTs ?? m.sortTs) <= upTo && m.status !== "READ");
  }

  /** Loaded message text containing [query]; in one conversation when [conversationId] is given (the server searches the rest). */
  async searchMessages(query: string, limit = 50, conversationId?: string): Promise<StoredMessage[]> {
    const q = query.toLowerCase();
    return this.findMessages((m) => !m.deleted && m.kind === "text" && m.text.toLowerCase().includes(q), limit, conversationId);
  }

  /** Loaded messages that [match] accepts, newest first; in one conversation when [conversationId] is given. */
  async findMessages(match: (m: StoredMessage) => boolean, limit = 50, conversationId?: string): Promise<StoredMessage[]> {
    const list = conversationId ? this.inConversation(conversationId) : [...this.messages.values()];
    return list.filter(match).sort(newestFirst).slice(0, limit);
  }

  /** Loaded files whose name contains [query], newest first. */
  async searchFiles(query: string, limit: number): Promise<{ message: StoredMessage; ref: StoredMessage["attachments"][number] }[]> {
    const q = query.toLowerCase();
    const out: { message: StoredMessage; ref: StoredMessage["attachments"][number] }[] = [];
    for (const m of this.messages.values()) if (!m.deleted) for (const ref of m.attachments) if (!ref.voice && ref.name.toLowerCase().includes(q)) out.push({ message: m, ref });
    return out.sort((a, b) => b.message.sortTs - a.message.sortTs).slice(0, limit);
  }

  /** Loaded pinned messages whose text contains [query], newest first. */
  async searchPinned(query: string, limit: number): Promise<StoredMessage[]> {
    const q = query.toLowerCase();
    return this.findMessages((m) => m.pinned && !m.deleted && m.text.toLowerCase().includes(q), limit);
  }

  /** A conversation's loaded pinned messages, newest first. */
  async pinnedMessages(conversationId: string): Promise<StoredMessage[]> {
    return this.inConversation(conversationId)
      .filter((m) => m.pinned && !m.deleted)
      .sort(newestFirst);
  }

  /** Your latest sent messages loaded on this page, thread replies aside (Home › Drafts & sent). */
  async recentSent(limit: number): Promise<StoredMessage[]> {
    return this.findMessages((m) => m.outgoing && !m.deleted && m.kind === "text" && !m.threadRootId && !!m.text, limit);
  }

  // ───── conversation state ─────
  async conversation(id: string): Promise<ConversationLocal | null> {
    return this.convs.get(id) ?? null;
  }

  async conversations(): Promise<ConversationLocal[]> {
    return [...this.convs.values()];
  }

  async putConversation(c: ConversationLocal): Promise<void> {
    this.convs.set(c.id, c);
  }

  // ───── send queue (this page) ─────
  async outbox(): Promise<OutboxItem[]> {
    return [...this.outboxItems.values()];
  }

  async putOutbox(o: OutboxItem): Promise<void> {
    this.outboxItems.set(o.messageId, o);
  }

  async removeOutbox(messageId: string): Promise<void> {
    this.outboxItems.delete(messageId);
  }

  // ───── identity pins (kept for older apps' encrypted messages during the transition) ─────
  async pin(userId: string): Promise<PinnedIdentity | null> {
    return this.pins.get(userId) ?? null;
  }

  async putPin(p: PinnedIdentity): Promise<void> {
    this.pins.set(p.userId, p);
  }

  async changedPins(): Promise<PinnedIdentity[]> {
    return [...this.pins.values()].filter((p) => p.changedTo !== null);
  }

  async hold(item: QueueItem): Promise<void> {
    this.held.set(item.id, { queueId: item.id, senderUserId: item.senderUserId, item, heldAt: Date.now() });
  }

  async heldFrom(userId: string): Promise<HeldItem[]> {
    return [...this.held.values()].filter((h) => h.senderUserId === userId);
  }

  async releaseHeld(queueId: number): Promise<void> {
    this.held.delete(queueId);
  }

  // ───── controls that arrived before the message they refer to ─────
  async holdControl(c: PendingControl): Promise<void> {
    this.pendingControls.set(c.id, c);
  }

  /** Takes (and removes) the controls waiting for [target], oldest first. */
  async takeControls(conversationId: string, target: string): Promise<PendingControl[]> {
    const list = [...this.pendingControls.values()].filter((c) => c.conversationId === conversationId && c.target === target);
    for (const c of list) this.pendingControls.delete(c.id);
    return list.sort((a, b) => a.serverTs - b.serverTs);
  }
}
