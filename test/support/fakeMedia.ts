import {
  type CallParticipantView,
  DeviceError,
  type DeviceIssues,
  type DeviceKind,
  type MediaDeviceChoice,
  type MediaEvents,
  type MediaFactory,
  type MediaGrant,
  type MediaSession,
  type PrepareOptions,
  type ShareOptions,
} from "../../src/call/types";

/**
 * A stand-in for the LiveKit media connection: records what the call manager asked for (above all, which key it
 * joined with) and lets a test play the room's events. Real media is covered by the browser tests (e2e/calls.spec.ts).
 */
export class FakeMedia implements MediaSession {
  connected: { grant: MediaGrant; key: string } | null = null;
  disconnected = false;
  remote = 0;
  mic = false;
  camera = false;
  screen = false;
  device: Record<string, string> = {};
  prepared: boolean | null = null;
  prepareOptions: PrepareOptions | null = null;
  shareOptions: ShareOptions | null = null;
  deafened = false;

  constructor(
    readonly events: MediaEvents,
    private readonly rig: MediaRig,
  ) {}

  async prepare(video: boolean, opts: PrepareOptions = {}): Promise<DeviceIssues> {
    this.prepared = video;
    this.prepareOptions = opts;
    const issues = this.rig.issues;
    this.mic = !issues.microphone && opts.microphone !== false;
    this.camera = video && !issues.camera;
    return issues;
  }

  async connect(grant: MediaGrant, key: string): Promise<void> {
    if (this.rig.failConnect) throw new Error(this.rig.failConnect);
    this.connected = { grant, key };
    this.remote = this.rig.remoteOnConnect;
  }

  async setMicrophone(on: boolean): Promise<void> {
    this.mic = on;
  }

  async setCamera(on: boolean): Promise<void> {
    this.camera = on;
  }

  participants(): CallParticipantView[] {
    const me: CallParticipantView = {
      identity: "me",
      userId: "me",
      name: "You",
      isLocal: true,
      speaking: false,
      micOn: this.mic,
      cameraOn: this.camera,
      screenOn: this.screen,
      connectionWeak: false,
      e2eeProblem: false,
      mirrored: true,
    };
    const others = Array.from({ length: this.remote }, (_, i) => ({ ...me, identity: `peer${i}`, userId: `peer${i}`, name: `Peer ${i}`, isLocal: false, screenOn: false, mirrored: false }));
    return [...others, me];
  }

  remoteCount(): number {
    return this.remote;
  }

  attachVideo(): () => void {
    return () => undefined;
  }

  async setScreenShare(on: boolean, opts?: ShareOptions): Promise<void> {
    if (on && this.rig.screenRefused) throw new DeviceError("screen", "denied");
    this.screen = on;
    this.shareOptions = opts ?? null;
  }

  setDeafened(on: boolean): void {
    this.deafened = on;
  }

  attachScreen(): () => void {
    return () => undefined;
  }

  async listDevices(kind: DeviceKind): Promise<MediaDeviceChoice[]> {
    return [1, 2].map((i) => ({ deviceId: `${kind}-${i}`, label: `${kind} ${i}` }));
  }

  async useDevice(kind: DeviceKind, deviceId: string): Promise<void> {
    this.device[kind] = deviceId;
  }

  async startAudio(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.disconnected = true;
  }
}

/** Settings for the next sessions, and every session made so far. */
export class MediaRig {
  sessions: FakeMedia[] = [];
  issues: DeviceIssues = { microphone: null, camera: null };
  remoteOnConnect = 1;
  failConnect: string | null = null;
  screenRefused = false;

  readonly factory: MediaFactory = (events) => {
    const s = new FakeMedia(events, this);
    this.sessions.push(s);
    return s;
  };

  get last(): FakeMedia | undefined {
    return this.sessions[this.sessions.length - 1];
  }

  reset(): void {
    this.issues = { microphone: null, camera: null };
    this.remoteOnConnect = 1;
    this.failConnect = null;
    this.screenRefused = false;
  }
}
