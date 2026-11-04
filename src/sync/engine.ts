import { zThreadPreferences, zThreadFollowResult } from "./threadLifecycle";
import { text as uiText } from "../i18n";
import { z } from "zod";
import { zMessageCollection, type CollectionCursor, type CollectionKind } from "../api/messageCollections";
import type { MessageCollectionPage } from "./messageCollections";
import { clearExpressionCache } from "./expressions";
import { ApiClient, ApiError } from "../api/client";
import type { AccountSessionGrant } from "../api/accountSchemas";
import {
  type Call,
  type Conversation,
  type Member,
  type Org,
  type ServerInfo,
  type ServerHistoryPage,
  type SessionGrant,
  zConversation,
  zMember,
  zOrg,
  zProfile,
  zServerHistoryPage,
  zServerInfo,
  zStoredEvent,
} from "../api/schemas";
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
import type { DeviceRecord, OutboxItem, PinnedIdentity, RichContent, StoredMessage } from "../model/types";
import { encodePayload, type Payload } from "../protocol/payload";
import { RealtimeClient } from "../realtime/socket";
import type { CallPrefs } from "../call/manager";
import { type AppState, initialState, Store, type UserLite, upsertLoaded, withMessages } from "../state/store";
import { SnapshotKeeper, SnapshotVault, withSnapshot } from "./snapshot";
import type { LocalStore } from "../store/db";
import type { EngineContext } from "./context";
import { Directory } from "./directory";
import { restoreHistory } from "./historySync";
import { importLegacyHistory } from "./legacyImport";
import { MojoSync } from "./mojo";
import { HistoryUploader } from "./historyUpload";
import { canWriteHistory, deriveHistoryKeys } from "../crypto/history";
import type { HistoryBackupState } from "../state/store";
import { Outbox, sealAndPost } from "./outbox";
import { levelOf, type NavOp, NavSync, PERSONAL, shouldNotify, workspaceOf } from "./navPrefs";
import { firstShowing, ReminderSync } from "./reminders";
import { botReplyFrame, callFrame, dismissBotReply, orgDeletedFrame, presenceFrame, typingFrame } from "./frameReducers";
import { pointsCheckin } from "./points";
import { type Frame, parseFrame } from "../realtime/frames";
import { meetingSoon } from "./workspaceC5";
import type { Reminder } from "./reminderRules";
import { deriveReminderKey } from "../crypto/reminderKeys";
import { publicKeyFromSeed } from "../crypto/ed25519";
import { Receiver } from "./receiver";
import { CallLog } from "./callLog";
import { Compose } from "./compose";
import { ConversationLocals } from "./locals";
import { followedThreads, unfollowedThreads, replaceThreadPreferences, loadThreadActivity, markThreadSeen, setFollowed, type ThreadActivity } from "./threads";
import { preview, sendsReadReceipts } from "./rules";
import { type RevokedReason, SessionManager } from "./session";
import { matchesSearch, parseSearchQuery } from "./searchQuery";
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
  /** Per-browser preferences. */
  prefs?: () => {
    readReceipts: boolean;
    typing: boolean;
    groupNotifications?: boolean;
  };
  onRevoked?: (reason: RevokedReason) => void;
  /** Call media: LiveKit with frame encryption in the browser (call/livekitSession.ts); a fake in tests. */
  media?: MediaFactory;
  /** Whether this browser can encrypt call media (default: checked in the browser, false elsewhere). */
  callSupported?: () => boolean;
  ringtone?: {
    start(): void;
    stop(): void;
  };
  /** A system notification for a ringing call while the tab isn't looked at. */
  ringAlert?: (title: string, video: boolean, conversationId: string) => void;
  /** How long an action on a snapshot message waits for the server's page (LIVE_WAIT_MS; shorter in tests). */
  liveWaitMs?: number;
  /** Call timing for tests. */
  callTiming?: {
    keyWaitMs?: number;
    peerWindowMs?: number;
    rejoinWindowMs?: number;
  };
  /** Settings › Calls (batches B10, B11): noise reduction, and how this browser shares its screen. */
  callPrefs?: () => CallPrefs;
}
const PAGE = 60;
/** How long an action on a snapshot message waits for its conversation's first server page (live()). */
export const LIVE_WAIT_MS = 5000;
/** Waits shorter than this show nothing; longer ones mark the message as waiting. */
export const PENDING_AFTER_MS = 300;
export function MESSAGE_CHANGED() {
  return uiText("errors.messageChanged");
}
export function UNREACHABLE() {
  return uiText("errors.unreachable");
}
/** GET /v2/messages/search (API 0.57.0). */
const zSearchRes = z.object({
  messages: z.array(zStoredEvent),
  changes: z.array(zStoredEvent).optional(),
  more: z.boolean().optional(),
  nextCursor: z.object({ serverTs: z.number().int().positive(), id: z.string() }).nullable().optional(),
});
/** GET /v2/messages/summary (API 0.57.0). */
const zSummary = z.object({
  conversations: z.array(z.object({ conversationId: z.string(), last: zStoredEvent.nullable(), readUpTo: z.number(), unread: z.number(), mentions: z.number() })),
});
const zConversations = z.object({ conversations: z.array(zConversation) });
const zOrgs = z.object({ orgs: z.array(zOrg) });
const zMembers = z.object({ members: z.array(zMember) });
const CACHE_KEY = "cache.meta";
/**
 * One linked browser's connection to its account: realtime delivery, the outbox, history restore and the state the
 * interface draws. Current message history, membership and entitlements are server-owned; private device keys stay here.
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
  /** Meldiq Plus: plans, Sparks, gifts and badges (server docs/MOJO.md). */
  readonly mojo: MojoSync;
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
  /** Backs this browser's chats up into the account's history, once the history is available and writable here. */
  private uploader: HistoryUploader | null = null;
  private readTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Per conversation: the oldest server time loaded from its history, and whether older messages remain. */
  private readonly serverPages = new Map<
    string,
    {
      oldest: number | null;
      more: boolean;
      nextCursor?: ServerHistoryPage["nextCursor"];
    }
  >();
  private readonly olderLoads = new Map<string, Promise<void>>();
  private readonly windowVersions = new Map<string, number>();
  private openVersion = 0;
  private readingLatest = false;
  private viewReady = false;
  private summariesLoaded = false;
  private summaryLoad: Promise<void> | null = null;
  private readonly threadCountLoads = new Map<string, Promise<void>>();
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
    this.snapshots = new SnapshotKeeper(new SnapshotVault(store, device.userId), this.state);
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
        callPrefs: opts.callPrefs,
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
      confirmControl: (conversationId, payload, messageId) => sealAndPost(this, { conversationId, payloadJson: encodePayload(payload), messageId, cls: "control", sentAt: Date.now() }),
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
    this.mojo = new MojoSync({
      json: (method, path, schema, init) => this.api.json(method, path, schema, init),
      publish: (update) => this.set((s) => ({ ...s, mojo: update(s.mojo) })),
      get: () => this.state.get().mojo,
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
  /** Set by open(), taken by start(). */
  private opened: Promise<void> | null = null;
  /** The app as it was last time, kept sealed on this computer (sync/snapshot.ts). */
  readonly snapshots: SnapshotKeeper;
  /**
   * This browser's device and what this page already holds, before any network: the app's frame is drawn on it at once
   * (skeletons where the server's data goes), so a reload or a return opens like an app rather than a website loading.
   * Nothing else is shown until start() signs in and the server answers.
   */
  open(): Promise<void> {
    this.opened ??= this.openLocal();
    return this.opened;
  }
  /**
   * Starts with a session just granted (linking, signing in), or else signs in again by itself: the stored account session,
   * or the device key. Works offline from local data.
   */
  async start(grant?: SessionGrant | AccountSessionGrant): Promise<void> {
    this.stopped = false;
    this.checkedIn = false;
    if (grant) await this.adopt(grant);
    // Opened already (App draws the frame on local data first): not read twice.
    const opened = this.opened;
    this.opened = null;
    await (opened ?? this.openLocal());
    if (!grant && !(await this.session.reauthenticate())) {
      const phase = this.state.get().phase;
      if (phase === "revoked" || phase === "reauth") return;
    }
    this.realtime.start();
    this.snapshots.start();
    void this.refreshAll().then(async () => {
      void this.mojo.refresh();
      await this.signals.refresh();
      this.signals.track("app.opened");
    });
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.flushSignalsWhenHidden);
    this.outbox.kick();
    // API 0.57.0: history lives on the server. A browser that kept history before uploads it once.
    void importLegacyHistory(this)
      .then((n) => (n > 0 ? this.syncSummaries() : undefined))
      .catch(() => undefined);
  }
  private async openLocal(): Promise<void> {
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
    this.unfollowed = await unfollowedThreads(this.store);
    await this.drawSnapshot();
    // Pending work is recovered independently of the bounded app snapshot, before any network wait.
    for (const id of await this.store.messageIds()) {
      const m = await this.store.message(id);
      if (m?.outgoing && ["SENDING", "FAILED", "HELD"].includes(m.status)) this.show(m);
    }
    this.set((s) => ({ ...s, phase: "ready", me: { ...me, ...(s.me ?? {}) } }));
  }
  /**
   * The app as it was last time (sync/snapshot.ts), drawn before any network; the server's answers replace it as they
   * come. Only while this browser's session can carry on by itself: one that needs the password draws nothing.
   */
  private async drawSnapshot(): Promise<void> {
    try {
      if (this.session instanceof AccountSession && !(await this.session.restorable())) return;
      const d = await this.snapshots.restore();
      if (!d) return;
      for (const l of d.local) if (!(await this.store.conversation(l.id))) await this.store.putConversation(l);
      const drawn = Object.keys(d.messages).filter((id) => !this.state.get().messages[id]);
      this.set((s) => withSnapshot(s, d));
      for (const id of drawn) this.fromSnapshot.add(id);
    } catch {
      /* nothing kept, or unreadable: the server's answers draw everything, as on a first visit */
    }
  }
  /** Whether this session counted today's visit for points (API 0.65.0). */
  private checkedIn = false;
  /** Conversations whose messages on screen are still the snapshot's: their first server page hasn't replaced them. */
  private readonly fromSnapshot = new Set<string>();
  /** Each conversation's first server page while it loads (one load, however many ask). */
  private readonly firstPages = new Map<string, Promise<ServerHistoryPage | null>>();
  /**
   * The conversation's newest page from the server; null if unavailable. A conversation drawn from the snapshot then shows
   * the server's messages instead, and actions on its messages run against them (live()).
   */
  private firstPage(id: string): Promise<ServerHistoryPage | null> {
    const key = `${id}:${this.windowVersions.get(id) ?? 0}`;
    let p = this.firstPages.get(key);
    if (!p) {
      const version = this.windowVersions.get(id);
      p = this.fetchHistory(id, null)
        .then(async (page) => {
          if (version === this.windowVersions.get(id) && this.fromSnapshot.has(id)) {
            const items = await this.store.latestMessages(id, PAGE);
            if (version !== this.windowVersions.get(id)) return page;
            this.set((s) => withMessages(s, id, items, this.serverPages.get(id)?.more ?? items.length === PAGE));
            this.fromSnapshot.delete(id);
          }
          return page;
        })
        .catch(() => null)
        .finally(() => this.firstPages.delete(key));
      this.firstPages.set(key, p);
    }
    return p;
  }
  /** Whether [m] is one of the snapshot's, waiting for its conversation's first server page (sync check, for the UI). */
  waitsForServer(m: Pick<StoredMessage, "conversationId">): boolean {
    return this.fromSnapshot.has(m.conversationId);
  }
  /**
   * The message an action runs against (2026-10-30, the owner: actions on snapshot messages must never fail without a
   * word): at once for one the server has sent; for one drawn from the snapshot, once its conversation's first page is
   * in (at most LIVE_WAIT_MS), as the server has it. After PENDING_AFTER_MS the message shows as waiting. Throws, with
   * what to tell the person, when it can't run: the message is gone from the server's page, or the server can't be reached.
   */
  async live(m: StoredMessage): Promise<StoredMessage> {
    if (!this.fromSnapshot.has(m.conversationId)) return m;
    const pending = setTimeout(() => this.set((s) => ({ ...s, waiting: { ...s.waiting, [m.id]: true } })), PENDING_AFTER_MS);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<false>((r) => (timer = setTimeout(() => r(false), this.opts.liveWaitMs ?? LIVE_WAIT_MS)));
      const arrived = await Promise.race([this.firstPage(m.conversationId), timeout]);
      if (!arrived) throw new Error(UNREACHABLE());
      const fresh = await this.store.message(m.id);
      if (!fresh) throw new Error(MESSAGE_CHANGED());
      return fresh;
    } finally {
      clearTimeout(pending);
      clearTimeout(timer);
      if (this.state.get().waiting[m.id]) this.set((s) => ({ ...s, waiting: Object.fromEntries(Object.entries(s.waiting).filter(([k]) => k !== m.id)) }));
    }
  }
  /** live(), saying why when it can't (a notice), for actions the UI runs itself: null then. */
  async whenLive(m: StoredMessage): Promise<StoredMessage | null> {
    try {
      return await this.live(m);
    } catch (e) {
      this.notice("error", e instanceof Error ? e.message : UNREACHABLE());
      return null;
    }
  }
  /** Draft-owning controls need both the existing notice and a rejection so their editor remains open. */
  private checkedLive(m: StoredMessage): Promise<StoredMessage> {
    return this.live(m).catch((e) => {
      this.notice("error", e instanceof Error ? e.message : UNREACHABLE());
      throw e;
    });
  }
  /** Runs [action] on the message as the server has it (whenLive). */
  private async onLive(m: StoredMessage, action: (live: StoredMessage) => Promise<void>): Promise<void> {
    const live = await this.whenLive(m);
    if (live) await action(live);
  }
  private readonly flushSignalsWhenHidden = () => {
    if (document.visibilityState === "hidden") void this.signals.flush();
  };
  stop(): void {
    clearExpressionCache(this);
    this.stopped = true;
    this.snapshots.stop();
    this.uploader?.stop();
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
  expressionPreference(
    op: Extract<
      NavOp,
      {
        op: "expressionFavorite" | "expressionUsed";
      }
    >,
  ): Promise<void> {
    return this.nav.change(PERSONAL, op);
  }
  setQuickReactions(values: string[]): Promise<void> {
    return this.nav.change(PERSONAL, { op: "quickReactions", values });
  }
  quickReactionsPending(): boolean {
    return this.nav.hasPending(PERSONAL, "quickReactions");
  }
  /** Saved for later (android Home › Later): kept in the personal document, so every device of the person shows it. */
  later(
    op: Extract<
      NavOp,
      {
        op: "save" | "unsave" | "savedDone" | "remind";
      }
    >,
  ): Promise<void> {
    return this.nav.change(PERSONAL, op);
  }
  /** A reminder that went off: shown once per occurrence on this browser (the phone shows its own). */
  private async showReminder(r: Reminder): Promise<boolean> {
    if (!(await firstShowing(this.store, r))) return false;
    const title = r.content?.title ?? uiText("workspace.interface.reminder_31757bb");
    this.notice("info", uiText("workspace.interface.reminder_value0_4856197", { value0: title }));
    this.opts.notifyReminder?.(
      title,
      r.content?.note ?? (r.content?.source === "later" ? uiText("workspace.interface.a_message_you_saved_for_later_378c917") : uiText("workspace.interface.meldiq_reminder_08cb2c9")),
      r.content?.ref?.conversationId ?? null,
    );
    return true;
  }
  /**
   * Browsers set up before reminders existed have no reminder key: the recovery key (the identity seed) gives it, once.
   * The seed must be this account's; it isn't kept.
   */
  async unlockReminders(seed: Uint8Array): Promise<void> {
    if ((await publicKeyFromSeed(seed)) !== this.record.identityKey) throw new Error(uiText("workspace.interface.that_recovery_key_belongs_to_a_different_meldiq_account_5aa9171"));
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
  async signInAgain(password: string, email?: string, totpCode?: string): Promise<void> {
    if (!(this.session instanceof AccountSession)) throw new Error(uiText("auth.interface.this_browser_isn_t_signed_in_with_a_meldiq_account_e04ab65"));
    const account = this.record.account;
    try {
      await this.session.adopt(await signInWithDevice(this.opts.base, this.record, password, email, totpCode));
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
  /** A verified provider session must prove this exact account and device before unlocking its local messages. */
  async signInAgainWithProvider(grant: AccountSessionGrant): Promise<void> {
    if (!(this.session instanceof AccountSession) || grant.account.id !== this.record.account?.id || grant.session.deviceId !== this.record.deviceId)
      throw new Error(uiText("workspace.interface.sign_in_with_the_meldiq_account_that_owns_this_browser_s_messages_6182900"));
    await this.session.adopt(grant);
    await this.accountEmailChanged(grant.account.email);
    this.set((s) => ({ ...s, phase: "ready", phaseReason: null }));
    this.stopped = false;
    this.realtime.start();
    void this.refreshAll();
    this.outbox.kick();
  }
  /** The account's email changed here (Settings › My Account, API 0.46.0): sign-ins from now on use the new address. */
  async accountEmailChanged(email: string): Promise<void> {
    const account = this.record.account;
    if (!account || account.email === email) return;
    this.record = { ...this.record, account: { ...account, email } };
    await this.store.saveDevice(this.record);
  }
  private revoked(reason: RevokedReason): void {
    if (this.signingOut) return;
    this.stop();
    this.set((s) => ({ ...s, phase: "revoked", phaseReason: reason }));
    this.opts.onRevoked?.(reason);
  }
  private async loadLocal(): Promise<void> {
    const [locals, cache, pins, callLog] = await Promise.all([
      this.store.conversations(),
      this.store.getValue<{
        orgs: Org[];
        conversations: Conversation[];
        users: UserLite[];
        server?: ServerInfo | null;
      }>(CACHE_KEY),
      this.store.changedPins(),
      this.callLog.load(),
    ]);
    this.set((s) => ({
      ...s,
      callLog,
      local: Object.fromEntries(locals.map((l) => [l.id, l])),
      orgs: cache?.orgs ?? s.orgs,
      server: s.server ?? cache?.server ?? null,
      conversations: cache ? Object.fromEntries(cache.conversations.map((c) => [c.id, c])) : s.conversations,
      users: cache ? Object.fromEntries(cache.users.map((u) => [u.id, u])) : s.users,
      identityAlerts: pins,
    }));
  }
  /**
   * Someone's profile or settings changed (API 0.28 `user.updated`; reported 2026-10-23: such changes showed on other
   * devices only after a refresh). Your own: everything is loaded again, as after a reconnect. Someone else's: their
   * profile is fetched again, so the server's privacy rules decide what shows, never the frame.
   */
  private async userUpdated(userId: string): Promise<void> {
    this.directory.invalidateUser(userId);
    if (userId === this.device.userId) {
      await this.refreshAll();
    } else {
      const p = await this.api.json("GET", `/v1/users/${encodeURIComponent(userId)}`, z.object({ user: zProfile })).catch(() => null);
      if (p)
        this.set((s) => {
          const prev = s.users[userId];
          if (!prev) return s; // not someone this browser shows
          const u = p.user;
          const member = { ...u, notificationsPaused: prev.notificationsPaused ?? null, homeServer: null, role: null, orgRole: null };
          return { ...s, users: { ...s.users, [userId]: toUser(member, prev) } };
        });
    }
    this.set((s) => ({ ...s, profilesRev: s.profilesRev + 1 }));
  }
  private refreshLoad: Promise<void> | null = null;
  /** Startup and the socket's hello share one metadata refresh instead of fetching every list twice. */
  refreshAll(): Promise<void> {
    this.refreshLoad ??= this.refreshMetadata().finally(() => {
      this.refreshLoad = null;
    });
    return this.refreshLoad;
  }
  /** Server info, profile, workspaces and conversations: on start and after every reconnect (what changed while away). */
  private async refreshMetadata(): Promise<void> {
    try {
      const [server, meRes, orgs, convs] = await Promise.all([
        this.api.json("GET", "/v1/server-info", zServerInfo, { auth: false }),
        this.api.json("GET", "/v1/users/me", z.object({ user: zProfile })),
        this.api.json("GET", "/v1/orgs", zOrgs),
        this.api.json("GET", "/v1/conversations", zConversations),
      ]);
      const u = meRes.user;
      const memberships = new Set(orgs.orgs.map((o) => o.id));
      if (this.state.get().orgs.some((o) => !memberships.has(o.id))) clearExpressionCache(this);
      this.set((s) => {
        const users = { ...s.users };
        for (const c of convs.conversations) for (const m of c.members ?? []) users[m.id] = toUser(m, users[m.id]);
        users[u.id] = {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarColor: u.avatarColor,
          statusText: u.statusText,
          online: true,
          photoRev: u.photoRev,
          pronouns: u.pronouns,
          avatarMedia: u.avatarMedia,
          profileStyle: u.profileStyle,
          tag: u.tag,
          mojo: u.mojo ?? null,
        };
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
              sharing: [],
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
            profileBanner: u.profileBanner,
          },
          orgs: orgs.orgs,
          conversations: Object.fromEntries(convs.conversations.map((c) => [c.id, c])),
          users,
          calls,
        };
      });
      const st = this.state.get();
      await this.store.setValue(CACHE_KEY, { orgs: st.orgs, conversations: Object.values(st.conversations), users: Object.values(st.users), server: st.server });
      void this.nav.refresh([PERSONAL, ...orgs.orgs.map((o) => o.id)]);
      void this.reminders.refresh();
      void this.syncSummaries();
      if (server.features.includes("thread-lifecycle")) void this.refreshThreadPreferences().catch(() => undefined);
      // API 0.65.0: today's visit counts for points once a session opens (after the first load that gets through, so a
      // session that signs in again first still counts); a failure never stands in the way of anything.
      if (!this.checkedIn && server.features.includes("points")) {
        this.checkedIn = true;
        void pointsCheckin(this).catch(() => undefined);
      }
    } catch (e) {
      if (!(e instanceof ApiError && e.isNetwork)) this.notice("error", e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_load_your_conversations_92bdd13"));
    }
  }
  /** Restores what the history has and this browser doesn't ([fromStart]: reads it all again), then backs up what it holds. */
  async runHistory(fromStart = false): Promise<void> {
    if (!this.device.history) return;
    this.set((s) => ({ ...s, history: { ...s.history, status: "running", error: null } }));
    try {
      const r = await restoreHistory(this, (p) => this.set((s) => ({ ...s, history: { ...s.history, ...p } })), fromStart);
      this.set((s) => ({ ...s, history: { ...s.history, status: "done", ...r, error: null } }));
      await this.startBackup();
    } catch (e) {
      const unsupported = e instanceof ApiError && (e.code === "history_off" || e.status === 404);
      this.set((s) => ({
        ...s,
        history: {
          ...s.history,
          status: unsupported ? "unsupported" : "error",
          error: unsupported ? null : e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_restore_history_74253b4"),
        },
      }));
      // A failed download (offline) doesn't stop this browser backing up what it holds.
      if (!unsupported) await this.startBackup();
    }
  }
  /** Backs this browser's chats up into the history (historyUpload.ts), or says it needs its keys opened once. */
  private async startBackup(): Promise<void> {
    const keys = this.device.history;
    if (!keys || this.uploader || this.stopped) return;
    if (!canWriteHistory(keys)) {
      this.setBackup({ mode: "needs-keys" });
      return;
    }
    this.uploader = new HistoryUploader({
      api: this.api,
      store: this.store,
      keys,
      keepsFiles: () => this.state.get().server?.features.includes("attachment-keep") ?? false,
      onState: (b) => this.setBackup(b),
    });
    await this.uploader.start();
  }
  private setBackup(change: Partial<HistoryBackupState>): void {
    this.set((s) => ({ ...s, history: { ...s.history, backup: { ...s.history.backup, ...change } } }));
  }
  /** Sends this browser's unsent backup now (before signing out); throws if it couldn't. */
  async flushBackup(): Promise<void> {
    await this.uploader?.flush();
  }
  /**
   * Browsers set up before 2026-10-28 can read the history but not write it: the identity seed (the recovery key, or the
   * key backup opened with the password) gives them keys that can, once. The seed must be this account's; it isn't kept.
   */
  async unlockHistoryBackup(seed: Uint8Array): Promise<void> {
    if ((await publicKeyFromSeed(seed)) !== this.record.identityKey) throw new Error(uiText("workspace.interface.that_key_belongs_to_a_different_meldiq_account_d0c201f"));
    const history = await deriveHistoryKeys(seed, this.record.userId);
    this.record = { ...this.record, history, reminders: this.record.reminders ?? (await deriveReminderKey(seed, this.record.userId)) };
    await this.store.saveDevice(this.record);
    this.setBackup({ mode: "on", error: null });
    await this.startBackup();
  }
  // ───────────────────────── realtime frames ─────────────────────────
  private async onFrame(raw: Frame): Promise<void> {
    if (this.stopped) return;
    const f = parseFrame(raw);
    if (!f) return;
    switch (f.t) {
      case "hello":
        void this.refreshAll();
        this.outbox.kick();
        return;
      case "queue": {
        const acks = await this.receiver.process(f.items);
        if (acks.length || f.backlog) {
          const sent = this.realtime.send({ t: "ack", ids: acks, backlog: f.backlog });
          if (!sent && acks.length) await this.api.call("POST", "/v1/queue/ack", { body: { ids: acks } }).catch(() => undefined);
        }
        return;
      }
      case "typing":
        if (f.u === this.device.userId) return;
        this.set((s) => typingFrame(s, f.c, f.u, f.on));
        return;
      case "presence":
        this.set((s) => presenceFrame(s, f.userId, f.online, f.presence));
        return;
      case "connections.updated":
        this.set((s) => ({ ...s, connectionsRev: s.connectionsRev + 1 }));
        return;
      case "conv.updated":
        this.members.delete(f.conversationId);
        this.directory.invalidateConversation(f.conversationId);
        await this.fetchConversation(f.conversationId);
        return;
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
      case "thread.updated":
        this.set((s) => ({ ...s, threadRev: s.threadRev + 1 }));
        return;
      case "thread.preference":
        this.threadPreferenceEpoch++;
        await this.rememberThreadPreference(f.rootId, f.following);
        return;
      case "poll.updated":
        this.set((s) => ({ ...s, pollsRev: s.pollsRev + 1 }));
        break;
      case "meeting.updated":
      case "meeting.soon":
        this.set((s) => ({ ...s, meetingsRev: s.meetingsRev + 1 }));
        if (f.t === "meeting.soon" && f.meetingId) void meetingSoon(this, f.meetingId, this.opts.notifyMeeting);
        return;
      case "reminders.changed":
      case "reminder.due":
        await this.reminders.refresh();
        return;
      case "entitlements.changed":
        // A plan, a Spark or a gift changed (here or on another device): read Meldiq Plus again.
        await this.mojo.refresh();
        return;
      case "prefs.updated":
        await this.nav.refresh([f.workspaceId]);
        return;
      case "org.deleted":
        clearExpressionCache(this);
        this.set((s) => orgDeletedFrame(s, f.orgId));
        this.community.forget(f.orgId);
        return;
      case "devices.changed":
        this.directory.invalidateUser(f.userId);
        return;
      case "user.updated":
        await this.userUpdated(f.userId);
        return;
      case "call": {
        const call = f.call;
        this.set((s) => callFrame(s, call));
        if (f.event) void this.calls.onCallEvent(f.event, call, f.extra);
        void this.callLog.upsert(call);
        return;
      }
      case "queue.drained":
        // The backlog, and with it any call key, has arrived: look for calls that rang while this browser was away.
        void this.calls.recoverRinging();
        return;
      case "interaction.reply":
        this.set((s) => botReplyFrame(s, f.reply));
        return;
    }
  }
  /** Takes a bot's answer that only you saw off its conversation (API 0.65.0 batch B). */
  dismissBotReply(conversationId: string, interactionId: string): void {
    this.set((s) => dismissBotReply(s, conversationId, interactionId));
  }
  // ───────────────────────── EngineContext ─────────────────────────
  viewing(): string | null {
    return this.focused && this.readingLatest ? this.viewingId : null;
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
                // A bot that isn't in any list this browser loaded (an official bot posting in a channel) keeps its BOT tag.
                bot: u.bot,
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
    return loadThreadActivity(this.store).then((rows) => rows.filter((row) => !!this.state.get().conversations[row.conversationId]));
  }
  private unfollowed = new Set<string>();
  private threadPreferenceEpoch = 0;
  private async refreshThreadPreferences(): Promise<void> {
    const epoch = ++this.threadPreferenceEpoch;
    const all: { rootId: string; following: boolean }[] = [];
    let after: string | null = null;
    do {
      const page: { nextAfter: string | null; preferences: { rootId: string; conversationId: string; following: boolean }[] } = await this.api.json(
        "GET",
        `/v1/me/thread-preferences${after ? `?after=${encodeURIComponent(after)}` : ""}`,
        zThreadPreferences,
      );
      all.push(...page.preferences);
      after = page.nextAfter;
    } while (after && !this.stopped);
    if (this.stopped || epoch !== this.threadPreferenceEpoch) return;
    await replaceThreadPreferences(this.store, all);
    this.unfollowed = new Set(all.filter((v) => !v.following).map((v) => v.rootId));
    this.set((s) => ({ ...s, threadRev: s.threadRev + 1 }));
  }
  private async rememberThreadPreference(rootId: string, on: boolean): Promise<void> {
    await setFollowed(this.store, rootId, on);
    if (on) this.unfollowed.delete(rootId);
    else this.unfollowed.add(rootId);
    this.set((s) => ({ ...s, threadRev: s.threadRev + 1 }));
  }
  /** Community follow preferences are account-synced. Older servers and direct chats retain their local behavior. */
  async setFollowed(rootId: string, on: boolean): Promise<void> {
    const root = await this.store.message(rootId),
      conv = root ? this.state.get().conversations[root.conversationId] : null;
    if (conv?.type === "CHANNEL" && conv.orgId && this.state.get().server?.features.includes("thread-lifecycle")) {
      await this.api.json("PUT", `/v1/threads/${encodeURIComponent(rootId)}/follow`, zThreadFollowResult, { body: { following: on } });
      this.threadPreferenceEpoch++;
    }
    await this.rememberThreadPreference(rootId, on);
  }
  isFollowed(rootId: string): Promise<boolean> {
    return followedThreads(this.store).then((s) => s.has(rootId));
  }
  /** The thread was opened here: its replies so far are seen. */
  async markThreadSeen(rootId: string): Promise<void> {
    if (await markThreadSeen(this.store, rootId)) this.set((s) => ({ ...s, threadRev: s.threadRev + 1 }));
  }
  bump(
    m: StoredMessage,
    counts: {
      unread: boolean;
      mention: boolean;
    },
  ): Promise<void> {
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
  async saveDraft(conversationId: string, text: string): Promise<void> {
    await this.locals.saveDraft(conversationId, text);
    // Locals are an in-memory working set. Drafts must reach the existing sealed snapshot before a reload.
    await this.snapshots.flush();
  }
  markReadSoon(conversationId: string): void {
    clearTimeout(this.readTimers.get(conversationId));
    this.readTimers.set(
      conversationId,
      setTimeout(() => {
        this.readTimers.delete(conversationId);
        if (this.viewing() === conversationId) void this.markRead(conversationId);
      }, 400),
    );
  }
  /**
   * A system notification for a message that arrived off screen, unless the person's synced notification level for the
   * conversation says otherwise (docs/MENTIONS.md, NOTIFICATIONS.md): "mentions" lets mentions and @everyone through,
   * "none" (muted) only a mention of them by name.
   */
  notifyIncoming(m: StoredMessage, conversation: Conversation | null, mention: "me" | "all" | null): void {
    if (!this.opts.notify || (this.focused && this.viewingId === m.conversationId)) return;
    // Batch B6: a message request arrives without a notification (it waits under DMs › Message requests).
    if (conversation?.request?.incoming) return;
    if (m.threadRootId && this.unfollowed.has(m.threadRootId) && mention !== "me") return;
    const st = this.state.get();
    // Paused from the profile menu (round 3): the message arrives and counts as unread, without a notification.
    if (paused(st.me?.notificationsPausedUntil ?? null, Date.now())) return;
    if (!shouldNotify(levelOf(st.nav[workspaceOf(conversation?.orgId ?? null)], m.conversationId, conversation?.categoryId ?? null), mention)) return;
    const mentioned = mention !== null;
    // Group notifications off (android Settings › Notifications): groups and channels stay quiet; mentions still notify.
    if (conversation?.type !== "DM" && !mentioned && this.opts.prefs?.().groupNotifications === false) return;
    const sender = st.users[m.senderUserId]?.displayName ?? uiText("messaging.react_someone");
    const title = conversation?.type === "CHANNEL" ? `#${conversation.name ?? uiText("messaging.interface.channel_69e3656")}` : conversation?.type === "GROUP" ? (conversation.name ?? sender) : sender;
    this.opts.notify(
      mentioned ? uiText("workspace.interface.value0_mentioned_you_221c40d", { value0: title }) : title,
      conversation?.type === "DM" ? preview(m) : `${sender}: ${preview(m)}`,
      m.conversationId,
    );
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
  /**
   * Each conversation's newest message, read position and unread counts, from the server (API 0.57.0): the list after a
   * page load or a reconnect, when this browser keeps nothing between visits.
   */
  syncSummaries(): Promise<void> {
    this.summaryLoad ??= this.fetchSummaries().finally(() => {
      this.summaryLoad = null;
    });
    return this.summaryLoad;
  }
  private async fetchSummaries(): Promise<void> {
    const res = await this.api.json("GET", "/v2/messages/summary", zSummary).catch(() => null);
    if (!res) {
      this.summariesLoaded = true;
      return;
    }
    for (const c of res.conversations) {
      if (c.last) await this.receiver.ingest(c.last, 0, { history: true });
      await this.locals.update(c.conversationId, (l) => ({
        ...l,
        readUpTo: Math.max(l.readUpTo, c.readUpTo),
        unread: this.viewing() === c.conversationId ? 0 : c.unread,
        mentions: this.viewing() === c.conversationId ? 0 : c.mentions,
      }));
      await this.refreshPreview(c.conversationId);
    }
    this.summariesLoaded = true;
  }
  /**
   * One page of a conversation's history from the server, older than [before] (null: the newest): its messages oldest
   * first, then the changes to them, applied as live ones are. Remembers whether older ones remain.
   */
  private async fetchHistory(id: string, before: number | null, around?: string, beforeId?: string): Promise<ServerHistoryPage> {
    const version = this.windowVersions.get(id);
    const q = new URLSearchParams({ limit: String(PAGE) });
    if (before !== null) q.set("before", String(before));
    if (beforeId) q.set("beforeId", beforeId);
    if (around) q.set("around", around);
    const main = !around && this.state.get().server?.features.includes("message-collections");
    if (main) q.set("kind", "main");
    // Older around-window responses can omit nextCursor; collection requests still require a paired boundary.
    if (main && before !== null && !beforeId) q.set("beforeId", this.state.get().messages[id]?.items[0]?.id ?? "");
    // Thread traffic must not consume the main timeline's page. Around windows retain legacy message-link context.
    const page = main
      ? await this.api.json("GET", `/v2/conversations/${encodeURIComponent(id)}/message-collections?${q}`, zMessageCollection)
      : await this.api.json("GET", `/v2/conversations/${encodeURIComponent(id)}/messages?${q}`, zServerHistoryPage);
    if (around && !page.messages.some((m) => m.id === around)) throw new Error(uiText("workspace.interface.that_message_is_no_longer_available_aeb42eb"));
    for (const e of [...page.messages].reverse()) await this.receiver.ingest(e, 0, { history: true });
    for (const e of page.changes) await this.receiver.ingest(e, 0, { history: true });
    if (version === this.windowVersions.get(id)) {
      const prev = before !== null ? this.serverPages.get(id) : undefined;
      this.serverPages.set(id, { oldest: page.messages.at(-1)?.serverTs ?? prev?.oldest ?? null, more: page.more, nextCursor: page.nextCursor });
    }
    // Hydrate visible history authors together; text rendering never waits on a profile waterfall.
    void Promise.all([...new Set(page.messages.map((m) => m.senderUserId))].map((userId) => this.ensureUser(userId).catch(() => undefined)));
    return page;
  }
  /** Loads the selected conversation. Read receipts wait until its latest messages are actually in view. */
  async openConversation(id: string | null): Promise<void> {
    const opening = ++this.openVersion;
    this.viewingId = id;
    this.readingLatest = false;
    this.viewReady = false;
    if (!id) return;
    const version = (this.windowVersions.get(id) ?? 0) + 1;
    this.windowVersions.set(id, version);
    this.snapshots.opened(id);
    // Each entry owns a fresh newest window. Cached/search windows cannot initialize its viewport.
    this.set((s) => ({
      ...s,
      messages: {
        ...s.messages,
        [id]: {
          ...s.messages[id],
          items: s.messages[id]?.items ?? [],
          hasMore: false,
          opening,
          historyReady: false,
          preview: this.fromSnapshot.has(id) && !!s.messages[id]?.items.length,
          detached: false,
        },
      },
    }));
    // Fetch the selected chat alongside summaries, not after every sidebar preview is populated.
    const newestPage = this.firstPage(id);
    // Read markers must arrive before the fresh rendered window can be acknowledged.
    if (!this.summariesLoaded) await this.syncSummaries();
    if (opening !== this.openVersion || version !== this.windowVersions.get(id)) return;
    const boundary = this.state.get().local[id];
    const unreadAfter = boundary?.unread ? boundary.readUpTo : null;
    const page = await newestPage;
    if (opening !== this.openVersion || version !== this.windowVersions.get(id)) return;
    // Offline returns keep their saved messages and server-confirmation guard until a page actually arrives.
    if (!page && this.fromSnapshot.has(id)) return;
    const cached = await this.store.latestMessages(id, PAGE);
    const received = page ? await Promise.all(page.messages.map((m) => this.store.message(m.id))) : [];
    if (opening !== this.openVersion || version !== this.windowVersions.get(id)) return;
    const newest = page?.messages[0];
    const newer = (m: StoredMessage) => ["SENDING", "FAILED", "HELD"].includes(m.status) || !newest || m.sortTs > newest.serverTs || (m.sortTs === newest.serverTs && m.id > newest.id);
    const items = page ? [...received.filter((m): m is StoredMessage => !!m), ...cached.filter(newer)] : cached;
    this.fromSnapshot.delete(id);
    this.viewReady = true;
    this.set((s) => {
      const known = new Set(items.map((m) => m.id));
      const arrivals = page ? (s.messages[id]?.items.filter((m) => newer(m) && !known.has(m.id)) ?? []) : [];
      const next = withMessages(s, id, [...items, ...arrivals], page?.more ?? items.length === PAGE);
      return {
        ...next,
        messages: {
          ...next.messages,
          [id]: {
            ...next.messages[id]!,
            opening,
            unreadAfter,
            detached: false,
            historyReady: true,
            preview: false,
          },
        },
      };
    });
    void this.syncCalls(id);
  }
  /** Wait for a fresh page before deciding a snapshot's saved anchor needs a distant history window. */
  async restoreReadingAnchor(id: string, messageId: string): Promise<void> {
    await this.firstPage(id);
    if (this.viewingId !== id) return;
    if (this.state.get().messages[id]?.items.some((m) => m.id === messageId)) return;
    const latest = await this.store.latestMessages(id, PAGE);
    if (this.viewingId !== id) return;
    if (latest.some((m) => m.id === messageId)) {
      this.set((s) => withMessages(s, id, latest, this.serverPages.get(id)?.more ?? true));
      return;
    }
    await this.loadAround(id, messageId);
  }
  /** A distant result replaces the active window; unrelated cached history never fills its middle with a gap. */
  async loadAround(id: string, messageId: string): Promise<void> {
    const version = (this.windowVersions.get(id) ?? 0) + 1;
    this.windowVersions.set(id, version);
    this.readingLatest = false;
    const page = await this.fetchHistory(id, null, messageId);
    if (version !== this.windowVersions.get(id)) return;
    const messages = await Promise.all(page.messages.map((m) => this.store.message(m.id)));
    if (version !== this.windowVersions.get(id)) return;
    const items = messages.filter((m): m is StoredMessage => !!m);
    if (!items.some((m) => m.id === messageId)) throw new Error(uiText("workspace.interface.that_message_is_no_longer_available_aeb42eb"));
    this.fromSnapshot.delete(id);
    this.set((s) => {
      const next = withMessages(s, id, items, page.more);
      return { ...next, messages: { ...next.messages, [id]: { ...next.messages[id]!, detached: true, historyReady: true } } };
    });
  }
  /** Explicitly returns from a search/older window to the server's newest contiguous page. */
  async loadLatest(id: string): Promise<void> {
    const version = (this.windowVersions.get(id) ?? 0) + 1;
    this.windowVersions.set(id, version);
    const page = await this.fetchHistory(id, null);
    if (version !== this.windowVersions.get(id)) return;
    const messages = await Promise.all(page.messages.map((m) => this.store.message(m.id)));
    if (version !== this.windowVersions.get(id)) return;
    const items = messages.filter((m): m is StoredMessage => !!m);
    // Keep messages delivered while the request was in flight, too.
    const latest = await this.store.latestMessages(id, PAGE);
    if (version !== this.windowVersions.get(id)) return;
    this.fromSnapshot.delete(id);
    if (this.viewingId === id) this.viewReady = true;
    const newest = page.messages[0];
    const newer = (m: StoredMessage) => !newest || m.sortTs > newest.serverTs || (m.sortTs === newest.serverTs && m.id > newest.id);
    this.set((s) => {
      const known = new Set(items.map((m) => m.id));
      const arrivals = s.messages[id]?.items.filter((m) => newer(m) && !known.has(m.id)) ?? [];
      const next = withMessages(s, id, [...items, ...latest.filter(newer), ...arrivals], page.more);
      return { ...next, messages: { ...next.messages, [id]: { ...next.messages[id]!, detached: false, historyReady: true } } };
    });
  }
  setReadingLatest(id: string, latest: boolean): void {
    if (this.viewingId !== id || !this.viewReady) return;
    this.readingLatest = latest && !this.state.get().messages[id]?.detached;
    if (this.viewing() === id && !this.waitsForServer({ conversationId: id })) this.markReadSoon(id);
  }
  /** The conversation's calls from the server's record (catches up calls that ended while this browser was away). */
  syncCalls(conversationId: string): Promise<void> {
    return this.callLog.sync(conversationId);
  }
  setFocused(focused: boolean): void {
    this.focused = focused;
    if (focused && this.viewing()) this.markReadSoon(this.viewingId!);
  }
  loadOlder(id: string): Promise<void> {
    const version = this.windowVersions.get(id);
    const key = `${id}:${version ?? 0}`;
    const pending = this.olderLoads.get(key);
    if (pending) return pending;
    const request = this.loadOlderPage(id, version).finally(() => this.olderLoads.delete(key));
    this.olderLoads.set(key, request);
    return request;
  }
  private async loadOlderPage(id: string, version: number | undefined): Promise<void> {
    const loaded = this.state.get().messages[id];
    if (!loaded?.hasMore || loaded.items.length === 0) return;
    const first = loaded.items[0]!;
    const cursor = this.serverPages.get(id);
    try {
      const page = cursor?.more
        ? await this.fetchHistory(id, cursor.nextCursor?.serverTs ?? Math.min(cursor.oldest ?? Number.MAX_SAFE_INTEGER, first.serverTs ?? first.sortTs), undefined, cursor.nextCursor?.id)
        : null;
      if (version !== this.windowVersions.get(id)) return;
      const older = page ? (await Promise.all(page.messages.map((m) => this.store.message(m.id)))).filter((m): m is StoredMessage => !!m) : await this.store.latestMessages(id, PAGE, first);
      if (version !== this.windowVersions.get(id)) return;
      this.set((s) => withMessages(s, id, [...older, ...(s.messages[id]?.items ?? [])], page ? page.more : older.length === PAGE));
    } catch (e) {
      // Keep the cursor and retry control available after a transient failure.
      if (version === this.windowVersions.get(id)) this.notice("error", e instanceof ApiError ? e.message : uiText("workspace.interface.couldn_t_load_earlier_messages_try_again_69b7e2e"));
    }
  }
  /** Clears unread on this device and, where the phone would, tells the others with an encrypted read receipt. */
  async markRead(id: string): Promise<void> {
    // Start the in-memory message snapshot and queue the counter change before yielding. A later arrival must
    // remain behind this action in the locals queue and outside this receipt, including for "mark all read".
    const latestAtClick = this.store.newestMessage(id, (m) => !m.outgoing && m.kind === "text");
    let readUpTo = 0;
    await this.locals.update(id, (cur) => {
      readUpTo = cur.readUpTo;
      return cur.unread || cur.mentions ? { ...cur, unread: 0, mentions: 0 } : null;
    });
    const conv = this.state.get().conversations[id];
    if (!conv) return;
    const receipts = sendsReadReceipts(conv.type, conv.memberCount, conv.canPost) && this.opts.prefs?.().readReceipts !== false;
    // Channels and large groups send no read receipts; there, only this person's own devices hear about it (below).
    const selfOnly = !sendsReadReceipts(conv.type, conv.memberCount, conv.canPost) && (this.state.get().server?.features.includes("self-controls") ?? false);
    if (!receipts && !selfOnly) return;
    const latest = await latestAtClick;
    if (!latest) return;
    const upTo = latest.serverTs ?? latest.sortTs;
    // Already said by this browser, or by another device of the account (its receipt reached us as readElsewhere).
    if (Math.max(this.lastReadSent.get(id) ?? 0, readUpTo) >= upTo) return;
    this.lastReadSent.set(id, upTo);
    await this.locals.update(id, (cur) => ({ ...cur, readUpTo: Math.max(cur.readUpTo, upTo) }));
    if (receipts) return this.enqueueControl(id, { type: "read", upTo });
    await this.syncReadToOwnDevices(id, upTo);
  }
  /**
   * "Read up to here" for this person's other devices only (API 0.43.0, audience "self"), encrypted like everything
   * else, so reading a channel here clears it in their other browsers and nobody else learns what was read. Best
   * effort: not written to the outbox; the next read says it again.
   */
  private async syncReadToOwnDevices(conversationId: string, upTo: number): Promise<void> {
    const o = { messageId: crypto.randomUUID(), conversationId, cls: "control" as const, payloadJson: encodePayload({ type: "read", upTo }), sentAt: Date.now() };
    try {
      await sealAndPost(this, o, false, "self");
    } catch {
      this.lastReadSent.delete(conversationId);
    }
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
    opts: {
      replyTo?: string;
      threadRoot?: string;
      attachments?: Payload["attachments"];
      presetId?: string;
      rich?: RichContent | null;
      forwarded?: boolean;
      roleMentions?: string[];
    } = {},
  ): Promise<string> {
    // A reply to a message drawn from the snapshot goes once the server's page has it (a new message never waits).
    const target = opts.replyTo && this.fromSnapshot.has(conversationId) ? this.store.message(opts.replyTo) : null;
    const sent = target
      ? target.then(async (known) => {
          if (!known) await this.live({ id: opts.replyTo!, conversationId } as StoredMessage);
          return this.compose.sendText(conversationId, text, opts);
        })
      : this.compose.sendText(conversationId, text, opts);
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
    return this.onLive(m, (x) => this.compose.react(x, emoji));
  }
  async edit(m: StoredMessage, text: string, messageId?: string): Promise<void> {
    return this.compose.edit(await this.checkedLive(m), text, messageId);
  }
  /** [asModerator]: someone else's message, by a moderator of a community channel (community parity A1). */
  async deleteForEveryone(m: StoredMessage, asModerator = false, messageId?: string): Promise<void> {
    return this.compose.deleteForEveryone(await this.checkedLive(m), asModerator, messageId);
  }
  vote(m: StoredMessage, choices: string[], anonymous?: boolean): Promise<void> {
    return this.onLive(m, (x) => this.compose.vote(x, choices, anonymous));
  }
  closePoll(m: StoredMessage): Promise<void> {
    return this.onLive(m, (x) => this.compose.closePoll(x));
  }
  setPinned(m: StoredMessage, pinned: boolean, asModerator = false): Promise<void> {
    return this.onLive(m, (x) => this.compose.setPinned(x, pinned, asModerator)).catch((e) => this.notice("error", e instanceof Error ? e.message : String(e)));
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
      await new Promise((r) => setTimeout(r, 1000));
      await sealAndPost(this, o, true);
    }
  }
  private async describeConversation(id: string): Promise<CallTarget> {
    const c = await this.ensureConversation(id).catch(() => null);
    if (!c)
      return {
        get title() {
          return uiText("workspace.interface.call_d6e645b");
        },
        isGroup: false,
        colorIndex: 0,
        voiceRoom: false,
        canModerate: false,
      };
    if (c.type !== "DM")
      return {
        title: c.type === "CHANNEL" ? `#${c.name ?? uiText("messaging.interface.channel_69e3656")}` : (c.name ?? uiText("messaging.interface.group_34ca0e7")),
        isGroup: true,
        colorIndex: 0,
        voiceRoom: c.voice,
        canModerate: c.voice && c.canManage,
        // Voice permissions (voice.speak): a channel you may only listen in opens no microphone.
        listenOnly: c.voice && c.canSpeak === false,
      };
    const peer = c.members?.find((m) => m.id !== this.device.userId);
    const title = (peer && (this.state.get().users[peer.id]?.displayName ?? peer.displayName)) || uiText("workspace.interface.call_d6e645b");
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
  /** Messages on this browser matching [query]: words and filters (from:, has:, before:, after:; src/sync/searchQuery.ts). */
  async searchMessages(query: string, conversationId?: string): Promise<StoredMessage[]> {
    return (await this.searchMessagePage(query, conversationId)).items;
  }
  /** An independently paged search, filtered by the server before LIMIT; never changes the active history window. */
  async searchMessagePage(
    query: string,
    conversationId?: string,
    cursor: CollectionCursor | null = null,
    orgId?: string,
  ): Promise<{ items: StoredMessage[]; more: boolean; nextCursor: CollectionCursor | null }> {
    const q = parseSearchQuery(query);
    if (this.state.get().server?.features.includes("filtered-message-search")) {
      const params = new URLSearchParams({ q: q.text.trim().slice(0, 200), limit: "50" });
      if (conversationId) params.set("conversationId", conversationId);
      if (orgId) params.set("orgId", orgId);
      if (q.from) params.set("from", q.from);
      if (q.mentions) params.set("mentions", q.mentions);
      if (q.in) params.set("in", q.in);
      if (q.has.length) params.set("has", q.has.join(","));
      if (q.pinned !== undefined) params.set("pinned", String(q.pinned));
      if (q.before !== null) params.set("before", String(q.before));
      if (q.after !== null) params.set("after", String(q.after));
      if (cursor) {
        params.set("cursorTs", String(cursor.serverTs));
        params.set("cursorId", cursor.id);
      }
      const res = await this.api.json("GET", `/v2/messages/search?${params}`, zSearchRes);
      if (conversationId && res.messages.some((m) => m.conversationId !== conversationId)) throw new Error(uiText("workspace.interface.that_message_is_no_longer_available_aeb42eb"));
      if (res.more && !res.nextCursor) throw new Error(uiText("messaging.interface.couldn_t_load_messages_try_again_9068b8c"));
      for (const e of [...res.messages].reverse()) await this.receiver.ingest(e, 0, { history: true });
      const selected = new Set(res.messages.map((m) => `${m.conversationId}:${m.id}`));
      for (const e of res.changes ?? []) if (typeof e.payload.target === "string" && selected.has(`${e.conversationId}:${e.payload.target}`)) await this.receiver.ingest(e, 0, { history: true });
      const items = (await Promise.all(res.messages.map((m) => this.store.message(m.id)))).filter((m): m is StoredMessage => !!m && !m.deleted);
      void Promise.all([...new Set(items.map((m) => m.senderUserId))].map((id) => this.ensureUser(id).catch(() => undefined)));
      return { items, more: res.more === true, nextCursor: res.nextCursor ?? null };
    }
    // The server searches every message (API 0.57.0); its hits join what's loaded, then the filters apply as before.
    if (q.text.trim()) {
      const params = new URLSearchParams({ q: q.text.trim().slice(0, 200), limit: "100" });
      if (conversationId) params.set("conversationId", conversationId);
      const res = await this.api.json("GET", `/v2/messages/search?${params}`, zSearchRes);
      for (const e of res.messages) await this.receiver.ingest(e, 0, { history: true });
    }
    const sender = (m: StoredMessage) => {
      const mine = m.outgoing || m.senderUserId === this.device.userId;
      const u = this.state.get().users[m.senderUserId];
      return { name: u?.displayName ?? "", username: u?.username ?? "", me: mine };
    };
    const items = await this.store.findMessages((m) => matchesSearch(m, q, sender), conversationId ? 100 : 50, conversationId);
    return { items, more: false, nextCursor: null };
  }
  /** Recent root badges use server counts even when their replies aren't in the main timeline window. */
  refreshThreadCounts(conversationId: string): Promise<void> {
    if (!this.state.get().server?.features.includes("message-collections")) return Promise.resolve();
    const pending = this.threadCountLoads.get(conversationId);
    if (pending) return pending;
    // Preserve badges when the independent main timeline no longer contains its replies.
    // The full, paged Threads panel remains authoritative for older threads beyond this recent index.
    const request = this.api
      .json("GET", `/v2/conversations/${encodeURIComponent(conversationId)}/message-collections?kind=threads&limit=100`, zMessageCollection)
      .then((page) =>
        this.set((s) => {
          const previous = s.serverThreadCounts[conversationId] ?? {};
          const counts = page.more ? { ...previous } : Object.fromEntries(Object.keys(previous).map((id) => [id, 0]));
          for (const thread of page.threads) counts[thread.rootId] = thread.replyCount;
          return { ...s, serverThreadCounts: { ...s.serverThreadCounts, [conversationId]: counts } };
        }),
      )
      .catch(() => undefined)
      .finally(() => this.threadCountLoads.delete(conversationId));
    this.threadCountLoads.set(conversationId, request);
    return request;
  }
  /** A separate collection cursor never changes the main timeline or acknowledges messages as read. */
  async messageCollection(
    conversationId: string,
    kind: CollectionKind,
    cursor: CollectionCursor | null = null,
    root?: string,
    forum?: { q: string; sort: "latest" | "newest"; tags: string; match: "any" | "all" },
  ): Promise<MessageCollectionPage> {
    const q = new URLSearchParams({ kind, limit: "50" });
    if (cursor) {
      q.set("before", String(cursor.serverTs));
      q.set("beforeId", cursor.id);
    }
    if (root) q.set("root", root);
    if (forum) {
      if (forum.q.trim()) q.set("q", forum.q.trim());
      q.set("sort", forum.sort);
      if (forum.tags) q.set("tags", forum.tags);
      q.set("match", forum.match);
    }
    const page = await this.api.json("GET", `/v2/conversations/${encodeURIComponent(conversationId)}/message-collections?${q}`, zMessageCollection);
    const events = [...page.context, ...page.messages, ...page.changes];
    if (events.some((e) => e.conversationId !== conversationId)) throw new Error(uiText("workspace.interface.this_collection_contains_a_message_from_another_conversation_fd364c4"));
    for (const e of [...page.context, ...page.messages].reverse()) await this.receiver.ingest(e, 0, { history: true });
    for (const e of page.changes) await this.receiver.ingest(e, 0, { history: true });
    const read = async (events: typeof page.messages) => (await Promise.all(events.map((e) => this.store.message(e.id)))).filter((m): m is StoredMessage => !!m);
    const [messages, context] = await Promise.all([read(page.messages), read(page.context)]);
    void Promise.all([...new Set([...messages, ...context].map((m) => m.senderUserId))].map((id) => this.ensureUser(id)));
    return { messages: messages.sort((a, b) => a.sortTs - b.sortTs || a.id.localeCompare(b.id)), context, threads: page.threads, more: page.more, nextCursor: page.nextCursor };
  }
  /** Up to [limit] newest cached messages; older servers retain this explicitly limited fallback. */
  conversationMessages(conversationId: string, limit = 1000): Promise<StoredMessage[]> {
    return this.store.latestMessages(conversationId, limit);
  }
  /** The identity key pinned for someone, if any (a different key from the server pauses messages until reviewed). */
  async pinnedIdentity(userId: string): Promise<PinnedIdentity | null> {
    return this.store.pin(userId);
  }
}
/** Without a media implementation (tests that don't need calls), calls can't start. */
const unavailableMedia: MediaFactory = () => {
  throw new Error(uiText("workspace.interface.call_media_isn_t_available_here_5caf3b7"));
};
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
    // API 0.46.0: lists carry them; a list without them (an older server) keeps what a profile already said.
    avatarMedia: m.avatarMedia ?? prev?.avatarMedia ?? null,
    profileStyle: m.profileStyle ?? prev?.profileStyle ?? null,
    tag: m.tag ?? prev?.tag ?? null,
    // API 0.54.0: no badge in the list means none (hidden or no plan): never kept from before.
    mojo: m.mojo ?? null,
    bot: m.bot,
  };
}
