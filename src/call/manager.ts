import { type ApiClient, ApiError } from "../api/client";
import { type Call, zCallGrant, zCallList, zCallRes } from "../api/schemas";
import type { Payload } from "../protocol/payload";
import type { AppState, Store } from "../state/store";
import { IdentityChangedError } from "../sync/outbox";
import { CallKeyRing, inRoomCall, judgeKey, type KeyVerdict, KeyRequestPacer, newCallKey, verificationCode } from "./callKeys";
import { backoff, CallFailure, KEY_POLL_MS, KEY_WAIT_MS, PEER_WINDOW_MS, REJOIN_WINDOW_MS, retryable, shouldRing } from "./rules";
import { type CallUiState, DeviceError, type DeviceKind, idleCall, type MediaDeviceChoice, type MediaEvents, type MediaFactory, type MediaGrant, type MediaSession } from "./types";

/** What the call manager needs from the engine that owns it. */
export interface CallHost {
  readonly api: ApiClient;
  readonly state: Store;
  readonly me: { userId: string; deviceId: string };
  /** Seals and posts a control message at once, never writing it to storage (call keys stay in memory). */
  sendControlNow(conversationId: string, payload: Payload): Promise<void>;
  /** Title, kind and colour of a conversation for the call screen; whether it's a voice room this person manages. */
  describe(conversationId: string): Promise<CallTarget>;
  displayName(userId: string): string | null;
  /** The call's entry in its conversation, for a call this browser started (others' arrive as messages). */
  recordCall(callId: string, conversationId: string, video: boolean): Promise<void>;
  /** A system notification for a ringing call while the tab isn't looked at. */
  ringAlert?(title: string, video: boolean, conversationId: string): void;
}

export interface CallTarget {
  title: string;
  isGroup: boolean;
  colorIndex: number;
  voiceRoom: boolean;
  canModerate: boolean;
}

/** What a voice room's manager can do to someone in its call (server POST /v1/calls/:id/moderate). */
export type ModerationAction = "mute" | "lower_hand" | "remove";

export interface CallOptions {
  media: MediaFactory;
  /** This browser can encrypt call media (RTCRtpScriptTransform or encoded streams, and workers). */
  supported(): boolean;
  ringtone?: { start(): void; stop(): void };
  now?(): number;
  sleep?(ms: number): Promise<void>;
  keyWaitMs?: number;
  peerWindowMs?: number;
  rejoinWindowMs?: number;
}

/** A failure whose message is already what the person should read. */
class CallError extends Error {}
/** The attempt this work belonged to was hung up, declined or replaced. */
class Superseded extends Error {}

const MAX_HANDLED = 64;
const ENDED_SHOWN_MS = 1_500;
const ERROR_SHOWN_MS = 4_000;

/**
 * The browser's calls (android CallManager): one at a time, over the server's call API and its realtime `call` events,
 * with media in a LiveKit room encrypted end to end under a per-call key that travels only inside griip-envelope-v1
 * messages. Without the key it refuses to join; there is no unencrypted fallback (docs/ORBIT_WEB_CALLS.md).
 */
export class CallManager {
  private readonly keys = new CallKeyRing();
  private readonly pacer: KeyRequestPacer;
  /** Calls this browser already rang, answered, declined or ended: ring recovery never re-rings them. */
  private readonly handled = new Set<string>();
  /** Calls declined here (the server tells only the caller about a group-call decline; the history line needs it). */
  private readonly declined = new Set<string>();
  private session: MediaSession | null = null;
  /** Bumped when an attempt starts or ends: work for an older attempt stops at its next check. */
  private gen = 0;
  /** This browser created the current call (so it ends it on the server if it fails). */
  private created = false;
  private rejoining = false;
  private peerTimer: ReturnType<typeof setTimeout> | undefined;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly host: CallHost,
    private readonly opts: CallOptions,
  ) {
    this.pacer = new KeyRequestPacer(() => this.now());
  }

  get state(): CallUiState {
    return this.host.state.get().call;
  }

  supported(): boolean {
    return this.opts.supported();
  }

  // ───────────────────────── starting and answering ─────────────────────────

  async startCall(conversationId: string, video: boolean): Promise<void> {
    if (!this.isFree()) return;
    const about = await this.host.describe(conversationId);
    // Nobody is rung in a voice room: joining it just connects (android CallManager).
    const gen = this.begin({ ...idleCall, phase: about.voiceRoom ? "connecting" : "outgoing", conversationId, video, cameraOn: video, ...about });
    this.created = true;
    try {
      if (!this.opts.supported()) throw new CallError(CallFailure.UNSUPPORTED);
      const session = this.newSession(gen);
      await this.prepare(gen, session, video, true);
      const res = await this.host.api.json("POST", "/v1/calls", zCallGrant, { body: { conversationId, video } });
      if (gen !== this.gen) {
        // Hung up while the server was creating the call: don't leave the other side ringing.
        if (!res.joinedExisting) void this.endOnServer(res.call.id, about.isGroup);
        throw new Superseded();
      }
      this.markHandled(res.call.id);
      this.created = !res.joinedExisting;
      this.patch({ callId: res.call.id, alerted: res.call.alertedAt != null, isGroup: about.isGroup || (res.call.conversationType ?? "DM") !== "DM" });
      const key = res.joinedExisting ? await this.waitForKey(gen, res.call.id) : await this.distributeKey(res.call.id, conversationId, video);
      await this.connect(gen, session, res.call.id, res.media, key);
    } catch (e) {
      this.failed(gen, e);
    }
  }

  /** Answers the ringing call; [withVideo] turns the camera on (a video call can be answered with voice only). */
  async accept(withVideo = this.state.video): Promise<void> {
    const s = this.state;
    if (s.phase !== "incoming" || !s.callId || !this.opts.supported()) return;
    this.opts.ringtone?.stop();
    await this.answer({ ...s, phase: "connecting", cameraOn: withVideo, error: null }, s.callId, withVideo);
  }

  /** Joins a call already running in a conversation (a group call, or one this account's other device is in). */
  async join(conversationId: string, callId: string, video: boolean): Promise<void> {
    if (!this.isFree() || !this.opts.supported()) return;
    const about = await this.host.describe(conversationId);
    this.markHandled(callId);
    await this.answer({ ...idleCall, phase: "connecting", callId, conversationId, video, cameraOn: video, ...about }, callId, video);
  }

  declinedHere(callId: string): boolean {
    return this.declined.has(callId);
  }

  decline(): void {
    const s = this.state;
    if (s.phase !== "incoming" || !s.callId) return;
    const id = s.callId;
    this.markHandled(id);
    this.declined.add(id);
    void this.host.api.call("POST", `/v1/calls/${encodeURIComponent(id)}/decline`, { body: { reason: "declined" } }).catch(() => undefined);
    this.teardown();
    this.gen++;
    this.set(idleCall);
  }

  hangup(): void {
    this.finish("hangup", true);
  }

  private async answer(next: CallUiState, callId: string, withVideo: boolean): Promise<void> {
    const gen = this.begin(next);
    this.created = false;
    try {
      const session = this.newSession(gen);
      await this.prepare(gen, session, withVideo, false);
      const res = await this.host.api.json("POST", `/v1/calls/${encodeURIComponent(callId)}/join`, zCallGrant);
      this.check(gen);
      const key = await this.waitForKey(gen, callId);
      await this.connect(gen, session, callId, res.media, key);
    } catch (e) {
      this.failed(gen, e);
    }
  }

  /** A new call's key: kept here, and sent to every device in the conversation inside an encrypted control message. */
  private async distributeKey(callId: string, conversationId: string, video: boolean): Promise<string> {
    const key = newCallKey();
    this.keys.accept({ callId, conversationId, fromUserId: this.host.me.userId, key });
    await this.host.sendControlNow(conversationId, { type: "call_invite", callId, video, e2eeKey: key });
    // A voice room's comings and goings aren't calls in its conversation (docs/VOICE_ROOMS.md).
    if (!this.state.voiceRoom) void this.host.recordCall(callId, conversationId, video).catch(() => undefined);
    return key;
  }

  /** Opens the devices first: this is when the browser asks. Placing a call needs the microphone; answering doesn't. */
  private async prepare(gen: number, session: MediaSession, video: boolean, needMicrophone: boolean): Promise<void> {
    this.patch({ askingPermission: true });
    const devices = await session.prepare(video);
    this.check(gen);
    this.patch({ askingPermission: false, devices, micOn: !devices.microphone, cameraOn: video && !devices.camera });
    if (needMicrophone && devices.microphone) throw new CallError(CallFailure.device("microphone", devices.microphone));
  }

  /** The key arrives as an encrypted control message, possibly after the ring; late joiners ask the creator (T5.3). */
  private async waitForKey(gen: number, callId: string): Promise<string> {
    const deadline = this.now() + (this.opts.keyWaitMs ?? KEY_WAIT_MS);
    for (;;) {
      const k = this.keys.get(callId);
      if (k) {
        this.patch({ waitingForKey: false });
        return k.key;
      }
      if (this.now() >= deadline) {
        this.patch({ waitingForKey: false });
        throw new CallError(CallFailure.NO_KEY);
      }
      if (!this.state.waitingForKey) this.patch({ waitingForKey: true });
      if (this.pacer.shouldRequest(callId)) void this.requestKey(callId);
      await this.sleep(KEY_POLL_MS);
      this.check(gen);
    }
  }

  private async requestKey(callId: string): Promise<void> {
    try {
      const { call } = await this.host.api.json("GET", `/v1/calls/${encodeURIComponent(callId)}`, zCallRes);
      if (call.state !== "ENDED") await this.host.sendControlNow(call.conversationId, { type: "call_key_request", callId });
    } catch {
      /* asked again on a later poll */
    }
  }

  private async connect(gen: number, session: MediaSession, callId: string, grant: MediaGrant, key: string): Promise<void> {
    this.patch({ verification: await verificationCode(key, callId), security: "verifying" });
    this.check(gen);
    try {
      await session.connect(grant, key);
    } catch (e) {
      throw new CallError(CallFailure.forConnect(e));
    }
    this.check(gen);
    void this.host.api.call("POST", `/v1/calls/${encodeURIComponent(callId)}/connected`).catch(() => undefined);
    const alone = session.remoteCount() === 0 && !this.state.isGroup;
    this.patch({ phase: alone ? (this.created ? "outgoing" : "connecting") : "connected", connectedAt: alone ? null : this.now(), mediaEpoch: this.state.mediaEpoch + 1 });
    this.refresh();
  }

  // ───────────────────────── media session events ─────────────────────────

  private newSession(gen: number): MediaSession {
    let self: MediaSession | null = null;
    const live = () => gen === this.gen && self !== null && this.session === self;
    const events: MediaEvents = {
      changed: () => live() && this.refresh(),
      security: (security) => live() && this.patch({ security }),
      flow: (media, path) => live() && this.patch({ media, path: path ?? this.state.path }),
      reconnecting: () => live() && this.patch({ phase: "reconnecting" }),
      reconnected: () => live() && this.patch({ phase: this.settledPhase() }),
      disconnected: (reason) => live() && this.onDisconnected(gen, reason),
      remoteJoined: () => live() && this.onRemoteJoined(),
      remoteLeft: (remaining) => live() && this.onRemoteLeft(remaining),
      audioBlocked: (audioBlocked) => live() && this.patch({ audioBlocked }),
    };
    self = this.opts.media(events);
    this.session = self;
    return self;
  }

  /** Where a call that has its media connection stands. */
  private settledPhase(): CallUiState["phase"] {
    if (this.state.connectedAt !== null || (this.session?.remoteCount() ?? 0) > 0 || this.state.isGroup) return "connected";
    return this.created ? "outgoing" : "connecting";
  }

  private onRemoteJoined(): void {
    clearTimeout(this.peerTimer);
    this.peerTimer = undefined;
    const s = this.state;
    this.patch({ phase: s.phase === "reconnecting" ? s.phase : "connected", connectedAt: s.connectedAt ?? this.now(), peerReconnecting: false });
  }

  /** 1:1: the other person may only have lost their connection (a hang-up arrives as an "ended" event): wait for them. */
  private onRemoteLeft(remaining: number): void {
    if (this.state.isGroup || remaining > 0 || this.peerTimer) return;
    this.patch({ peerReconnecting: true });
    this.peerTimer = setTimeout(() => {
      this.peerTimer = undefined;
      if ((this.session?.remoteCount() ?? 0) === 0) this.finish("lost", true);
    }, this.opts.peerWindowMs ?? PEER_WINDOW_MS);
  }

  private onDisconnected(gen: number, reason: string | undefined): void {
    const phase = this.state.phase;
    if (phase === "idle" || phase === "ended" || this.rejoining) return;
    if (retryable(reason)) void this.rejoin(gen);
    else this.finish("disconnected", true);
  }

  /**
   * This browser's media connection dropped and LiveKit gave up: new credentials from the server and a new room
   * connection with the same key, with backoff, for up to 45 s (android CallRecovery). "Reconnecting…" meanwhile.
   */
  private async rejoin(gen: number): Promise<void> {
    const s = this.state;
    const key = s.callId ? this.keys.get(s.callId)?.key : undefined;
    if (!s.callId || !key) return this.finish("disconnected", true);
    const callId = s.callId;
    this.rejoining = true;
    this.patch({ phase: "reconnecting" });
    const old = this.session;
    this.session = null;
    void old?.disconnect();
    const started = this.now();
    try {
      for (let attempt = 0; this.now() - started < (this.opts.rejoinWindowMs ?? REJOIN_WINDOW_MS); attempt++) {
        await this.sleep(backoff(attempt));
        this.check(gen);
        if (await this.rejoinOnce(gen, callId, key)) return;
      }
      this.finish("lost", true);
    } catch (e) {
      if (!(e instanceof Superseded)) this.finish("lost", true);
    } finally {
      this.rejoining = false;
    }
  }

  private async rejoinOnce(gen: number, callId: string, key: string): Promise<boolean> {
    let grant: MediaGrant;
    try {
      grant = (await this.host.api.json("POST", `/v1/calls/${encodeURIComponent(callId)}/join`, zCallGrant)).media;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 410 || e.status === 404)) {
        this.finish("ended", false);
        throw new Superseded();
      }
      return false;
    }
    this.check(gen);
    const { micOn, cameraOn } = this.state;
    const session = this.newSession(gen);
    try {
      this.patch({ devices: await session.prepare(cameraOn) });
      await session.connect(grant, key);
      this.check(gen);
      if (!micOn) await session.setMicrophone(false).catch(() => undefined);
    } catch (e) {
      if (e instanceof Superseded) throw e;
      if (this.session === session) this.session = null;
      void session.disconnect();
      return false;
    }
    void this.host.api.call("POST", `/v1/calls/${encodeURIComponent(callId)}/connected`).catch(() => undefined);
    this.patch({ phase: this.settledPhase(), mediaEpoch: this.state.mediaEpoch + 1 });
    this.refresh();
    return true;
  }

  // ───────────────────────── server events and keys ─────────────────────────

  /** A realtime `call` frame (server ws.ts): ring, started, updated, alerted, declined, dismissed, ended, moderated. */
  async onCallEvent(event: string, call: Call, extra: { from?: { displayName?: unknown }; reason?: unknown; action?: unknown }): Promise<void> {
    const current = call.id === this.state.callId;
    if (current && call.voiceRoom && event !== "ended") this.patch({ voiceRoom: true, hands: call.hands });
    switch (event) {
      case "moderated":
        if (current) await this.onModerated(extra.action);
        return;
      case "ring":
        return this.onRing(call, typeof extra.from?.displayName === "string" ? extra.from.displayName : null);
      case "ended":
        if (current) this.finish(call.endReason ?? "ended", false);
        this.keys.drop(call.id);
        return;
      case "dismissed":
        if (current && this.state.phase === "incoming") this.finish("answered elsewhere", false);
        return;
      case "declined":
        if (current && !this.state.isGroup) this.finish(extra.reason === "busy" ? "busy" : "declined", false);
        return;
      case "alerted":
        if (current && this.state.phase === "outgoing") this.patch({ alerted: true });
        return;
      case "updated":
        if (!current || this.state.phase !== "incoming") return;
        if (call.participants?.some((p) => p.userId === this.host.me.userId && p.deviceId !== this.host.me.deviceId)) this.finish("answered elsewhere", false);
        else if (call.state === "ACTIVE" && this.state.isGroup) this.opts.ringtone?.stop(); // a group call already running: keep the card, stop ringing
        return;
      default:
        return;
    }
  }

  private async onRing(call: Call, callerName: string | null): Promise<void> {
    if (this.handled.has(call.id) || call.createdBy === this.host.me.userId || call.state === "ENDED") return;
    if (!this.isFree()) {
      // Busy: tell a 1:1 caller at once instead of leaving them ringing; group calls can be joined later.
      if (call.id !== this.state.callId && (call.conversationType ?? "DM") === "DM") {
        this.markHandled(call.id);
        void this.host.api.call("POST", `/v1/calls/${encodeURIComponent(call.id)}/decline`, { body: { reason: "busy" } }).catch(() => undefined);
      }
      return;
    }
    this.markHandled(call.id);
    const about = await this.host.describe(call.conversationId);
    if (!this.isFree()) return;
    const isGroup = about.isGroup || (call.conversationType ?? "DM") !== "DM";
    const caller = this.host.displayName(call.createdBy) ?? callerName ?? "Someone";
    const supported = this.opts.supported();
    this.begin({
      ...idleCall,
      phase: "incoming",
      callId: call.id,
      conversationId: call.conversationId,
      title: isGroup ? about.title : caller,
      subtitle: isGroup ? `${caller} is calling` : null,
      colorIndex: about.colorIndex,
      video: call.video,
      isGroup,
      error: supported ? null : CallFailure.UNSUPPORTED,
    });
    if (!supported) return; // shown, but this browser can't answer: the caller keeps "Calling…" for devices that can
    void this.host.api.call("POST", `/v1/calls/${encodeURIComponent(call.id)}/alerted`).catch(() => undefined);
    this.opts.ringtone?.start();
    this.host.ringAlert?.(isGroup ? `${caller} · ${about.title}` : caller, call.video, call.conversationId);
  }

  /** After a reconnect, once the backlog (and with it any call key) has arrived: calls that rang while we were away. */
  async recoverRinging(): Promise<void> {
    if (!this.opts.supported() || !this.isFree()) return;
    let calls: Call[];
    try {
      calls = (await this.host.api.json("GET", "/v1/calls/active", zCallList)).calls;
    } catch {
      return; // the next reconnect looks again
    }
    for (const c of calls) if (shouldRing(c, this.host.me.userId, this.now(), this.handled, this.isFree())) await this.onRing(c, null);
  }

  /** A `call_invite` whose envelope signature proved its sender; [call] is the server's record (null: unknown). */
  onInvite(callId: string, conversationId: string, senderUserId: string, key: string, call: Call | null): KeyVerdict {
    const refused = judgeKey(call, conversationId, senderUserId);
    return refused ?? this.keys.accept({ callId, conversationId, fromUserId: senderUserId, key });
  }

  /**
   * A late joiner asks for a call's key: this account answers as the call's creator, or in a voice room while connected
   * to its call (a room outlives whoever opened it; android MessageRepository call_key_request), while the call is live.
   */
  async onKeyRequest(callId: string, conversationId: string): Promise<void> {
    const me = this.host.me.userId;
    const k = this.keys.get(callId);
    const inThisRoom = this.state.callId === callId && this.state.voiceRoom;
    if (!k || (k.fromUserId !== me && !inThisRoom) || k.conversationId !== conversationId || !this.pacer.shouldAnswer(callId)) return;
    try {
      const { call } = await this.host.api.json("GET", `/v1/calls/${encodeURIComponent(callId)}`, zCallRes);
      const mayAnswer = (k.fromUserId === me && call.createdBy === me) || inRoomCall(call, me);
      if (call.state === "ENDED" || !mayAnswer) return;
      await this.host.sendControlNow(conversationId, { type: "call_invite", callId, video: call.video, e2eeKey: k.key });
    } catch {
      /* the joiner asks again */
    }
  }

  /** Test and diagnostics: whether this browser holds a key for [callId] (never the key itself). */
  hasKey(callId: string): boolean {
    return this.keys.get(callId) !== null;
  }

  // ───────────────────────── controls ─────────────────────────

  async toggleMicrophone(): Promise<void> {
    await this.setDevice("microphone", !this.state.micOn || this.state.devices.microphone !== null);
  }

  async toggleCamera(): Promise<void> {
    await this.setDevice("camera", !this.state.cameraOn || this.state.devices.camera !== null);
  }

  private async setDevice(device: "microphone" | "camera", on: boolean): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      await (device === "microphone" ? session.setMicrophone(on) : session.setCamera(on));
      this.patch({ devices: { ...this.state.devices, [device]: null } });
    } catch (e) {
      if (e instanceof DeviceError) this.patch({ devices: { ...this.state.devices, [device]: e.issue } });
    }
    if (this.session === session) this.refresh();
  }

  /** Shares this browser's screen, or stops (the browser's own "Stop sharing" also stops it; the state follows). */
  async toggleScreenShare(): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      await session.setScreenShare(!this.state.screenSharing);
      this.patch({ error: null });
    } catch (e) {
      // Closing the browser's screen picker isn't a failure to show.
      if (!(e instanceof DeviceError && e.issue === "denied")) this.patch({ error: "Your screen couldn't be shared." });
    }
    if (this.session === session) this.refresh();
  }

  attachScreen(identity: string, el: HTMLVideoElement): () => void {
    return this.session?.attachScreen(identity, el) ?? (() => undefined);
  }

  async listDevices(kind: DeviceKind): Promise<MediaDeviceChoice[]> {
    return (await this.session?.listDevices(kind)) ?? [];
  }

  /** Switches microphone, camera or speaker during the call. */
  async useDevice(kind: DeviceKind, deviceId: string): Promise<void> {
    const session = this.session;
    if (!session) return;
    try {
      await session.useDevice(kind, deviceId);
    } catch {
      this.patch({ error: "That device couldn't be used. Choose another." });
    }
    if (this.session === session) this.refresh();
  }

  async startAudio(): Promise<void> {
    await this.session?.startAudio().catch(() => undefined);
    this.patch({ audioBlocked: false });
  }

  setMinimized(minimized: boolean): void {
    this.patch({ minimized });
  }

  dismissNotice(): void {
    this.patch({ notice: null });
  }

  // ───────────────────────── voice rooms ─────────────────────────

  /** Raises or lowers this person's hand; everyone in the room sees the queue. */
  async raiseHand(raised: boolean): Promise<void> {
    const id = this.state.callId;
    if (!id || !this.state.voiceRoom) return;
    try {
      const { call } = await this.host.api.json("POST", `/v1/calls/${encodeURIComponent(id)}/hand`, zCallRes, { body: { raised } });
      if (call.id === this.state.callId) this.patch({ hands: call.hands, notice: null });
    } catch (e) {
      this.patch({ notice: e instanceof ApiError ? e.message : "Your hand couldn't be changed. Try again." });
    }
  }

  /** The room's managers: mute someone's microphone (only they can turn it on again), lower their hand, or remove them. */
  async moderate(userId: string, action: ModerationAction): Promise<void> {
    const id = this.state.callId;
    if (!id || !this.state.voiceRoom || !this.state.canModerate) return;
    try {
      const { call } = await this.host.api.json("POST", `/v1/calls/${encodeURIComponent(id)}/moderate`, zCallRes, { body: { userId, action } });
      if (call.id === this.state.callId) this.patch({ hands: call.hands, notice: null });
    } catch (e) {
      this.patch({ notice: e instanceof ApiError ? e.message : "That didn't work. Try again." });
    }
  }

  /** A manager acted on this person: a muted microphone shows off here too; removal arrives as the call's end. */
  private async onModerated(action: unknown): Promise<void> {
    if (action === "mute") {
      await this.session?.setMicrophone(false).catch(() => undefined);
      this.refresh();
      this.patch({ notice: "A room manager muted your microphone. You can turn it on again." });
    } else if (action === "lower_hand") {
      this.patch({ notice: "A room manager lowered your hand." });
    }
  }

  attachVideo(identity: string, el: HTMLVideoElement): () => void {
    return this.session?.attachVideo(identity, el) ?? (() => undefined);
  }

  /** The tab is closing: tell the server now, so the other side isn't left waiting for a reconnect. */
  leaveOnUnload(): void {
    const s = this.state;
    if (!s.callId || s.phase === "idle" || s.phase === "ended" || s.phase === "incoming") return;
    void this.endOnServer(s.callId, this.othersInCall(s), true);
  }

  /** Sign-out or another tab took over: drop everything, keys included. */
  stop(): void {
    this.teardown();
    this.keys.clear();
    this.gen++;
    this.set(idleCall);
  }

  // ───────────────────────── ending ─────────────────────────

  private finish(reason: string, notifyServer: boolean): void {
    const s = this.state;
    if (s.phase === "idle" || s.phase === "ended") return;
    this.markHandled(s.callId);
    if (s.phase === "incoming") {
      // Missed, answered elsewhere or cancelled by the caller: the ringing card just goes away.
      this.teardown();
      this.gen++;
      this.set(idleCall);
      return;
    }
    if (notifyServer && s.callId) void this.endOnServer(s.callId, this.othersInCall(s));
    if (s.callId) this.keys.drop(s.callId);
    this.teardown();
    const gen = ++this.gen;
    this.set({ ...s, phase: "ended", endReason: reason, participants: [], askingPermission: false, waitingForKey: false, peerReconnecting: false });
    this.scheduleReset(gen, ENDED_SHOWN_MS);
  }

  private failed(gen: number, e: unknown): void {
    if (e instanceof Superseded || gen !== this.gen) return;
    const message = e instanceof CallError ? e.message : e instanceof IdentityChangedError ? CallFailure.KEY_CHANGED : CallFailure.forApi(e);
    const s = this.state;
    if (this.created && s.callId) {
      void this.endOnServer(s.callId, s.isGroup);
      this.keys.drop(s.callId);
    }
    this.markHandled(s.callId);
    this.teardown();
    const next = ++this.gen;
    this.set({ ...s, phase: "ended", error: message, endReason: "error", participants: [], askingPermission: false, waitingForKey: false });
    this.scheduleReset(next, ERROR_SHOWN_MS);
  }

  /** A voice room's call is left, never ended for everyone: it closes by itself when the last person leaves. */
  private othersInCall(s: CallUiState): boolean {
    return s.voiceRoom || (s.isGroup && s.participants.some((p) => !p.isLocal));
  }

  /** 1:1 calls end for both; in a group call with others still in it, this browser only leaves. */
  private async endOnServer(callId: string, othersRemain: boolean, keepalive = false): Promise<void> {
    const id = encodeURIComponent(callId);
    try {
      await this.host.api.call("POST", `/v1/calls/${id}/${othersRemain ? "leave" : "end"}`, { keepalive });
    } catch {
      await this.host.api.call("POST", `/v1/calls/${id}/leave`, { keepalive }).catch(() => undefined);
    }
  }

  private teardown(): void {
    clearTimeout(this.peerTimer);
    clearTimeout(this.resetTimer);
    this.peerTimer = undefined;
    this.opts.ringtone?.stop();
    const session = this.session;
    this.session = null;
    void session?.disconnect().catch(() => undefined);
  }

  private scheduleReset(gen: number, ms: number): void {
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (gen === this.gen && this.state.phase === "ended") this.set(idleCall);
    }, ms);
  }

  // ───────────────────────── state ─────────────────────────

  private isFree(): boolean {
    return this.state.phase === "idle" || this.state.phase === "ended";
  }

  /** Starts a new attempt with [next] as the call screen; returns its generation. */
  private begin(next: CallUiState): number {
    this.teardown();
    this.gen++;
    this.set(next);
    return this.gen;
  }

  private check(gen: number): void {
    if (gen !== this.gen) throw new Superseded();
  }

  private refresh(): void {
    const session = this.session;
    if (!session) return;
    const participants = session.participants();
    const local = participants.find((p) => p.isLocal);
    this.patch({ participants, ...(local ? { micOn: local.micOn, cameraOn: local.cameraOn, screenSharing: local.screenOn } : {}) });
  }

  private markHandled(id: string | null): void {
    if (!id) return;
    this.handled.delete(id);
    this.handled.add(id);
    while (this.handled.size > MAX_HANDLED) this.handled.delete(this.handled.values().next().value as string);
  }

  /** Writes that change nothing don't notify: listeners may call back in (sign-out stops the engine from one). */
  private set(call: CallUiState): void {
    this.host.state.update((s: AppState) => (s.call === call ? s : { ...s, call }));
  }

  private patch(p: Partial<CallUiState>): void {
    this.host.state.update((s: AppState) => {
      const changed = (Object.keys(p) as (keyof CallUiState)[]).some((k) => s.call[k] !== p[k]);
      return changed ? { ...s, call: { ...s.call, ...p } } : s;
    });
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return this.opts.sleep?.(ms) ?? new Promise((r) => setTimeout(r, ms));
  }
}
