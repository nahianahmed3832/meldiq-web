import { z } from "zod";
import { ApiClient, ApiError } from "../api/client";
import type { AccountSessionGrant } from "../api/accountSchemas";
import { type Call, type Conversation, type Member, type Org, type SessionGrant, zCall, zConversation, zMember, zOrg, zProfile, zServerInfo } from "../api/schemas";
import { AccountApi } from "../auth/accountApi";
import { type AccountSessionEnd, AccountSession } from "../auth/accountSession";
import { TokenVault } from "../auth/tokenVault";
import { CallManager } from "../call/manager";
import { callSupport } from "../call/support";
import type { MediaFactory } from "../call/types";
import { canonical } from "../crypto/canonical";
import { sign } from "../crypto/ed25519";
import { fingerprint } from "../crypto/identity";
import type { ConversationLocal, DeviceRecord, OutboxItem, PinnedIdentity, StoredMessage } from "../model/types";
import { encodePayload, type Payload } from "../protocol/payload";
import { type Frame, RealtimeClient } from "../realtime/socket";
import { type AppState, initialState, Store, type UserLite, upsertLoaded, withMessages } from "../state/store";
import type { LocalStore } from "../store/db";
import type { EngineContext } from "./context";
import { Directory } from "./directory";
import { restoreHistory } from "./historySync";
import { resolveMentions } from "./mentions";
import { Outbox, sealAndPost } from "./outbox";
import { Receiver } from "./receiver";
import { applyPin, applyReaction, callEntry, preview, sendsReadReceipts } from "./rules";
import { type RevokedReason, SessionManager } from "./session";

export interface EngineOptions {
  /** API origin: "" in the browser (same origin), absolute in tests. */
  base: string;
  /** The realtime URL, e.g. wss://host/v1/ws. */
  wsUrl: string;
  createSocket?: (url: string) => WebSocket;
  /** Shows a system notification for a message that arrived off screen. */
  notify?: (title: string, body: string, conversationId: string) => void;
  /** Per-browser preferences. */
  prefs?: () => { readReceipts: boolean; typing: boolean };
  onRevoked?: (reason: RevokedReason) => void;
  /** Call media: LiveKit with frame encryption in the browser (call/livekitSession.ts); a fake in tests. */
  media?: MediaFactory;
  /** Whether this browser can encrypt call media (default: checked in the browser, false elsewhere). */
  callSupported?: () => boolean;
  ringtone?: { start(): void; stop(): void };
  /** A system notification for a ringing call while the tab isn't looked at. */
  ringAlert?: (title: string, video: boolean, conversationId: string) => void;
  /** Call timing for tests. */
  callTiming?: { keyWaitMs?: number; peerWindowMs?: number; rejoinWindowMs?: number };
}

const PAGE = 60;
const zConversations = z.object({ conversations: z.array(zConversation) });
const zOrgs = z.object({ orgs: z.array(zOrg) });
const zMembers = z.object({ members: z.array(zMember) });
const CACHE_KEY = "cache.meta";

const emptyLocal = (id: string): ConversationLocal => ({ id, unread: 0, mentions: 0, lastMessageId: null, lastPreview: null, lastSenderName: null, lastActivityAt: 0, readUpTo: 0, draft: "" });

/**
 * One linked browser's connection to its account: realtime delivery, the outbox, history restore and the state the
 * interface draws. The server stays the source of truth for everything except message content, which only devices can read.
 */
export class Engine implements EngineContext {
  readonly state: Store;
  readonly api: ApiClient;
  readonly directory: Directory;
  /** Orbit 2.0 account session (email and password), or the device-key session of a browser linked before 2.0. */
  readonly session: AccountSession | SessionManager;
  readonly calls: CallManager;
  private readonly realtime: RealtimeClient;
  private readonly receiver: Receiver;
  private readonly outbox: Outbox;
  private viewingId: string | null = null;
  private focused = true;
  private stopped = false;
  private readTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastReadSent = new Map<string, number>();
  private convFetches = new Map<string, Promise<Conversation | null>>();
  private userFetches = new Map<string, Promise<void>>();
  private members = new Map<string, Member[]>();
  private lastTypingAt = 0;
  private draftWrites = new Map<string, Promise<void>>();

  constructor(
    readonly device: DeviceRecord,
    readonly store: LocalStore,
    private readonly opts: EngineOptions,
    state?: Store,
  ) {
    this.state = state ?? new Store(initialState);
    this.session = device.account
      ? new AccountSession(opts.base, new TokenVault(store), (why) => this.accountSessionEnded(why))
      : new SessionManager(opts.base, device, (reason) => this.revoked(reason));
    this.api = new ApiClient(opts.base, this.session);
    this.directory = new Directory(this.api, store, device, (pin) => this.identityChanged(pin));
    this.receiver = new Receiver(this);
    this.outbox = new Outbox(
      this,
      (id, ts) => this.markSent(id, ts),
      (id, status, reason) => this.markFailed(id, status, reason),
    );
    this.calls = new CallManager(
      {
        api: this.api,
        state: this.state,
        me: { userId: device.userId, deviceId: device.deviceId },
        sendControlNow: (conversationId, payload) => this.sendControlNow(conversationId, payload),
        describe: (conversationId) => this.describeConversation(conversationId),
        displayName: (userId) => this.state.get().users[userId]?.displayName ?? null,
        recordCall: (callId, conversationId, video) => this.recordOwnCall(callId, conversationId, video),
        ringAlert: opts.ringAlert,
      },
      {
        media: opts.media ?? unavailableMedia,
        supported: opts.callSupported ?? (() => !!opts.media && callSupport().ok),
        ringtone: opts.ringtone,
        ...opts.callTiming,
      },
    );
    this.realtime = new RealtimeClient({
      url: opts.wsUrl,
      token: () => this.session.token(),
      onFrame: (f) => this.onFrame(f),
      onState: (connection) => this.set((s) => ({ ...s, connection })),
      onUnauthorized: () => this.session.reauthenticate(),
      createSocket: opts.createSocket,
    });
  }

  // ───────────────────────── lifecycle ─────────────────────────

  /**
   * Starts with a session just granted (linking, signing in), or else signs in again by itself: the stored account session,
   * or the device key. Works offline from local data.
   */
  async start(grant?: SessionGrant | AccountSessionGrant): Promise<void> {
    this.stopped = false;
    if (grant) await this.adopt(grant);
    const me = {
      userId: this.device.userId,
      deviceId: this.device.deviceId,
      username: this.device.username,
      displayName: this.device.username,
      identityKey: this.device.identityKey,
      avatarColor: 0,
      statusText: null,
      deviceFingerprint: await fingerprint(this.device.keys.signingPublic),
      deviceName: this.device.deviceName,
    };
    await this.loadLocal();
    this.set((s) => ({ ...s, phase: "ready", me: { ...me, ...(s.me ?? {}) } }));
    if (!grant && !(await this.session.reauthenticate())) {
      const phase = this.state.get().phase;
      if (phase === "revoked" || phase === "reauth") return;
    }
    this.realtime.start();
    void this.refreshAll();
    this.outbox.kick();
    void this.runHistory();
  }

  stop(): void {
    this.stopped = true;
    this.calls.stop();
    this.realtime.stop();
    this.outbox.stop();
    for (const t of this.readTimers.values()) clearTimeout(t);
  }

  /** Connects again now instead of waiting for the next backoff step ("Reconnect now"). */
  reconnect(): void {
    this.realtime.reconnectNow();
    this.outbox.kick();
  }

  /** Resolves once received frames and queued sends have settled (tests). */
  async idle(): Promise<void> {
    await this.realtime.idle();
    await this.outbox.settle();
  }

  private set(fn: (s: AppState) => AppState): void {
    this.state.update(fn);
  }

  notice(kind: "error" | "info", text: string): void {
    const id = Date.now() + Math.random();
    this.set((s) => ({ ...s, notices: [...s.notices.slice(-3), { id, kind, text }] }));
  }

  dismissNotice(id: number): void {
    this.set((s) => ({ ...s, notices: s.notices.filter((n) => n.id !== id) }));
  }

  /** Set while this browser signs itself out: the server closing its connection then is expected, not a removal. */
  private signingOut = false;

  setSigningOut(on: boolean): void {
    this.signingOut = on;
  }

  private async adopt(grant: SessionGrant | AccountSessionGrant): Promise<void> {
    if ("accessToken" in grant) {
      if (this.session instanceof AccountSession) await this.session.adopt(grant);
    } else if (this.session instanceof SessionManager) this.session.adopt(grant);
  }

  /** The account session can't renew itself: stop syncing and ask for the password (local data stays). */
  private accountSessionEnded(why: AccountSessionEnd): void {
    if (this.signingOut) return;
    if (why === "account_disabled") return this.revoked("account_disabled");
    this.realtime.stop();
    this.outbox.stop();
    this.set((s) => ({ ...s, phase: "reauth", phaseReason: why }));
  }

  /**
   * Signs in again after the account session ended: the password, plus proof that this browser still holds its device
   * key, so the new session is bound to this device. A removed device is told so by the server, and then erased.
   */
  async signInAgain(password: string): Promise<void> {
    const account = this.device.account;
    if (!account || !(this.session instanceof AccountSession)) throw new Error("This browser isn't signed in with an Orbit account.");
    const accounts = AccountApi.anonymous(this.opts.base);
    const nonce = await accounts.challenge();
    const signature = await sign(this.device.keys.signing.privateKey, canonical.authProof("login", nonce, this.device.keys.signingPublic));
    try {
      const grant = await accounts.login(account.email, password, this.device.deviceName, { deviceId: this.device.deviceId, nonce, signature });
      await this.session.adopt(grant);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "device_revoked" || e.code === "account_disabled")) {
        this.revoked(e.code);
        return;
      }
      throw e;
    }
    this.set((s) => ({ ...s, phase: "ready", phaseReason: null }));
    this.stopped = false;
    this.realtime.start();
    void this.refreshAll();
    this.outbox.kick();
  }

  private revoked(reason: RevokedReason): void {
    if (this.signingOut) return;
    this.stop();
    this.set((s) => ({ ...s, phase: "revoked", phaseReason: reason }));
    this.opts.onRevoked?.(reason);
  }

  private async loadLocal(): Promise<void> {
    const locals = await this.store.conversations();
    const cache = await this.store.getValue<{ orgs: Org[]; conversations: Conversation[]; users: UserLite[] }>(CACHE_KEY);
    const pins = await this.store.changedPins();
    this.set((s) => ({
      ...s,
      local: Object.fromEntries(locals.map((l) => [l.id, l])),
      orgs: cache?.orgs ?? s.orgs,
      conversations: cache ? Object.fromEntries(cache.conversations.map((c) => [c.id, c])) : s.conversations,
      users: cache ? Object.fromEntries(cache.users.map((u) => [u.id, u])) : s.users,
      identityAlerts: pins,
    }));
  }

  /** Server info, profile, workspaces and conversations: on start and after every reconnect (what changed while away). */
  async refreshAll(): Promise<void> {
    try {
      const [server, meRes, orgs, convs] = await Promise.all([
        this.api.json("GET", "/v1/server-info", zServerInfo, { auth: false }),
        this.api.json("GET", "/v1/users/me", z.object({ user: zProfile })),
        this.api.json("GET", "/v1/orgs", zOrgs),
        this.api.json("GET", "/v1/conversations", zConversations),
      ]);
      const u = meRes.user;
      this.set((s) => {
        const users = { ...s.users };
        for (const c of convs.conversations) for (const m of c.members ?? []) users[m.id] = toUser(m, users[m.id]);
        users[u.id] = { id: u.id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: u.statusText, online: true };
        const calls: Record<string, Call> = {};
        for (const c of convs.conversations)
          if (c.activeCall)
            calls[c.id] = {
              id: c.activeCall.id,
              conversationId: c.id,
              createdBy: "",
              video: c.activeCall.video,
              state: c.activeCall.state,
              createdAt: c.activeCall.startedAt,
              endedAt: null,
              endReason: null,
            };
        return {
          ...s,
          server,
          synced: true,
          me: s.me && { ...s.me, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: u.statusText },
          orgs: orgs.orgs,
          conversations: Object.fromEntries(convs.conversations.map((c) => [c.id, c])),
          users,
          calls,
        };
      });
      const st = this.state.get();
      await this.store.setValue(CACHE_KEY, { orgs: st.orgs, conversations: Object.values(st.conversations), users: Object.values(st.users) });
    } catch (e) {
      if (!(e instanceof ApiError && e.isNetwork)) this.notice("error", e instanceof ApiError ? e.message : "Couldn't load your conversations.");
    }
  }

  private async runHistory(): Promise<void> {
    if (!this.device.history) return;
    this.set((s) => ({ ...s, history: { ...s.history, status: "running", error: null } }));
    try {
      const r = await restoreHistory(this, (p) => this.set((s) => ({ ...s, history: { ...s.history, ...p } })));
      this.set((s) => ({ ...s, history: { status: "done", ...r, error: null } }));
    } catch (e) {
      const unsupported = e instanceof ApiError && (e.code === "history_off" || e.status === 404);
      this.set((s) => ({ ...s, history: { ...s.history, status: unsupported ? "unsupported" : "error", error: unsupported ? null : e instanceof ApiError ? e.message : "Couldn't restore history" } }));
    }
  }

  // ───────────────────────── realtime frames ─────────────────────────

  private async onFrame(f: Frame): Promise<void> {
    if (this.stopped) return;
    switch (f.t) {
      case "hello":
        void this.refreshAll();
        this.outbox.kick();
        return;
      case "queue": {
        const items = Array.isArray(f.items) ? (f.items as unknown[]) : [];
        const acks = await this.receiver.process(items);
        const backlog = f.backlog === true;
        if (acks.length || backlog) {
          const sent = this.realtime.send({ t: "ack", ids: acks, backlog });
          if (!sent && acks.length) await this.api.call("POST", "/v1/queue/ack", { body: { ids: acks } }).catch(() => undefined);
        }
        return;
      }
      case "typing": {
        const c = str(f.c);
        const u = str(f.u);
        if (!c || !u || u === this.device.userId) return;
        this.set((s) => {
          const cur = { ...(s.typing[c] ?? {}) };
          if (f.on === true) cur[u] = Date.now() + 6000;
          else delete cur[u];
          return { ...s, typing: { ...s.typing, [c]: cur } };
        });
        return;
      }
      case "presence": {
        const id = str(f.userId);
        if (!id) return;
        this.set((s) => (s.users[id] ? { ...s, users: { ...s.users, [id]: { ...s.users[id], online: f.online === true } } } : s));
        return;
      }
      case "conv.updated": {
        const id = str(f.conversationId);
        if (!id) return;
        this.members.delete(id);
        this.directory.invalidateConversation(id);
        await this.fetchConversation(id);
        return;
      }
      case "org.updated":
        await this.refreshAll();
        return;
      case "org.deleted": {
        const id = str(f.orgId);
        if (!id) return;
        this.set((s) => ({ ...s, orgs: s.orgs.filter((o) => o.id !== id), conversations: Object.fromEntries(Object.entries(s.conversations).filter(([, c]) => c.orgId !== id)) }));
        return;
      }
      case "devices.changed": {
        const id = str(f.userId);
        if (id) this.directory.invalidateUser(id);
        return;
      }
      case "call": {
        const parsed = zCall.safeParse(f.call);
        if (!parsed.success) return;
        const call = parsed.data;
        this.set((s) => {
          const calls = { ...s.calls };
          if (call.state === "ENDED") delete calls[call.conversationId];
          else calls[call.conversationId] = call;
          return { ...s, calls };
        });
        if (typeof f.event === "string") void this.calls.onCallEvent(f.event, call, f as { from?: { displayName?: unknown }; reason?: unknown });
        return;
      }
      case "queue.drained":
        // The backlog, and with it any call key, has arrived: look for calls that rang while this browser was away.
        void this.calls.recoverRinging();
        return;
      default:
        return;
    }
  }

  // ───────────────────────── EngineContext ─────────────────────────

  viewing(): string | null {
    return this.focused ? this.viewingId : null;
  }

  async ensureConversation(id: string): Promise<Conversation | null> {
    return this.state.get().conversations[id] ?? this.fetchConversation(id);
  }

  private fetchConversation(id: string): Promise<Conversation | null> {
    let p = this.convFetches.get(id);
    if (!p) {
      p = this.api
        .json("GET", `/v1/conversations/${encodeURIComponent(id)}`, z.object({ conversation: zConversation }))
        .then(({ conversation: c }) => {
          this.set((s) => {
            const users = { ...s.users };
            for (const m of c.members ?? []) users[m.id] = toUser(m, users[m.id]);
            return { ...s, conversations: { ...s.conversations, [c.id]: c }, users };
          });
          return c;
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
            // No longer visible to this account: it leaves the navigation (its messages stay only in this browser's store).
            this.set((s) => {
              const conversations = { ...s.conversations };
              delete conversations[id];
              return { ...s, conversations };
            });
            return null;
          }
          throw e;
        })
        .finally(() => this.convFetches.delete(id));
      this.convFetches.set(id, p);
    }
    return p;
  }

  async ensureUser(id: string): Promise<void> {
    if (this.state.get().users[id]) return;
    let p = this.userFetches.get(id);
    if (!p) {
      p = this.api
        .json("GET", `/v1/users/${encodeURIComponent(id)}`, z.object({ user: zProfile }))
        .then(({ user: u }) =>
          this.set((s) => ({
            ...s,
            users: { ...s.users, [u.id]: { id: u.id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: u.statusText, online: u.online } },
          })),
        )
        .catch(() => undefined)
        .finally(() => this.userFetches.delete(id));
      this.userFetches.set(id, p);
    }
    return p;
  }

  show(m: StoredMessage): void {
    this.set((s) => upsertLoaded(s, m));
  }

  private async local(id: string): Promise<ConversationLocal> {
    return (await this.store.conversation(id)) ?? emptyLocal(id);
  }

  private async saveLocal(l: ConversationLocal): Promise<void> {
    await this.store.putConversation(l);
    this.set((s) => ({ ...s, local: { ...s.local, [l.id]: l } }));
  }

  async bump(m: StoredMessage, counts: { unread: boolean; mention: boolean }): Promise<void> {
    const l = await this.local(m.conversationId);
    const isLatest = m.threadRootId === null && m.sortTs >= l.lastActivityAt;
    const sender = m.outgoing ? "You" : (this.state.get().users[m.senderUserId]?.displayName ?? null);
    await this.saveLocal({
      ...l,
      ...(isLatest ? { lastMessageId: m.id, lastPreview: preview(m), lastSenderName: sender, lastActivityAt: m.sortTs } : {}),
      unread: l.unread + (counts.unread ? 1 : 0),
      mentions: l.mentions + (counts.mention ? 1 : 0),
    });
  }

  async refreshPreview(conversationId: string): Promise<void> {
    const l = await this.local(conversationId);
    const last = await this.store.newestMessage(conversationId, (m) => m.threadRootId === null);
    const sender = last ? (last.outgoing ? "You" : (this.state.get().users[last.senderUserId]?.displayName ?? null)) : null;
    await this.saveLocal({ ...l, lastMessageId: last?.id ?? null, lastPreview: last ? preview(last) : null, lastSenderName: sender, lastActivityAt: Math.max(l.lastActivityAt, last?.sortTs ?? 0) });
  }

  async readElsewhere(conversationId: string, upTo: number): Promise<void> {
    const l = await this.local(conversationId);
    await this.saveLocal({ ...l, unread: 0, mentions: 0, readUpTo: Math.max(l.readUpTo, upTo) });
  }

  markReadSoon(conversationId: string): void {
    clearTimeout(this.readTimers.get(conversationId));
    this.readTimers.set(
      conversationId,
      setTimeout(() => void this.markRead(conversationId), 400),
    );
  }

  notifyIncoming(m: StoredMessage, conversation: Conversation | null, mentioned: boolean): void {
    if (!this.opts.notify) return;
    const st = this.state.get();
    const sender = st.users[m.senderUserId]?.displayName ?? "Someone";
    const title = conversation?.type === "CHANNEL" ? `#${conversation.name ?? "channel"}` : conversation?.type === "GROUP" ? (conversation.name ?? sender) : sender;
    this.opts.notify(mentioned ? `${title} · mentioned you` : title, conversation?.type === "DM" ? preview(m) : `${sender}: ${preview(m)}`, m.conversationId);
  }

  async refreshIdentityAlerts(): Promise<void> {
    const identityAlerts = await this.store.changedPins();
    this.set((s) => ({ ...s, identityAlerts }));
  }

  kickOutbox(): void {
    this.outbox.kick();
  }

  private identityChanged(pin: PinnedIdentity): void {
    this.set((s) => ({ ...s, identityAlerts: [...s.identityAlerts.filter((p) => p.userId !== pin.userId), pin] }));
  }

  private async markSent(messageId: string, serverTs: number): Promise<void> {
    const m = await this.store.message(messageId);
    if (!m) return;
    // Server time replaces the provisional local time; a receipt that arrived first keeps its newer status.
    const next: StoredMessage = { ...m, serverTs, sortTs: serverTs, status: m.status === "SENDING" || m.status === "HELD" ? "SENT" : m.status, errorText: null };
    await this.store.putMessage(next);
    this.show(next);
    await this.refreshPreview(m.conversationId);
  }

  private async markFailed(messageId: string, status: "FAILED" | "HELD", reason: string): Promise<void> {
    const m = await this.store.message(messageId);
    if (!m) return;
    const next = { ...m, status, errorText: reason };
    await this.store.putMessage(next);
    this.show(next);
  }

  // ───────────────────────── reading ─────────────────────────

  /** The conversation now on screen (null: none). Loads its newest messages and marks it read. */
  async openConversation(id: string | null): Promise<void> {
    this.viewingId = id;
    if (!id) return;
    const items = await this.store.latestMessages(id, PAGE);
    this.set((s) => withMessages(s, id, items, items.length === PAGE));
    await this.markRead(id);
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    if (focused && this.viewingId) this.markReadSoon(this.viewingId);
  }

  async loadOlder(id: string): Promise<void> {
    const loaded = this.state.get().messages[id];
    if (!loaded?.hasMore || loaded.items.length === 0) return;
    const older = await this.store.latestMessages(id, PAGE, loaded.items[0].sortTs);
    this.set((s) => withMessages(s, id, [...older, ...(s.messages[id]?.items ?? [])], older.length === PAGE));
  }

  /** Clears unread on this device and, where the phone would, tells the others with an encrypted read receipt. */
  async markRead(id: string): Promise<void> {
    const l = await this.local(id);
    if (l.unread || l.mentions) await this.saveLocal({ ...l, unread: 0, mentions: 0 });
    const conv = this.state.get().conversations[id];
    if (!conv || !sendsReadReceipts(conv.type, conv.memberCount, conv.canPost) || this.opts.prefs?.().readReceipts === false) return;
    const latest = await this.store.newestMessage(id, (m) => !m.outgoing && m.kind === "text");
    if (!latest) return;
    const upTo = latest.serverTs ?? latest.sortTs;
    // Already said by this browser, or by another device of the account (its receipt reached us as readElsewhere).
    if (Math.max(this.lastReadSent.get(id) ?? 0, l.readUpTo) >= upTo) return;
    this.lastReadSent.set(id, upTo);
    await this.saveLocal({ ...(await this.local(id)), readUpTo: upTo });
    await this.enqueueControl(id, { type: "read", upTo });
  }

  // ───────────────────────── sending ─────────────────────────

  private canPost(conversationId: string): boolean {
    return this.state.get().conversations[conversationId]?.canPost === true;
  }

  async membersOf(conversationId: string): Promise<Member[]> {
    const cached = this.members.get(conversationId);
    if (cached) return cached;
    const conv = this.state.get().conversations[conversationId];
    let list = conv?.members && conv.memberCount <= conv.members.length ? conv.members : null;
    list ??= (await this.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/members`, zMembers)).members;
    this.members.set(conversationId, list);
    return list;
  }

  /** Shows the message at once ("sending") and queues it; the outbox makes it authoritative. Returns its id. */
  async sendText(conversationId: string, text: string, opts: { replyTo?: string; threadRoot?: string; attachments?: Payload["attachments"]; presetId?: string } = {}): Promise<string> {
    const conv = this.state.get().conversations[conversationId];
    if (!conv?.canPost) throw new ApiError(403, "forbidden", conv?.archived ? "This channel is archived" : "You can't post in this conversation");
    const body = text.trim();
    const mentions = conv.type === "DM" ? { ids: [], all: false } : resolveMentions(body, await this.membersOf(conversationId).catch(() => []), conv.canMentionAll, this.device.userId);
    const payload: Payload = {
      type: "text",
      text: body,
      replyTo: opts.replyTo,
      threadRoot: opts.threadRoot,
      mentions: mentions.ids.length ? mentions.ids : undefined,
      mentionAll: mentions.all ? true : undefined,
      attachments: opts.attachments?.length ? opts.attachments : undefined,
    };
    const id = opts.presetId ?? crypto.randomUUID();
    const now = Date.now();
    const existing = await this.store.message(id);
    const m: StoredMessage = {
      id,
      conversationId,
      senderUserId: this.device.userId,
      senderDeviceId: this.device.deviceId,
      outgoing: true,
      kind: "text",
      text: body,
      replyToId: opts.replyTo ?? null,
      threadRootId: opts.threadRoot ?? null,
      mentions: mentions.ids,
      mentionAll: mentions.all,
      attachments: opts.attachments ?? [],
      sentAt: existing?.sentAt ?? now,
      serverTs: null,
      sortTs: existing?.sortTs ?? now,
      status: "SENDING",
      errorText: null,
      editedAt: null,
      deleted: false,
      pinned: false,
      reactions: {},
      readBy: [],
      deliveredTo: [],
      call: null,
      rich: null,
      forwarded: false,
    };
    await this.store.putMessage(m);
    await this.queue({
      messageId: id,
      conversationId,
      cls: "message",
      payloadJson: encodePayload(payload),
      createdAt: now,
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      visible: true,
      held: false,
    });
    this.show(m);
    await this.bump(m, { unread: false, mention: false });
    return id;
  }

  async retry(messageId: string): Promise<void> {
    const m = await this.store.message(messageId);
    if (!m || m.status !== "FAILED") return;
    await this.sendText(m.conversationId, m.text, { replyTo: m.replyToId ?? undefined, threadRoot: m.threadRootId ?? undefined, attachments: m.attachments, presetId: m.id });
  }

  async react(m: StoredMessage, emoji: string): Promise<void> {
    if (!this.canPost(m.conversationId)) return;
    const fresh = (await this.store.message(m.id)) ?? m;
    const add = !(fresh.reactions[emoji] ?? []).includes(this.device.userId);
    const next = applyReaction(fresh, this.device.userId, emoji, add);
    await this.store.putMessage(next);
    this.show(next);
    await this.enqueueControl(m.conversationId, { type: "reaction", target: m.id, emoji, add });
  }

  async edit(m: StoredMessage, text: string): Promise<void> {
    if (!m.outgoing || m.deleted || !this.canPost(m.conversationId)) return;
    const body = text.trim();
    if (!body) return;
    const conv = this.state.get().conversations[m.conversationId];
    const ids = conv && conv.type !== "DM" ? resolveMentions(body, await this.membersOf(m.conversationId).catch(() => []), false, this.device.userId).ids : [];
    const next = { ...m, text: body, editedAt: Date.now(), mentions: ids };
    await this.store.putMessage(next);
    this.show(next);
    await this.refreshPreview(m.conversationId);
    await this.enqueueControl(m.conversationId, { type: "edit", target: m.id, text: body, mentions: ids });
  }

  async deleteForEveryone(m: StoredMessage): Promise<void> {
    if (!m.outgoing || !this.canPost(m.conversationId)) return;
    const next = { ...m, deleted: true, text: "", attachments: [], rich: null };
    await this.store.putMessage(next);
    this.show(next);
    await this.refreshPreview(m.conversationId);
    await this.enqueueControl(m.conversationId, { type: "delete", target: m.id });
  }

  async setPinned(m: StoredMessage, pinned: boolean): Promise<void> {
    if (!this.canPost(m.conversationId)) return;
    const next = applyPin(m, pinned);
    await this.store.putMessage(next);
    this.show(next);
    await this.enqueueControl(m.conversationId, { type: "pin", target: m.id, pinned });
  }

  setTyping(conversationId: string, on: boolean): void {
    if (this.opts.prefs?.().typing === false) return;
    const now = Date.now();
    if (on && now - this.lastTypingAt < 2500) return;
    this.lastTypingAt = on ? now : 0;
    this.realtime.send({ t: "typing", c: conversationId, on });
  }

  private async enqueueControl(conversationId: string, payload: Payload): Promise<void> {
    await this.queue({
      messageId: crypto.randomUUID(),
      conversationId,
      cls: "control",
      payloadJson: encodePayload(payload),
      createdAt: Date.now(),
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      visible: false,
      held: false,
    });
  }

  /**
   * Seals and posts a control message at once, without the outbox: it is never written to storage, so a call's media
   * key stays in memory. One retry for a passing network or server problem; after that the call fails visibly.
   */
  async sendControlNow(conversationId: string, payload: Payload): Promise<void> {
    const o = { messageId: crypto.randomUUID(), conversationId, cls: "control" as const, payloadJson: encodePayload(payload), sentAt: Date.now() };
    try {
      await sealAndPost(this, o);
    } catch (e) {
      if (!(e instanceof ApiError && e.isTransient)) throw e;
      await new Promise((r) => setTimeout(r, 1_000));
      await sealAndPost(this, o, true);
    }
  }

  private async describeConversation(id: string): Promise<{ title: string; isGroup: boolean; colorIndex: number }> {
    const c = await this.ensureConversation(id).catch(() => null);
    if (!c) return { title: "Call", isGroup: false, colorIndex: 0 };
    if (c.type !== "DM") return { title: c.type === "CHANNEL" ? `#${c.name ?? "channel"}` : (c.name ?? "Group"), isGroup: true, colorIndex: 0 };
    const peer = c.members?.find((m) => m.id !== this.device.userId);
    return { title: (peer && (this.state.get().users[peer.id]?.displayName ?? peer.displayName)) || "Call", isGroup: false, colorIndex: peer?.avatarColor ?? 0 };
  }

  /** The conversation entry for a call this browser started (others' entries come with their `call_invite`). */
  private async recordOwnCall(callId: string, conversationId: string, video: boolean): Promise<void> {
    const now = Date.now();
    const item = {
      id: 0,
      kind: "envelope" as const,
      conversationId,
      messageId: `call-${callId}`,
      senderUserId: this.device.userId,
      senderDeviceId: this.device.deviceId,
      createdAt: now,
      expiresAt: now,
      payload: { cls: "control" as const, serverTs: now },
    };
    const m = callEntry(item, true, callId, video, now);
    if (!(await this.store.insertMessageIfAbsent(m))) return;
    this.show(m);
    await this.bump(m, { unread: false, mention: false });
  }

  private async queue(o: OutboxItem): Promise<void> {
    await this.store.putOutbox(o);
    this.outbox.kick();
  }

  /** The person accepts [userId]'s changed identity key (the one they were shown): resumes sending and opens held messages. */
  async acceptIdentity(userId: string): Promise<void> {
    const pin = await this.store.pin(userId);
    if (!pin?.changedTo) return;
    await this.directory.acceptIdentity(userId, pin.changedTo);
    for (const o of await this.store.outbox()) {
      if (!o.held) continue;
      await this.store.putOutbox({ ...o, held: false, nextAttemptAt: 0, lastError: null });
      const m = await this.store.message(o.messageId);
      if (m && m.status === "HELD") {
        const next = { ...m, status: "SENDING" as const, errorText: null };
        await this.store.putMessage(next);
        this.show(next);
      }
    }
    await this.receiver.releaseHeld(userId);
    await this.refreshIdentityAlerts();
    this.outbox.kick();
  }

  /** A conversation's unsent text, kept with this browser's other local data (never in localStorage). */
  saveDraft(conversationId: string, text: string): Promise<void> {
    // Writes for one conversation run in order, so the last call wins (a late keystroke save can't undo "sent").
    const previous = this.draftWrites.get(conversationId) ?? Promise.resolve();
    const next = previous.then(async () => {
      const l = await this.local(conversationId);
      if (l.draft !== text) await this.saveLocal({ ...l, draft: text });
    });
    this.draftWrites.set(
      conversationId,
      next.catch(() => undefined),
    );
    return next;
  }

  /** Text search over the messages this browser holds (the server can't search encrypted content). */
  searchMessages(query: string): Promise<StoredMessage[]> {
    return this.store.searchMessages(query);
  }

  /** Up to [limit] newest messages of a conversation, for threads, pins and files. */
  conversationMessages(conversationId: string, limit = 1000): Promise<StoredMessage[]> {
    return this.store.latestMessages(conversationId, limit);
  }

  /** The identity key pinned for someone (what safety numbers are computed from), if any. */
  async pinnedIdentity(userId: string): Promise<PinnedIdentity | null> {
    return this.store.pin(userId);
  }

  async markVerified(userId: string, verified: boolean): Promise<void> {
    const pin = await this.store.pin(userId);
    if (pin) await this.store.putPin({ ...pin, verified });
  }

  private conversationsOf(s: AppState, orgId: string | null): Conversation[] {
    return Object.values(s.conversations).filter((c) => (orgId === null ? true : c.orgId === orgId));
  }

  /** For tests and the activity view: every conversation visible in a workspace. */
  conversationList(orgId: string | null = null): Conversation[] {
    return this.conversationsOf(this.state.get(), orgId);
  }
}

/** Without a media implementation (tests that don't need calls), calls can't start. */
const unavailableMedia: MediaFactory = () => {
  throw new Error("call media isn't available here");
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= 128 ? v : null;
}

function toUser(m: Member, prev?: UserLite): UserLite {
  return { id: m.id, username: m.username, displayName: m.displayName, avatarColor: m.avatarColor, statusText: m.statusText, online: m.online ?? prev?.online ?? null };
}
