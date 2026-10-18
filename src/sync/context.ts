import type { ApiClient } from "../api/client";
import type { Conversation } from "../api/schemas";
import type { DeviceRecord, StoredMessage } from "../model/types";
import type { Store } from "../state/store";
import type { LocalStore } from "../store/db";
import type { Directory } from "./directory";

/** What the receive pipeline, the outbox and history restore share with the engine that owns them. */
export interface EngineContext {
  readonly api: ApiClient;
  readonly store: LocalStore;
  readonly state: Store;
  readonly directory: Directory;
  readonly device: DeviceRecord;
  /** The conversation on screen while this window has focus, if any. */
  viewing(): string | null;
  /** The server's view of a conversation, fetched if this browser doesn't know it yet. Null if it isn't visible to us. */
  ensureConversation(id: string): Promise<Conversation | null>;
  ensureUser(id: string): Promise<void>;
  /** Shows a stored message wherever its conversation is loaded. */
  show(m: StoredMessage): void;
  /** A new message: preview, activity time and (for others' messages off screen) unread and mention counts. */
  bump(m: StoredMessage, counts: { unread: boolean; mention: boolean }): Promise<void>;
  refreshPreview(conversationId: string): Promise<void>;
  /** This account read [conversationId] up to [upTo] on another device. */
  readElsewhere(conversationId: string, upTo: number): Promise<void>;
  markReadSoon(conversationId: string): void;
  notifyIncoming(m: StoredMessage, conversation: Conversation | null, mentioned: boolean): void;
  refreshIdentityAlerts(): Promise<void>;
  kickOutbox(): void;
}
