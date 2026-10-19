import {
  ConnectionQuality,
  createLocalTracks,
  DisconnectReason,
  ExternalE2EEKeyProvider,
  type LocalTrack,
  type Participant,
  type RemoteTrack,
  LogLevel,
  Room,
  RoomEvent,
  setLogLevel,
  Track,
  type TrackPublication,
  VideoPresets,
} from "livekit-client";
import { isAuditMessage } from "./frameAudit";
import { describePath, deviceIssueOf, MediaFlowMonitor } from "./rules";
import { MediaSecurityTracker } from "./security";
import { type CallParticipantView, DeviceError, type DeviceIssue, type DeviceIssues, type MediaEvents, type MediaGrant, type MediaSecurity, type MediaSession } from "./types";

// LiveKit's own logging stays at warnings: its signalling URL carries the call pass (android keeps SDK logging off).
setLogLevel(LogLevel.warn);

/** Camera capture and sending, as the Android app does (CallMediaPolicy: 720p, simulcast, VP8). */
const CAMERA = { resolution: VideoPresets.h720.resolution };
const FLOW_SAMPLE_MS = 2_000;

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

  constructor(private readonly events: MediaEvents) {
    this.audioBox.hidden = true;
    this.audioBox.dataset.orbitCallAudio = "";
  }

  async prepare(video: boolean): Promise<DeviceIssues> {
    const both = await open({ audio: true, video: video ? CAMERA : false });
    if (!both.issue) this.prepared = both.tracks;
    else if (!video) return this.settle({ microphone: both.issue, camera: null });
    else {
      // One of the two failed: open each alone to tell which (the browser remembers the answer, so no second prompt).
      const mic = await open({ audio: true, video: false });
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
      publishDefaults: { simulcast: true, videoCodec: "vp8", dtx: true },
      videoCaptureDefaults: CAMERA,
    });
    this.room = room;
    this.wire(room);
    // Development builds only (removed from production bundles): what the badge rests on, for the browser tests.
    if (import.meta.env.DEV) (globalThis as { __orbitCallTracks?: () => unknown }).__orbitCallTracks = () => this.tracker.snapshot();
    document.body.appendChild(this.audioBox);
    await keyProvider.setKey(key);
    await room.setE2EEEnabled(true);
    await room.connect(grant.url, grant.token, { autoSubscribe: true });
    if (this.closed) throw new Error("call closed while connecting");
    for (const t of this.prepared) await room.localParticipant.publishTrack(t, { simulcast: t.kind === Track.Kind.Video });
    this.prepared = [];
    this.events.audioBlocked(!room.canPlaybackAudio);
    this.flowTimer = setInterval(() => void this.sampleFlow(), FLOW_SAMPLE_MS);
  }

  async setMicrophone(on: boolean): Promise<void> {
    try {
      await this.room?.localParticipant.setMicrophoneEnabled(on);
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

  participants(): CallParticipantView[] {
    const room = this.room;
    if (!room) return [];
    const problems = this.tracker.problemIdentities();
    const view = (p: Participant, isLocal: boolean): CallParticipantView => {
      const cam = p.getTrackPublication(Track.Source.Camera);
      return {
        identity: p.identity,
        userId: userIdOf(p),
        name: p.name || (isLocal ? "You" : "Participant"),
        isLocal,
        speaking: p.isSpeaking,
        micOn: p.isMicrophoneEnabled,
        // Someone else's video shows only once its frames are proven to decrypt with the call key (see pendingAudio).
        cameraOn: !!cam && !cam.isMuted && !!cam.track && (isLocal || this.tracker.proven(MediaSecurityTracker.key(p.identity, cam.track.mediaStreamID))),
        connectionWeak: p.connectionQuality === ConnectionQuality.Poor || p.connectionQuality === ConnectionQuality.Lost,
        e2eeProblem: problems.has(p.identity),
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
        this.events.remoteJoined();
        changed();
      })
      .on(RoomEvent.ParticipantDisconnected, (p) => {
        this.tracker.participantLeft(p.identity);
        this.publishSecurity();
        this.events.remoteLeft(room.remoteParticipants.size);
        changed();
      })
      .on(RoomEvent.TrackSubscribed, (track, pub, p) => this.onSubscribed(track, pub, p))
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
      .on(RoomEvent.LocalTrackUnpublished, (pub, p) => this.forget(key(p, pub.track)))
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
      .on(RoomEvent.Reconnected, () => this.events.reconnected())
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
      this.audioBox.appendChild(track.attach());
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
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        const report = await pub.track?.getRTCStatsReport().catch(() => undefined);
        if (!report) continue;
        const stats = [...report.values()] as { id: string; type: string; bytesReceived?: number }[];
        bytes = (bytes ?? 0) + stats.filter((s) => s.type === "inbound-rtp").reduce((n, s) => n + (s.bytesReceived ?? 0), 0);
        path ??= describePath(stats);
      }
    }
    if (this.room !== room) return;
    this.events.flow(this.monitor.sample(bytes), path);
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
