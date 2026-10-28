import { NO_REMINDERS, type RemindersState } from "../sync/reminders";
import { initialMojo, type MojoState } from "../sync/mojo";
import type { MojoMark } from "../api/profileSchemas";
import type { Call, Conversation, Org, ServerInfo } from "../api/schemas";
import { type CallUiState, idleCall } from "../call/types";
import type { CallLogItem, ConversationLocal, PinnedIdentity, StoredMessage } from "../model/types";
import type { ConnectionState } from "../realtime/socket";
import type { NavPrefs } from "../sync/navPrefs";
import type { CommunityData } from "../sync/community";

export type Phase =
  /** Opening local data and signing in. */
  | "loading"
  /** This browser lacks what Orbit needs (WebCrypto Ed25519/X25519, IndexedDB, a secure context). */
  | "unsupported"
  /** Not linked to an account. */
  | "signedOut"
  | "ready"
  /** The account removed this browser, or the server no longer knows it. */
  | "revoked"
  /** The Orbit 2.0 account session ended (expired, signed out elsewhere, password changed): the password is needed again. Local data is kept. */
  | "reauth"
  /** Orbit is open in another tab of this browser, which holds the connection. */
  | "elsewhere";

export interface Me {
  userId: string;
  deviceId: string;
  username: string;
  displayName: string;
  identityKey: string;
  avatarColor: number;
  statusText: string | null;
  /** Round 3: your status emoji and its end time, and until when notifications are paused (from the server). */
  statusEmoji?: string | null;
  statusExpiresAt?: number | null;
  notificationsPausedUntil?: number | null;
  /** Batch B6b: your presence choice and until when; B12: your pronouns. */
  presenceMode?: "auto" | "idle" | "dnd" | "invisible" | "unknown" | null;
  presenceUntil?: number | null;
  pronouns?: string | null;
  /** API 0.45.0: your profile banner (the user panel shows it behind you). */
  profileBanner?: { kind: "jpeg" | "gif" | "webp"; rev: number } | null;
  /** This browser's device-key fingerprint, as the phone shows it. */
  deviceFingerprint: string;
  deviceName: string;
}

import type { z } from "zod";
import type { ProfileStyle, WornTag, zAvatarMedia } from "../api/profileSchemas";

export interface UserLite {
  id: string;
  username: string;
  displayName: string;
  avatarColor: number;
  statusText: string | null;
  /** Round 3: their status emoji, and whether they paused notifications (null: unknown or not visible to you). */
  statusEmoji?: string | null;
  notificationsPaused?: boolean | null;
  online: boolean | null;
  /** Batch B6b: online, idle, do not disturb or offline (null: unknown or not visible to you); B12 pronouns. */
  presence?: "online" | "idle" | "dnd" | "offline" | null;
  pronouns?: string | null;
  /** Profile photo revision (GET /v1/users/:id/photo), where their privacy setting lets this account see it. */
  photoRev?: number | null;
  /** API 0.46.0: their animated avatar, profile and name style, and the community tag they wear (from lists). */
  avatarMedia?: AvatarMedia | null;
  profileStyle?: ProfileStyle | null;
  tag?: WornTag | null;
  /** API 0.54.0: the Mojo badge they show (server docs/MOJO.md). */
  mojo?: MojoMark | null;
}
type AvatarMedia = NonNullable<z.infer<typeof zAvatarMedia>>;

export interface ConversationMessages {
  items: StoredMessage[];
  hasMore: boolean;
}

export interface HistoryState {
  status: "idle" | "running" | "done" | "error" | "unsupported";
  restored: number;
  unreadable: number;
  error: string | null;
  backup: HistoryBackupState;
}

/** This browser's own backup of its chats into the history (sync/historyUpload.ts). */
export interface HistoryBackupState {
  /** "on": it backs up; "needs-keys": set up before 2026-10-28, it needs the password once; "off": no history here. */
  mode: "on" | "needs-keys" | "off";
  /** Messages waiting to be backed up. */
  pending: number;
  lastUploadAt: number | null;
  error: string | null;
}

export interface Notice {
  id: number;
  kind: "error" | "info";
  text: string;
}

export interface AppState {
  phase: Phase;
  phaseReason: string | null;
  me: Me | null;
  server: ServerInfo | null;
  connection: ConnectionState;
  /** Conversations, workspaces and people have loaded at least once since start. */
  synced: boolean;
  orgs: Org[];
  conversations: Record<string, Conversation>;
  local: Record<string, ConversationLocal>;
  messages: Record<string, ConversationMessages>;
  users: Record<string, UserLite>;
  /** conversation → user → expiry time */
  typing: Record<string, Record<string, number>>;
  /** Live calls by conversation (from the server's call events). */
  calls: Record<string, Call>;
  /** This browser's own call, if any (call/manager.ts). */
  call: CallUiState;
  identityAlerts: PinnedIdentity[];
  history: HistoryState;
  /** Meldiq Mojo: plans, perks, Sparks and gifts (sync/mojo.ts). */
  mojo: MojoState;
  notices: Notice[];
  /** Personal navigation preferences by workspace ("personal" or an organisation id), with unsent changes applied. */
  nav: Record<string, NavPrefs>;
  /** Bumped when a thread reply arrives or a thread is seen: Activity › Thread replies reloads. */
  threadRev: number;
  /** Recent calls on this browser, newest first (Activity › Missed calls). */
  callLog: CallLogItem[];
  /** Reminders kept by the server (Later › Reminders). */
  reminders: RemindersState;
  /** Bumped on each meeting.updated / meeting.soon frame (round 7 meetings): open lists reload. */
  meetingsRev: number;
  /** Communities opened in this session: their categories and every channel the person may see (joined or not). */
  communities: Record<string, CommunityData>;
  /** Bumped when join applications or reports change (server `org.applications`, `org.application`, `org.reports`). */
  moderationRev: number;
  /** Bumped on `connections.updated` (batch B6): the connections list and profile buttons reload. */
  connectionsRev: number;
  /** Bumped on `user.updated` (API 0.28): open profiles load again, so a change shows without a refresh. */
  profilesRev: number;
}

export const initialState: AppState = {
  phase: "loading",
  phaseReason: null,
  me: null,
  server: null,
  connection: "offline",
  synced: false,
  orgs: [],
  conversations: {},
  local: {},
  messages: {},
  users: {},
  typing: {},
  calls: {},
  call: idleCall,
  identityAlerts: [],
  nav: {},
  threadRev: 0,
  callLog: [],
  reminders: NO_REMINDERS,
  meetingsRev: 0,
  communities: {},
  moderationRev: 0,
  connectionsRev: 0,
  profilesRev: 0,
  history: { status: "idle", restored: 0, unreadable: 0, error: null, backup: { mode: "off", pending: 0, lastUploadAt: null, error: null } },
  mojo: initialMojo,
  notices: [],
};

type Listener = () => void;

/** A single immutable state tree: every change makes a new object, so React can compare by reference. */
export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState = initialState) {
    this.state = initial;
  }

  get = (): AppState => this.state;

  update(fn: (s: AppState) => AppState): void {
    const next = fn(this.state);
    if (next === this.state) return;
    this.state = next;
    for (const l of [...this.listeners]) l();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

/** Returns [s] with one conversation's loaded messages replaced, kept in display order. */
export function withMessages(s: AppState, conversationId: string, items: StoredMessage[], hasMore?: boolean): AppState {
  const prev = s.messages[conversationId];
  const sorted = [...items].sort(byDisplayOrder);
  return { ...s, messages: { ...s.messages, [conversationId]: { items: sorted, hasMore: hasMore ?? prev?.hasMore ?? false } } };
}

/** Inserts or replaces one message in a loaded conversation (no-op when that conversation isn't loaded). */
export function upsertLoaded(s: AppState, m: StoredMessage): AppState {
  const prev = s.messages[m.conversationId];
  if (!prev) return s;
  const items = prev.items.some((x) => x.id === m.id) ? prev.items.map((x) => (x.id === m.id ? m : x)) : [...prev.items, m];
  return withMessages(s, m.conversationId, items);
}

export function byDisplayOrder(a: StoredMessage, b: StoredMessage): number {
  return a.sortTs - b.sortTs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
