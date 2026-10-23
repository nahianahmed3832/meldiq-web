import { DEV } from "../application/env";
import {
  AudioPresets,
  ConnectionQuality,
  createLocalTracks,
  DisconnectReason,
  ExternalE2EEKeyProvider,
  type LocalTrack,
  type Participant,
  type RemoteTrack,
  type RemoteTrackPublication,
  LogLevel,
  Room,
  RoomEvent,
  setLogLevel,
  Track,
  type TrackPublication,
  VideoPresets,
  VideoQuality,
} from "livekit-client";
import { isAuditMessage } from "./frameAudit";
import { audioProcessing, describePath, deviceIssueOf, MediaFlowMonitor, mirrorPreview } from "./rules";
import { MediaSecurityTracker } from "./security";
import { receivedVideo, type ShareQuality } from "./shareQuality";
import { type CallShareView, shareKey } from "./shares";
import { ShareSender } from "./shareSender";
import {
  type CallParticipantView,
  DeviceError,
  type DeviceIssue,
  type DeviceIssues,
  type DeviceKind,
  type MediaDeviceChoice,
  type MediaEvents,
  type MediaGrant,
  type MediaSecurity,
  type MediaSession,
  type PrepareOptions,
  type ShareOptions,
} from "./types";

// LiveKit's own logging stays at warnings: its signalling URL carries the call pass (android keeps SDK logging off).
setLogLevel(LogLevel.warn);

/** Camera capture and sending, as the Android app does (CallMediaPolicy: 720p, simulcast, VP8). */
const CAMERA = { resolution: VideoPresets.h720.resolution };
const FLOW_SAMPLE_MS = 2_000;
const SCREEN_SOURCES: readonly Track.Source[] = [Track.Source.ScreenShare, Track.Source.ScreenShareAudio];

/**
 * One connection to a call's LiveKit room with end-to-end frame encryption (docs/ORBIT_WEB_CALLS.md). The call key is
 * set as LiveKit's shared key as a *string*: livekit-client then derives the AES-GCM frame key with PBKDF2 from its
 * UTF-8 bytes, exactly as the Android SDK's `setSharedKey(String)` and LiveKit's native SDKs do, so browser and phone
 * frames are interchangeable. Frames are encrypted in a worker (`e2eeWorker.ts`) that also audits them for the badge.
 */
export class LiveKitSession implements MediaSession {
  private room: Room | null = null;
  private worker: Worker | null = null;
  private prepared: LocalTrack[] = [];
  private closed = false;
  private readonly tracker = new MediaSecurityTracker();
  private lastSecurity: MediaSecurity = "verifying";
  private readonly monitor = new MediaFlowMonitor();
  private flowTimer: ReturnType<typeof setInterval> | undefined;
  /** Hidden home for the remote participants' <audio> elements. */
  private readonly audioBox: HTMLElement = document.createElement("div");
  /**
   * Received audio waits here until its frames are proven to decrypt with the call key. A browser can hand a track's first
   * frames to the decoder before LiveKit's decrypt transform is attached (seen in Firefox), so nothing received is
   * played or shown before the frame audit vouches for it.
   */
  private readonly pendingAudio = new Map<string, RemoteTrack>();
  /** Batch B10: nobody's sound plays while deafened, including people who join later. */
  private deafened = false;
  private audioOptions: MediaTrackConstraints | undefined;
  /** The share this browser watches: the only screen share received (2026-10-24). */
  private watched: string | null = null;
  private readonly share = new ShareSender(
    () => this.room?.localParticipant ?? null,
    (stats) => this.events.shareStats?.(stats),
  );

  constructor(private readonly events: MediaEvents) {
    this.audioBox.hidden = true;
    this.audioBox.dataset.orbitCallAudio = "";
  }

  async prepare(video: boolean, opts: PrepareOptions = {}): Promise<DeviceIssues> {
    // Batch B10: noise reduction and automatic level unless turned off; a listen-only voice channel opens no microphone.
    const audio = opts.microphone === false ? false : audioProcessing(opts.noiseReduction !== false);
    this.audioOptions = audio || undefined;
    if (!audio && !video) return { microphone: null, camera: null };
    const both = await open({ audio, video: video ? CAMERA : false });
    if (!both.issue) this.prepared = both.tracks;
    else if (!video) return this.settle({ microphone: both.issue, camera: null });
    else {
      // One of the two failed: open each alone to tell which (the browser remembers the answer, so no second prompt).
      const mic = await open({ audio, video: false });
      const cam = await open({ audio: false, video: CAMERA });
      this.prepared = [...mic.tracks, ...cam.tracks];
      return this.settle({ microphone: mic.issue, camera: cam.issue });
    }
    return this.settle({ microphone: null, camera: null });
  }

  private settle(issues: DeviceIssues): DeviceIssues {
    if (this.closed) this.stopPrepared(); // hung up while the browser was asking
    return issues;
  }

  async connect(grant: MediaGrant, key: string): Promise<void> {
    const worker = new Worker(new URL("./e2eeWorker.ts", import.meta.url), { type: "module", name: "orbit-call-e2ee" });
    worker.addEventListener("message", (ev: MessageEvent) => this.onWorkerMessage(ev.data));
    this.worker = worker;
    const keyProvider = new ExternalE2EEKeyProvider();
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      e2ee: { keyProvider, worker },
      // Microphones go first when the connection is short (screen and camera video give way before speech does).
      publishDefaults: { simulcast: true, videoCodec: "vp8", dtx: true, audioPreset: { ...AudioPresets.music, priority: "high" } },
      videoCaptureDefaults: CAMERA,
    });
    this.room = room;
    this.wire(room);
    // Development builds only (removed from production bundles): what the badge rests on, for the browser tests.
    if (DEV) (globalThis as { __orbitCallTracks?: () => unknown }).__orbitCallTracks = () => this.tracker.snapshot();
    // Which screen-share tracks this browser receives (the browser tests check only the watched one is).
    if (DEV)
      (globalThis as { __orbitShareSubscriptions?: () => unknown }).__orbitShareSubscriptions = () =>
        [...room.remoteParticipants.values()].flatMap((p) =>
          [...p.trackPublications.values()].filter((t) => SCREEN_SOURCES.includes(t.source)).map((t) => ({ identity: p.identity, source: t.source, subscribed: t.isSubscribed })),
        );
    document.body.appendChild(this.audioBox);
    await keyProvider.setKey(key);
    await room.setE2EEEnabled(true);
    // Subscriptions are this session's choice (syncSubscriptions): everyone's microphone and camera, and only the
    // watched screen share, so several shares at once cost each viewer one.
    await room.connect(grant.url, grant.token, { autoSubscribe: false });
    if (this.closed) throw new Error("call closed while connecting");
    this.syncSubscriptions();
    for (const t of this.prepared) await room.localParticipant.publishTrack(t, { simulcast: t.kind === Track.Kind.Video });
    this.prepared = [];
    this.events.audioBlocked(!room.canPlaybackAudio);
    this.flowTimer = setInterval(() => void this.sampleFlow(), FLOW_SAMPLE_MS);
  }

  async setMicrophone(on: boolean): Promise<void> {
    try {
      await this.room?.localParticipant.setMicrophoneEnabled(on, this.audioOptions);
    } catch (e) {
      throw new DeviceError("microphone", deviceIssueOf(e));
    }
  }

  async setCamera(on: boolean): Promise<void> {
    try {
      await this.room?.localParticipant.setCameraEnabled(on, CAMERA);
    } catch (e) {
      throw new DeviceError("camera", deviceIssueOf(e));
    }
  }

  async setScreenShare(on: boolean, opts: ShareOptions = { quality: "standard", audio: false }): Promise<void> {
    try {
      // The shared tab's or system's sound comes along where the browser offers it (Chromium); frame encryption covers
      // every track.
      if (on) await this.share.start(opts);
      else await this.share.stop();
    } catch (e) {
      // Closing the browser's picker isn't an error worth showing.
      if (e instanceof DOMException && e.name === "NotAllowedError" && on) throw new DeviceError("screen", "denied");
      throw new DeviceError("screen", deviceIssueOf(e));
    }
  }

  async setShareQuality(quality: ShareQuality): Promise<void> {
    await this.share.setQuality(quality);
  }

  shares(): CallShareView[] {
    const room = this.room;
    if (!room) return [];
    const view = (p: Participant, isLocal: boolean): CallShareView[] => {
      const pub = p.getTrackPublication(Track.Source.ScreenShare);
      if (!pub?.trackSid || pub.isMuted) return [];
      const key = shareKey(p.identity, pub.trackSid);
      // Someone else's share is shown once its frames are proven to decrypt with the call key (see pendingAudio).
      const ready = isLocal || (!!pub.track && this.tracker.proven(MediaSecurityTracker.key(p.identity, pub.track.mediaStreamID)));
      const withAudio = !!p.getTrackPublication(Track.Source.ScreenShareAudio);
      return [{ key, identity: p.identity, userId: userIdOf(p), name: p.name || (isLocal ? "You" : "Participant"), isLocal, withAudio, ready }];
    };
    return [...[...room.remoteParticipants.values()].flatMap((p) => view(p, false)), ...view(room.localParticipant, true)];
  }

  watchShare(key: string | null): void {
    if (this.watched === key) return;
    this.watched = key;
    this.events.watchStats?.(null);
    this.syncSubscriptions();
  }

  attachShare(key: string, el: HTMLVideoElement): () => void {
    const room = this.room;
    const share = this.shares().find((s) => s.key === key);
    if (!room || !share || !share.ready) return () => undefined;
    const p = share.isLocal ? room.localParticipant : room.getParticipantByIdentity(share.identity);
    const track = p?.getTrackPublication(Track.Source.ScreenShare)?.track;
    if (!track) return () => undefined;
    track.attach(el);
    return () => void track.detach(el);
  }

  /**
   * Subscribes to what this browser receives: everyone's microphone and camera, and of the screen shares only the
   * watched one (its video and its sound), at full quality; the others' screens aren't received at all.
   */
  private syncSubscriptions(): void {
    const room = this.room;
    if (!room) return;
    const watchedIdentity = this.watched ? (this.shares().find((s) => s.key === this.watched)?.identity ?? null) : null;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        const remote = pub as RemoteTrackPublication;
        const want = !SCREEN_SOURCES.includes(remote.source) || p.identity === watchedIdentity;
        if (remote.isDesired !== want) remote.setSubscribed(want);
        if (want && remote.source === Track.Source.ScreenShare) remote.setVideoQuality(VideoQuality.HIGH);
      }
    }
  }

  setDeafened(on: boolean): void {
    this.deafened = on;
    for (const el of this.audioBox.querySelectorAll("audio")) el.muted = on;
  }

  async listDevices(kind: DeviceKind): Promise<MediaDeviceChoice[]> {
    const all = await Room.getLocalDevices(kind, false).catch(() => [] as MediaDeviceInfo[]);
    return all.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${kind === "audioinput" ? "Microphone" : kind === "videoinput" ? "Camera" : "Speaker"} ${i + 1}` }));
  }

  async useDevice(kind: DeviceKind, deviceId: string): Promise<void> {
    if (!this.room) return;
    const ok = await this.room.switchActiveDevice(kind, deviceId).catch(() => false);
    if (ok === false) throw new DeviceError(kind === "videoinput" ? "camera" : "microphone", "failed");
  }

  participants(): CallParticipantView[] {
    const room = this.room;
    if (!room) return [];
    const problems = this.tracker.problemIdentities();
    const view = (p: Participant, isLocal: boolean): CallParticipantView => {
      const cam = p.getTrackPublication(Track.Source.Camera);
      const screen = p.getTrackPublication(Track.Source.ScreenShare);
      return {
        identity: p.identity,
        userId: userIdOf(p),
        name: p.name || (isLocal ? "You" : "Participant"),
        isLocal,
        speaking: p.isSpeaking,
        micOn: p.isMicrophoneEnabled,
        // Someone else's video shows only once its frames are proven to decrypt with the call key (see pendingAudio).
        cameraOn: !!cam && !cam.isMuted && !!cam.track && (isLocal || this.tracker.proven(MediaSecurityTracker.key(p.identity, cam.track.mediaStreamID))),
        screenOn: !!screen && !screen.isMuted && !!screen.track && (isLocal || this.tracker.proven(MediaSecurityTracker.key(p.identity, screen.track.mediaStreamID))),
        connectionWeak: p.connectionQuality === ConnectionQuality.Poor || p.connectionQuality === ConnectionQuality.Lost,
        e2eeProblem: problems.has(p.identity),
        mirrored: mirrorPreview(isLocal, isLocal ? cam?.track?.mediaStreamTrack.getSettings().facingMode : undefined),
      };
    };
    // Others in the order they arrived, then you (android CallTiles.order).
    return [...[...room.remoteParticipants.values()].map((p) => view(p, false)), view(room.localParticipant, true)];
  }

  remoteCount(): number {
    return this.room?.remoteParticipants.size ?? 0;
  }

  attachVideo(identity: string, el: HTMLVideoElement): () => void {
    const room = this.room;
    const p = room && (identity === room.localParticipant.identity ? room.localParticipant : room.getParticipantByIdentity(identity));
    const track = p?.getTrackPublication(Track.Source.Camera)?.track;
    if (!track) return () => undefined;
    track.attach(el);
    return () => void track.detach(el);
  }

  async startAudio(): Promise<void> {
    await this.room?.startAudio();
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    clearInterval(this.flowTimer);
    this.events.shareStats?.(null);
    this.stopPrepared();
    const room = this.room;
    const worker = this.worker;
    this.pendingAudio.clear();
    this.room = null;
    this.worker = null;
    try {
      await room?.disconnect();
    } finally {
      worker?.terminate();
      this.audioBox.remove();
    }
  }

  // ───────────────────────── room events ─────────────────────────

  private wire(room: Room): void {
    const key = (p: Participant, t: Track | undefined) => (t ? MediaSecurityTracker.key(p.identity, t.mediaStreamID) : null);
    const changed = () => this.events.changed();
    room
      .on(RoomEvent.ParticipantConnected, () => {
        this.syncSubscriptions();
        this.events.remoteJoined();
        changed();
      })
      // A track someone publishes (a new share, a camera turned on, a republish after their reconnect) is subscribed or
      // not by syncSubscriptions; the share list changes with it.
      .on(RoomEvent.TrackPublished, () => {
        this.syncSubscriptions();
        changed();
      })
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        this.tracker.participantLeft(p.identity);
        this.publishSecurity();
        this.events.remoteLeft(room.remoteParticipants.size);
        changed();
      })
      .on(RoomEvent.TrackSubscribed, (track, pub, p) => this.onSubscribed(track, pub, p))
      .on(RoomEvent.TrackUnpublished, (pub, p) => {
        // Batch B11: "<name> stopped sharing their screen".
        if (pub.source === Track.Source.ScreenShare) this.events.shareEnded?.(p.name || "Someone");
        changed();
      })
      .on(RoomEvent.TrackUnsubscribed, (track, _pub, p) => {
        track.detach().forEach((el) => el.remove());
        const k = key(p, track);
        if (k) this.pendingAudio.delete(k);
        this.forget(k);
      })
      .on(RoomEvent.LocalTrackPublished, (pub, p) => {
        const k = key(p, pub.track);
        if (k) this.tracker.trackAdded(k, p.identity, false, pub.isMuted);
        this.publishSecurity();
        changed();
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub, p) => {
        // The browser's own "Stop sharing" ends the track: livekit-client unpublishes it, and the stats stop.
        if (pub.source === Track.Source.ScreenShare) this.events.shareStats?.(null);
        this.forget(key(p, pub.track));
      })
      .on(RoomEvent.TrackMuted, (pub, p) => this.muted(key(p, pub.track), true))
      .on(RoomEvent.TrackUnmuted, (pub, p) => this.muted(key(p, pub.track), false))
      .on(RoomEvent.EncryptionError, (_e, p) => {
        if (p && p.identity !== room.localParticipant.identity) this.tracker.participantError(p.identity);
        this.publishSecurity();
        changed();
      })
      .on(RoomEvent.ActiveSpeakersChanged, changed)
      .on(RoomEvent.ConnectionQualityChanged, changed)
      .on(RoomEvent.Reconnecting, () => this.events.reconnecting())
      .on(RoomEvent.SignalReconnecting, () => this.events.reconnecting())
      .on(RoomEvent.Reconnected, () => {
        this.syncSubscriptions();
        this.events.reconnected();
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => this.events.audioBlocked(!room.canPlaybackAudio))
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (!this.closed) this.events.disconnected(reason === undefined ? undefined : DisconnectReason[reason]);
      });
  }

  private onSubscribed(track: RemoteTrack, pub: TrackPublication, p: Participant): void {
    const k = MediaSecurityTracker.key(p.identity, track.mediaStreamID);
    this.tracker.trackAdded(k, p.identity, true, pub.isMuted);
    if (track.kind === Track.Kind.Audio) this.pendingAudio.set(k, track);
    this.publishSecurity();
    this.events.changed();
  }

  private forget(k: string | null): void {
    if (k) this.tracker.trackRemoved(k);
    this.publishSecurity();
    this.events.changed();
  }

  private muted(k: string | null, muted: boolean): void {
    if (k) this.tracker.trackMuted(k, muted);
    this.publishSecurity();
    this.events.changed();
  }

  private onWorkerMessage(data: unknown): void {
    if (!isAuditMessage(data) || this.closed) return;
    let touched = false;
    for (const a of data.data.tracks) touched = this.tracker.audit(a) || touched;
    if (!touched) return;
    this.playProvenAudio();
    this.publishSecurity();
    this.events.changed(); // tiles: who fails, whose video may now show
  }

  private playProvenAudio(): void {
    for (const [k, track] of this.pendingAudio) {
      if (!this.tracker.proven(k)) continue;
      this.pendingAudio.delete(k);
      const el = track.attach();
      el.muted = this.deafened;
      this.audioBox.appendChild(el);
    }
  }

  private publishSecurity(): void {
    const s = this.tracker.security();
    if (s === this.lastSecurity) return;
    this.lastSecurity = s;
    this.events.security(s);
  }

  /** Inbound bytes of remote tracks (proof that media arrives) and the redacted network path, every 2 s. */
  private async sampleFlow(): Promise<void> {
    const room = this.room;
    if (!room) return;
    let bytes: number | null = null;
    let path: string | null = null;
    const watched = this.watched;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        const report = await pub.track?.getRTCStatsReport().catch(() => undefined);
        if (!report) continue;
        const stats = [...report.values()] as { id: string; type: string; bytesReceived?: number }[];
        bytes = (bytes ?? 0) + stats.filter((s) => s.type === "inbound-rtp").reduce((n, s) => n + (s.bytesReceived ?? 0), 0);
        path ??= describePath(stats);
        if (watched && pub.trackSid && shareKey(p.identity, pub.trackSid) === watched) this.events.watchStats?.(receivedVideo(stats));
      }
    }
    if (this.room !== room) return;
    this.events.flow(this.monitor.sample(bytes), path);
    await this.share.sample(Date.now());
  }

  private stopPrepared(): void {
    for (const t of this.prepared) t.stop();
    this.prepared = [];
  }
}

async function open(options: Parameters<typeof createLocalTracks>[0]): Promise<{ tracks: LocalTrack[]; issue: DeviceIssue | null }> {
  try {
    return { tracks: await createLocalTracks(options), issue: null };
  } catch (e) {
    return { tracks: [], issue: deviceIssueOf(e) };
  }
}

/** The account id LiveKit carries for a participant: in the token's metadata, or the identity's first part. */
function userIdOf(p: Participant): string {
  try {
    const meta = JSON.parse(p.metadata ?? "{}") as { userId?: unknown };
    if (typeof meta.userId === "string") return meta.userId;
  } catch {
    /* not ours */
  }
  return p.identity.split(".")[0] ?? "";
}
