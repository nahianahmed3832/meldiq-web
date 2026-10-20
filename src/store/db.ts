import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { QueueItem } from "../api/schemas";
import { fromB64 } from "../crypto/bytes";
import { importX25519Public, unsealX25519 } from "../crypto/keyStorage";
import type { ConversationLocal, DeviceRecord, OutboxItem, PinnedIdentity, StoredMessage } from "../model/types";

/**
 * Everything this browser keeps, in IndexedDB on this computer (one database per origin, so per Orbit server). Key
 * material is stored as non-extractable CryptoKeys (structured clone), never as bytes. "Sign out" deletes the database.
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

export type { HeldItem, PendingControl };

export const DB_NAME = "orbit-web";
/** 2: messages indexed by thread root (Activity › Thread replies). */
const VERSION = 2;

/** The repository the sync engine reads and writes; one implementation over IndexedDB. */
export class LocalStore {
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
        // Only replies have a thread root (null isn't a key), so this index holds thread replies alone.
        if (oldVersion < 2) tx.objectStore("messages").createIndex("byThread", "threadRootId");
      },
    });
    return new LocalStore(db, name);
  }

  close(): void {
    this.db.close();
  }

  /** Closes and deletes everything this browser stored. */
  static async erase(store: LocalStore | null, name = store?.name ?? DB_NAME): Promise<void> {
    store?.close();
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
    const sealed = d.keys.sealedEncryption;
    if (!sealed) return d;
    // Stored sealed (WebKit): rebuild the session's non-extractable encryption key pair.
    const encryption = { privateKey: await unsealX25519(sealed), publicKey: await importX25519Public(fromB64(d.keys.encryptionPublic)) };
    return { ...d, keys: { ...d.keys, encryption } };
  }

  async saveDevice(d: DeviceRecord): Promise<void> {
    // A sealed encryption key is stored only in its sealed form: the browser couldn't read the CryptoKey back.
    const stored = d.keys.sealedEncryption ? { ...d, keys: { ...d.keys, encryption: null } } : d;
    await this.db.put("kv", stored, "device");
  }

  async getValue<T>(key: string): Promise<T | undefined> {
    return (await this.db.get("kv", key)) as T | undefined;
  }

  async setValue(key: string, value: unknown): Promise<void> {
    await this.db.put("kv", value, key);
  }

  async deleteValue(key: string): Promise<void> {
    await this.db.delete("kv", key);
  }

  // ───── messages ─────
  async message(id: string): Promise<StoredMessage | null> {
    return (await this.db.get("messages", id)) ?? null;
  }

  async putMessage(m: StoredMessage): Promise<void> {
    await this.db.put("messages", m);
  }

  async putMessages(list: StoredMessage[]): Promise<void> {
    const tx = this.db.transaction("messages", "readwrite");
    await Promise.all([...list.map((m) => tx.store.put(m)), tx.done]);
  }

  /** Adds [m] unless a message with its id exists. True when it was added. */
  async insertMessageIfAbsent(m: StoredMessage): Promise<boolean> {
    const tx = this.db.transaction("messages", "readwrite");
    const exists = await tx.store.get(m.id);
    if (!exists) await tx.store.put(m);
    await tx.done;
    return !exists;
  }

  /** The newest [limit] messages of a conversation before [beforeSortTs], oldest first. */
  async latestMessages(conversationId: string, limit: number, beforeSortTs = Number.MAX_SAFE_INTEGER): Promise<StoredMessage[]> {
    const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, beforeSortTs], false, true);
    const out: StoredMessage[] = [];
    let cursor = await this.db.transaction("messages").store.index("byConversation").openCursor(range, "prev");
    while (cursor && out.length < limit) {
      out.push(cursor.value);
      cursor = await cursor.continue();
    }
    return out.reverse();
  }

  /** Newest messages first, for previews: the first one [accept] takes. */
  /** Every thread reply this browser has, oldest first within each thread. */
  async threadReplies(): Promise<StoredMessage[]> {
    return (await this.db.getAllFromIndex("messages", "byThread")).sort((a, b) => a.sortTs - b.sortTs);
  }

  async newestMessage(conversationId: string, accept: (m: StoredMessage) => boolean): Promise<StoredMessage | null> {
    const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, Infinity]);
    let cursor = await this.db.transaction("messages").store.index("byConversation").openCursor(range, "prev");
    while (cursor) {
      if (accept(cursor.value)) return cursor.value;
      cursor = await cursor.continue();
    }
    return null;
  }

  async outgoingUpTo(conversationId: string, upTo: number): Promise<StoredMessage[]> {
    const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, upTo]);
    const all = await this.db.getAllFromIndex("messages", "byConversation", range);
    return all.filter((m) => m.outgoing && (m.serverTs ?? m.sortTs) <= upTo && m.status !== "READ");
  }

  /** Message text on this browser containing [query]; in one conversation when [conversationId] is given. */
  async searchMessages(query: string, limit = 50, conversationId?: string): Promise<StoredMessage[]> {
    const q = query.toLowerCase();
    const out: StoredMessage[] = [];
    const store = this.db.transaction("messages").store;
    let cursor = conversationId ? await store.index("byConversation").openCursor(IDBKeyRange.bound([conversationId, -Infinity], [conversationId, Infinity])) : await store.openCursor();
    while (cursor) {
      const m = cursor.value;
      if (!m.deleted && m.kind === "text" && m.text.toLowerCase().includes(q)) out.push(m);
      cursor = await cursor.continue();
    }
    return out.sort((a, b) => b.sortTs - a.sortTs).slice(0, limit);
  }

  /** A conversation's pinned messages kept on this browser, newest first (android round 7 pinned sheet). */
  async pinnedMessages(conversationId: string): Promise<StoredMessage[]> {
    const range = IDBKeyRange.bound([conversationId, -Infinity], [conversationId, Infinity]);
    const all = await this.db.getAllFromIndex("messages", "byConversation", range);
    return all.filter((m) => m.pinned && !m.deleted).sort((a, b) => b.sortTs - a.sortTs);
  }

  /** Your latest sent messages across conversations, thread replies aside (android Home › Drafts & sent). */
  async recentSent(limit: number): Promise<StoredMessage[]> {
    const out: StoredMessage[] = [];
    let cursor = await this.db.transaction("messages").store.openCursor();
    while (cursor) {
      const m = cursor.value;
      if (m.outgoing && !m.deleted && m.kind === "text" && !m.threadRootId && m.text) out.push(m);
      cursor = await cursor.continue();
    }
    return out.sort((a, b) => b.sortTs - a.sortTs).slice(0, limit);
  }

  // ───── conversation state ─────
  async conversation(id: string): Promise<ConversationLocal | null> {
    return (await this.db.get("conversations", id)) ?? null;
  }

  async conversations(): Promise<ConversationLocal[]> {
    return this.db.getAll("conversations");
  }

  async putConversation(c: ConversationLocal): Promise<void> {
    await this.db.put("conversations", c);
  }

  // ───── outbox ─────
  async outbox(): Promise<OutboxItem[]> {
    return this.db.getAll("outbox");
  }

  async putOutbox(o: OutboxItem): Promise<void> {
    await this.db.put("outbox", o);
  }

  async removeOutbox(messageId: string): Promise<void> {
    await this.db.delete("outbox", messageId);
  }

  // ───── identity pins ─────
  async pin(userId: string): Promise<PinnedIdentity | null> {
    return (await this.db.get("pins", userId)) ?? null;
  }

  async putPin(p: PinnedIdentity): Promise<void> {
    await this.db.put("pins", p);
  }

  async changedPins(): Promise<PinnedIdentity[]> {
    return (await this.db.getAll("pins")).filter((p) => p.changedTo !== null);
  }

  // ───── envelopes held while a sender's identity is untrusted ─────
  async hold(item: QueueItem): Promise<void> {
    await this.db.put("held", { queueId: item.id, senderUserId: item.senderUserId, item, heldAt: Date.now() });
  }

  async heldFrom(userId: string): Promise<HeldItem[]> {
    return this.db.getAllFromIndex("held", "bySender", userId);
  }

  async releaseHeld(queueId: number): Promise<void> {
    await this.db.delete("held", queueId);
  }

  // ───── controls that arrived before the message they refer to ─────
  async holdControl(c: PendingControl): Promise<void> {
    await this.db.put("pendingControls", c);
  }

  /** Takes (and removes) the controls waiting for [target], oldest first. */
  async takeControls(conversationId: string, target: string): Promise<PendingControl[]> {
    const tx = this.db.transaction("pendingControls", "readwrite");
    const list = await tx.store.index("byTarget").getAll([conversationId, target]);
    await Promise.all(list.map((c) => tx.store.delete(c.id)));
    await tx.done;
    return list.sort((a, b) => a.serverTs - b.serverTs);
  }
}
