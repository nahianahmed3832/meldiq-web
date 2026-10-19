import type { CallParticipantView, DeviceIssues, MediaEvents, MediaFactory, MediaGrant, MediaSession } from "../../src/call/types";

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
  prepared: boolean | null = null;

  constructor(
    readonly events: MediaEvents,
    private readonly rig: MediaRig,
  ) {}

  async prepare(video: boolean): Promise<DeviceIssues> {
    this.prepared = video;
    const issues = this.rig.issues;
    this.mic = !issues.microphone;
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
    const me: CallParticipantView = { identity: "me", userId: "me", name: "You", isLocal: true, speaking: false, micOn: this.mic, cameraOn: this.camera, connectionWeak: false, e2eeProblem: false };
    const others = Array.from({ length: this.remote }, (_, i) => ({ ...me, identity: `peer${i}`, userId: `peer${i}`, name: `Peer ${i}`, isLocal: false }));
    return [...others, me];
  }

  remoteCount(): number {
    return this.remote;
  }

  attachVideo(): () => void {
    return () => undefined;
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
  }
}
