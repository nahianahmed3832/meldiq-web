import { z } from "zod";
import { ApiClient, ApiError } from "../api/client";
import type { AccountSessionGrant } from "../api/accountSchemas";
import { type Call, type Conversation, type Member, type Org, type SessionGrant, zCall, zConversation, zMember, zOrg, zProfile, zServerInfo } from "../api/schemas";
import { Signals, zExperiments } from "./signals";
import { CommunitySync } from "./community";
import { paused } from "./status";
import { signInWithDevice } from "../auth/accountApi";
import { type AccountSessionEnd, AccountSession } from "../auth/accountSession";
import { TokenVault } from "../auth/tokenVault";
import { CallManager, type CallTarget } from "../call/manager";
import { callSupport } from "../call/support";
import type { MediaFactory } from "../call/types";
import { fingerprint } from "../crypto/identity";
import type { ConversationLocal, DeviceRecord, OutboxItem, PinnedIdentity, RichContent, StoredMessage } from "../model/types";
import { encodePayload, type Payload } from "../protocol/payload";
import { type Frame, RealtimeClient } from "../realtime/socket";
import { type AppState, initialState, Store, type UserLite, upsertLoaded, withMessages } from "../state/store";
import type { LocalStore } from "../store/db";
import type { EngineContext } from "./context";
import { Directory } from "./directory";
import { restoreHistory } from "./historySync";
import { Outbox, sealAndPost } from "./outbox";
import { levelOf, type NavOp, NavSync, PERSONAL, shouldNotify, workspaceOf } from "./navPrefs";
import { firstShowing, ReminderSync } from "./reminders";
import { callFrame, orgDeletedFrame, presenceFrame, typingFrame } from "./frameReducers";
import { meetingSoon } from "./workspaceC5";
import { NOTICE_TEXT } from "./inbox";
import type { Reminder } from "./reminderRules";
import { deriveReminderKey } from "../crypto/reminderKeys";
import { publicKeyFromSeed } from "../crypto/ed25519";
import { Receiver } from "./receiver";
import { CallLog } from "./callLog";
import { Compose } from "./compose";
import { ConversationLocals } from "./locals";
import { loadThreadActivity, markThreadSeen, type ThreadActivity } from "./threads";
import { preview, sendsReadReceipts } from "./rules";
import { type RevokedReason, SessionManager } from "./session";

export interface EngineOptions {
  /** API origin: "" in the browser (same origin), absolute in tests. */
  base: string;
  /** The realtime URL, e.g. wss://host/v1/ws. */
  wsUrl: string;
  createSocket?: (url: string) => WebSocket;
  /** Shows a system notification for a message that arrived off screen. */
  notify?: (title: string, body: string, conversationId: string) => void;
  /** Shows a system notification for a reminder that went off (server reminders, Later). */
  notifyReminder?: (title: string, body: string, conversationId: string | null) => void;
  /** A scheduled meeting starts in ten minutes (round 7): [roomId] is the voice room it happens in. */
  notifyMeeting?: (title: string, body: string, roomId: string | null) => void;
  /** A customer inbox event that needs someone (round 8): escalated, overdue, undelivered reply, broken account. */
  notifyInbox?: (text: string, conversationId: string | null) => void;
  /** Per-browser preferences. */
  prefs?: () => { readReceipts: boolean; typing: boolean; groupNotifications?: boolean };
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

/**
 * One linked browser's connection to its account: realtime delivery, the outbox, history restore and the state the
 * interface draws. The server stays the source of truth for everything except message content, which only devices can read.
 *
 * Size (about 870 lines, over the usual 800): this is the composition root that wires every sync piece to one state
 * tree. The pieces themselves live beside it (compose, locals, callLog, navPrefs, reminders, frameReducers, receiver,
 * outbox); what remains here is the wiring plus the few operations that need several of them at once.
 */
export class Engine implements EngineContext {
  readonly state: Store;
  readonly api: ApiClient;
  readonly directory: Directory;
  /** Orbit 2.0 account session (email and password), or the device-key session of a browser linked before 2.0. */
  readonly session: AccountSession | SessionManager;
  readonly calls: CallManager;
  /** Starred, sections, collapsed groups and notification levels, synced across the person's devices. */
  readonly nav: NavSync;
  /** Server reminders (Later › Reminders), sealed with this browser's reminder key. */
  readonly reminders: ReminderSync;
  /** Experiments and content-free analytics counts, silent unless the server turns them on (src/sync/signals.ts). */
  readonly signals: Signals;
  /** Call history lines and the recent-call log. */
  readonly callLog: CallLog;
  /** Opened communities' categories and channel lists (src/sync/community.ts). */
  readonly community: CommunitySync;
  private readonly compose: Compose;
  private readonly locals: ConversationLocals;
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

  /** This browser's device record; only its account address can change (after an account recovery, signInAgain). */
  private record: DeviceRecord;

  get device(): DeviceRecord {
    return this.record;
  }

  constructor(
    device: DeviceRecord,
    readonly store: LocalStore,
    private readonly opts: EngineOptions,
    state?: Store,
  ) {
    this.record = device;
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
        recordCall: (callId, conversationId, video) => this.callLog.recordOwn(callId, conversationId, video),
        ringAlert: opts.ringAlert,
      },
      {
        media: opts.media ?? unavailableMedia,
        supported: opts.callSupported ?? (() => !!opts.media && callSupport().ok),
        ringtone: opts.ringtone,
        ...opts.callTiming,
      },
    );
    this.locals = new ConversationLocals(store, {
      senderName: (userId) => this.state.get().users[userId]?.displayName ?? null,
      publish: (l) => this.set((s) => ({ ...s, local: { ...s.local, [l.id]: l } })),
    });
    this.compose = new Compose({
      store,
      device,
      state: () => this.state.get(),
      membersOf: (id) => this.membersOf(id),
      show: (m) => this.show(m),
      bump: (m, counts) => this.bump(m, counts),
      refreshPreview: (id) => this.refreshPreview(id),
      queue: (o) => this.queue(o),
    });
    this.callLog = new CallLog({
      api: this.api,
      store,
      me: { userId: device.userId, deviceId: device.deviceId },
      knows: (id) => !!this.state.get().conversations[id],
      declinedHere: (id) => this.calls.declinedHere(id),
      show: (m) => this.show(m),
      bump: (m) => this.bump(m, { unread: false, mention: false }),
      refreshPreview: (id) => this.refreshPreview(id),
      publish: (callLog) => this.set((s) => ({ ...s, callLog })),
    });
    this.nav = new NavSync({
      get: (path) => this.api.json("GET", path, z.unknown()),
      put: (path, body) => this.api.json("PUT", path, z.unknown(), { body }),
      load: (key) => store.getValue(key),
      save: (key, value) => store.setValue(key, value),
      publish: (nav) => {
        this.set((s) => ({ ...s, nav }));
        // Saved messages with a time get a server reminder, so they go off even with no tab open (android syncLater).
        void this.reminders?.syncLater(nav[PERSONAL]?.saved ?? []);
      },
    });
    this.reminders = new ReminderSync({
      api: this.api,
      key: () => this.record.reminders ?? null,
      available: () => this.state.get().server?.features.includes("reminders") ?? false,
      publish: (reminders) => this.set((s) => ({ ...s, reminders })),
      show: (r) => this.showReminder(r),
    });
    this.community = new CommunitySync({
      json: (method, path, schema, init) => this.api.json(method, path, schema, init),
      features: () => this.state.get().server?.features ?? [],
      loaded: (orgId) => !!this.state.get().communities[orgId],
      publish: (orgId, data) =>
        this.set((s) => {
          const communities = { ...s.communities };
          if (data) communities[orgId] = data;
          else delete communities[orgId];
          return { ...s, communities };
        }),
    });
    this.signals = new Signals({
      features: () => this.state.get().server?.features ?? [],
      getExperiments: () => this.api.json("GET", "/v1/experiments", zExperiments),
      send: async (events) => {
        await this.api.json("POST", "/v1/analytics/events", z.unknown(), { body: { platform: "web", events } });
      },
    });
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
    void this.refreshAll().then(async () => {
      await this.signals.refresh();
      this.signals.track("app.opened");
    });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.flushSignalsWhenHidden);
    this.outbox.kick();
    void this.runHistory();
  }

  private readonly flushSignalsWhenHidden = () => {
    if (document.visibilityState === "hidden") void this.signals.flush();
  };

  stop(): void {
    this.stopped = true;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.flushSignalsWhenHidden);
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

  /** Arranges a conversation on Home (starred, a section, its notification level) in its workspace's synced document. */
  arrange(conversationId: string, op: NavOp): Promise<void> {
    return this.nav.change(workspaceOf(this.state.get().conversations[conversationId]?.orgId ?? null), op);
  }

  /** Saved for later (android Home › Later): kept in the personal document, so every device of the person shows it. */
  later(op: Extract<NavOp, { op: "save" | "unsave" | "savedDone" | "remind" }>): Promise<void> {
    return this.nav.change(PERSONAL, op);
  }

  /** A reminder that went off: shown once per occurrence on this browser (the phone shows its own). */
  private async showReminder(r: Reminder): Promise<boolean> {
    if (!(await firstShowing(this.store, r))) return false;
    const title = r.content?.title ?? "Reminder";
    this.notice("info", `Reminder: ${title}`);
    this.opts.notifyReminder?.(title, r.content?.note ?? (r.content?.source === "later" ? "A message you saved for later" : "Meldiq reminder"), r.content?.ref?.conversationId ?? null);
    return true;
  }

  /**
   * Browsers set up before reminders existed have no reminder key: the recovery key (the identity seed) gives it, once.
   * The seed must be this account's; it isn't kept.
   */
  async unlockReminders(seed: Uint8Array): Promise<void> {
    if ((await publicKeyFromSeed(seed)) !== this.record.identityKey) throw new Error("That recovery key belongs to a different Meldiq account.");
    this.record = { ...this.record, reminders: await deriveReminderKey(seed, this.record.userId) };
    await this.store.saveDevice(this.record);
    await this.reminders.refresh();
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
  async signInAgain(password: string, email?: string): Promise<void> {
    if (!(this.session instanceof AccountSession)) throw new Error("This browser isn't signed in with a Meldiq account.");
    const account = this.record.account;
    try {
      await this.session.adopt(await signInWithDevice(this.opts.base, this.record, password, email));
    } catch (e) {
      if (e instanceof ApiError && (e.code === "device_revoked" || e.code === "account_disabled")) return this.revoked(e.code);
      throw e;
    }
    // The account moved to a new address (account recovery, or a change on another device): the device proof above showed
    // it's still this browser's account, so the address it signs in with from now on is the new one.
    if (account && email && email !== account.email) {
      this.record = { ...this.record, account: { ...account, email } };
      await this.store.saveDevice(this.record);
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
    const callLog = await this.callLog.load();
    this.set((s) => ({
      ...s,
      callLog,
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
        users[u.id] = { id: u.id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor, statusText: u.statusText, online: true, photoRev: u.photoRev, pronouns: u.pronouns };
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
              voiceRoom: c.voice,
              hands: [],
            };
        return {
          ...s,
          server,
          synced: true,
          me: s.me && {
            ...s.me,
            username: u.username,
            displayName: u.displayName,
            avatarColor: u.avatarColor,
            statusText: u.statusText,
            statusEmoji: u.statusEmoji,
            statusExpiresAt: u.statusExpiresAt,
            notificationsPausedUntil: u.notificationsPausedUntil,
            presenceMode: u.presenceMode,
            presenceUntil: u.presenceUntil,
            pronouns: u.pronouns,
          },
          orgs: orgs.orgs,
          conversations: Object.fromEntries(convs.conversations.map((c) => [c.id, c])),
          users,
          calls,
        };
      });
      const st = this.state.get();
      await this.store.setValue(CACHE_KEY, { orgs: st.orgs, conversations: Object.values(st.conversations), users: Object.values(st.users) });
      void this.nav.refresh([PERSONAL, ...orgs.orgs.map((o) => o.id)]);
      void this.reminders.refresh();
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
        this.set((s) => typingFrame(s, c, u, f.on === true));
        return;
      }
      case "presence": {
        const id = str(f.userId);
        if (!id) return;
        this.set((s) => presenceFrame(s, id, f.online === true, typeof f.presence === "string" ? f.presence : null));
        return;
      }
      case "connections.updated":
        this.set((s) => ({ ...s, connectionsRev: s.connectionsRev + 1 }));
        return;
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
        this.community.refreshLoaded(this.state.get().orgs.map((o) => o.id));
        return;
      case "org.applications":
      case "org.application":
      case "org.reports":
        // Ids only: open moderation pages reload (and an approved application brings the community into the list).
        this.set((s) => ({ ...s, moderationRev: s.moderationRev + 1 }));
        if (f.t === "org.application") void this.refreshAll();
        return;
      case "integration.event": {
        const id = str(f.conversationId);
        if (id) this.set((s) => ({ ...s, appEventsRev: { ...s.appEventsRev, [id]: (s.appEventsRev[id] ?? 0) + 1 } }));
        return;
      }
      case "meeting.updated":
      case "meeting.soon":
        this.set((s) => ({ ...s, meetingsRev: s.meetingsRev + 1 }));
        if (f.t === "meeting.soon" && typeof f.meetingId === "string") void meetingSoon(this, f.meetingId, this.opts.notifyMeeting);
        return;
      case "inbox.updated":
      case "inbox.escalated":
      case "inbox.overdue":
      case "inbox.delivery_failed":
      case "inbox.account_failed": {
        // Ids only: the frame never carries a customer's name or text (docs/UNIFIED_INBOX.md).
        this.set((s) => ({ ...s, inboxRev: s.inboxRev + 1 }));
        const notice = NOTICE_TEXT[f.t];
        if (notice) this.opts.notifyInbox?.(notice, str(f.conversationId) ?? null);
        return;
      }
      case "reminders.changed":
      case "reminder.due":
        await this.reminders.refresh();
        return;
      case "prefs.updated": {
        const ws = str(f.workspaceId);
        if (ws) await this.nav.refresh([ws]);
        return;
      }
      case "org.deleted": {
        const id = str(f.orgId);
        if (!id) return;
        this.set((s) => orgDeletedFrame(s, id));
        this.community.forget(id);
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
        this.set((s) => callFrame(s, call));
        if (typeof f.event === "string") void this.calls.onCallEvent(f.event, call, f as { from?: { displayName?: unknown }; reason?: unknown; action?: unknown });
        void this.callLog.upsert(call);
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
            users: {
              ...s.users,
              [u.id]: {
                id: u.id,
                username: u.username,
                displayName: u.displayName,
                avatarColor: u.avatarColor,
                statusText: u.statusText,
                online: u.online,
                photoRev: u.photoRev,
                presence: u.presence,
                pronouns: u.pronouns,
              },
            },
          })),
        )
        .catch(() => undefined)
        .finally(() => this.userFetches.delete(id));
      this.userFetches.set(id, p);
    }
    return p;
  }

  show(m: StoredMessage): void {
    this.set((s) => {
      const next = upsertLoaded(s, m);
      return m.threadRootId ? { ...next, threadRev: next.threadRev + 1 } : next;
    });
  }

  /** Threads this account takes part in, with replies not yet seen here (Activity › Thread replies). */
  threadActivity(): Promise<ThreadActivity[]> {
    return loadThreadActivity(this.store);
  }

  /** The thread was opened here: its replies so far are seen. */
  async markThreadSeen(rootId: string): Promise<void> {
    if (await markThreadSeen(this.store, rootId)) this.set((s) => ({ ...s, threadRev: s.threadRev + 1 }));
  }

  private local(id: string): Promise<ConversationLocal> {
    return this.locals.get(id);
  }

  bump(m: StoredMessage, counts: { unread: boolean; mention: boolean }): Promise<void> {
    return this.locals.bump(m, counts);
  }

  refreshPreview(conversationId: string): Promise<void> {
    return this.locals.refreshPreview(conversationId);
  }

  readElsewhere(conversationId: string, upTo: number): Promise<void> {
    return this.locals.readElsewhere(conversationId, upTo);
  }

  /** Marks a conversation read or unread on this browser only: no read receipt is sent either way (as on the phone). */
  setUnreadLocally(id: string, unread: boolean): Promise<void> {
    return this.locals.setUnread(id, unread);
  }

  /** Archives a conversation on this browser, or brings it back (local, reversible; nothing is sent). */
  setArchivedLocally(id: string, archived: boolean): Promise<void> {
    return this.locals.setArchived(id, archived);
  }

  /** A conversation's unsent text, kept with this browser's other local data (never in localStorage). */
  saveDraft(conversationId: string, text: string): Promise<void> {
    return this.locals.saveDraft(conversationId, text);
  }

  markReadSoon(conversationId: string): void {
    clearTimeout(this.readTimers.get(conversationId));
    this.readTimers.set(
      conversationId,
      setTimeout(() => void this.markRead(conversationId), 400),
    );
  }

  /**
   * A system notification for a message that arrived off screen, unless the person's synced notification level for the
   * conversation says otherwise (docs/MENTIONS.md, NOTIFICATIONS.md): "mentions" lets mentions and @everyone through,
   * "none" (muted) only a mention of them by name.
   */
  notifyIncoming(m: StoredMessage, conversation: Conversation | null, mention: "me" | "all" | null): void {
    if (!this.opts.notify) return;
    // Batch B6: a message request arrives without a notification (it waits under DMs › Message requests).
    if (conversation?.request?.incoming) return;
    const st = this.state.get();
    // Paused from the profile menu (round 3): the message arrives and counts as unread, without a notification.
    if (paused(st.me?.notificationsPausedUntil ?? null, Date.now())) return;
    if (!shouldNotify(levelOf(st.nav[workspaceOf(conversation?.orgId ?? null)], m.conversationId, conversation?.categoryId ?? null), mention)) return;
    const mentioned = mention !== null;
    // Group notifications off (android Settings › Notifications): groups and channels stay quiet; mentions still notify.
    if (conversation?.type !== "DM" && !mentioned && this.opts.prefs?.().groupNotifications === false) return;
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
    void this.syncCalls(id);
  }

  /** The conversation's calls from the server's record (catches up calls that ended while this browser was away). */
  syncCalls(conversationId: string): Promise<void> {
    return this.callLog.sync(conversationId);
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
    let l = await this.local(id);
    await this.locals.update(id, (cur) => {
      l = cur;
      return cur.unread || cur.mentions ? { ...cur, unread: 0, mentions: 0 } : null;
    });
    const conv = this.state.get().conversations[id];
    if (!conv || !sendsReadReceipts(conv.type, conv.memberCount, conv.canPost) || this.opts.prefs?.().readReceipts === false) return;
    const latest = await this.store.newestMessage(id, (m) => !m.outgoing && m.kind === "text");
    if (!latest) return;
    const upTo = latest.serverTs ?? latest.sortTs;
    // Already said by this browser, or by another device of the account (its receipt reached us as readElsewhere).
    if (Math.max(this.lastReadSent.get(id) ?? 0, l.readUpTo) >= upTo) return;
    this.lastReadSent.set(id, upTo);
    await this.locals.update(id, (cur) => ({ ...cur, readUpTo: Math.max(cur.readUpTo, upTo) }));
    await this.enqueueControl(id, { type: "read", upTo });
  }

  /** Marks a conversation read or unread on this browser only: no read receipt is sent either way (as on the phone). */
  // ───────────────────────── sending ─────────────────────────

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
  /**
   * Sends a message (sync/compose.ts). [rich]: a contact card, location or animated emoji, with its readable form in
   * [text]. [forwarded]: marked "Forwarded"; mentions aren't carried over.
   */
  sendText(
    conversationId: string,
    text: string,
    opts: { replyTo?: string; threadRoot?: string; attachments?: Payload["attachments"]; presetId?: string; rich?: RichContent | null; forwarded?: boolean } = {},
  ): Promise<string> {
    const sent = this.compose.sendText(conversationId, text, opts);
    void sent.then(
      () => this.signals.track("message.sent", { surface: opts.threadRoot ? "thread" : "channel" }),
      () => undefined,
    );
    return sent;
  }

  retry(messageId: string): Promise<void> {
    return this.compose.retry(messageId);
  }

  react(m: StoredMessage, emoji: string): Promise<void> {
    return this.compose.react(m, emoji);
  }

  edit(m: StoredMessage, text: string): Promise<void> {
    return this.compose.edit(m, text);
  }

  deleteForEveryone(m: StoredMessage): Promise<void> {
    return this.compose.deleteForEveryone(m);
  }

  vote(m: StoredMessage, choices: string[]): Promise<void> {
    return this.compose.vote(m, choices);
  }

  closePoll(m: StoredMessage): Promise<void> {
    return this.compose.closePoll(m);
  }

  setPinned(m: StoredMessage, pinned: boolean): Promise<void> {
    return this.compose.setPinned(m, pinned);
  }

  setTyping(conversationId: string, on: boolean): void {
    if (this.opts.prefs?.().typing === false) return;
    const now = Date.now();
    if (on && now - this.lastTypingAt < 2500) return;
    this.lastTypingAt = on ? now : 0;
    this.realtime.send({ t: "typing", c: conversationId, on });
  }

  private enqueueControl(conversationId: string, payload: Payload): Promise<void> {
    return this.compose.enqueueControl(conversationId, payload);
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

  private async describeConversation(id: string): Promise<CallTarget> {
    const c = await this.ensureConversation(id).catch(() => null);
    if (!c) return { title: "Call", isGroup: false, colorIndex: 0, voiceRoom: false, canModerate: false };
    if (c.type !== "DM")
      return { title: c.type === "CHANNEL" ? `#${c.name ?? "channel"}` : (c.name ?? "Group"), isGroup: true, colorIndex: 0, voiceRoom: c.voice, canModerate: c.voice && c.canManage };
    const peer = c.members?.find((m) => m.id !== this.device.userId);
    const title = (peer && (this.state.get().users[peer.id]?.displayName ?? peer.displayName)) || "Call";
    return { title, isGroup: false, colorIndex: peer?.avatarColor ?? 0, voiceRoom: false, canModerate: false };
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

  /** Text search over the messages this browser holds (the server can't search encrypted content). */
  searchFiles(query: string, limit = 50): ReturnType<LocalStore["searchFiles"]> {
    return this.store.searchFiles(query, limit);
  }

  searchPinned(query: string, limit = 50): Promise<StoredMessage[]> {
    return this.store.searchPinned(query, limit);
  }

  pinnedMessages(conversationId: string): Promise<StoredMessage[]> {
    return this.store.pinnedMessages(conversationId);
  }

  recentSent(limit: number): Promise<StoredMessage[]> {
    return this.store.recentSent(limit);
  }

  searchMessages(query: string, conversationId?: string): Promise<StoredMessage[]> {
    return this.store.searchMessages(query, conversationId ? 100 : 50, conversationId);
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
}

/** Without a media implementation (tests that don't need calls), calls can't start. */
const unavailableMedia: MediaFactory = () => {
  throw new Error("call media isn't available here");
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= 128 ? v : null;
}

function toUser(m: Member, prev?: UserLite): UserLite {
  return {
    id: m.id,
    username: m.username,
    displayName: m.displayName,
    avatarColor: m.avatarColor,
    statusText: m.statusText,
    statusEmoji: m.statusEmoji,
    notificationsPaused: m.notificationsPaused,
    online: m.online ?? prev?.online ?? null,
    photoRev: m.photoRev ?? null,
    presence: m.presence ?? prev?.presence ?? null,
    pronouns: m.pronouns ?? prev?.pronouns ?? null,
  };
}
