import type { VerificationCode } from "./callKeys";

/** Where a call is, from this browser's point of view (android CallPhase). */
export type CallPhase = "idle" | "incoming" | "outgoing" | "connecting" | "connected" | "reconnecting" | "ended";

/**
 * What the encryption badge may claim (android MediaSecurity, rule D-17): `encrypted` only when every live track has
 * been encrypted or decrypted with the call's key, including at least one remote track; `problem` when any current
 * track fails; otherwise `verifying`.
 */
export type MediaSecurity = "verifying" | "encrypted" | "problem";

/** Whether remote media actually arrives (android MediaFlow), from inbound byte counters. */
export type MediaFlow = "none" | "waiting" | "flowing" | "stalled";

/** Why a microphone or camera isn't in use. */
export type DeviceIssue = "denied" | "missing" | "busy" | "failed";

export interface CallParticipantView {
  /** LiveKit identity: `<userId>.<deviceId>`. */
  identity: string;
  userId: string;
  name: string;
  isLocal: boolean;
  speaking: boolean;
  micOn: boolean;
  /** A camera track is published and on (its frames may not have arrived yet). */
  cameraOn: boolean;
  /** Sharing their screen (for someone else: once its frames are proven to decrypt with the call key). */
  screenOn: boolean;
  /** LiveKit rates this person's connection poor or lost. */
  connectionWeak: boolean;
  /** This person's media fails to encrypt or decrypt (shown on their tile, never hidden to make video show). */
  e2eeProblem: boolean;
}

export interface CallUiState {
  phase: CallPhase;
  callId: string | null;
  conversationId: string | null;
  title: string;
  subtitle: string | null;
  colorIndex: number;
  video: boolean;
  isGroup: boolean;
  micOn: boolean;
  cameraOn: boolean;
  /** This browser is sharing its screen. */
  screenSharing: boolean;
  participants: CallParticipantView[];
  /** When the other side joined (starts the timer). */
  connectedAt: number | null;
  security: MediaSecurity;
  verification: VerificationCode | null;
  /** A failure that ended or prevented the call. */
  error: string | null;
  endReason: string | null;
  waitingForKey: boolean;
  /** Outgoing: a recipient device confirmed it is ringing. */
  alerted: boolean;
  media: MediaFlow;
  /** Redacted network path, e.g. "udp · direct"; never addresses. */
  path: string | null;
  /** 1:1: the other person's connection dropped; waiting for them. */
  peerReconnecting: boolean;
  devices: DeviceIssues;
  /** Waiting for the person to answer the browser's microphone or camera prompt. */
  askingPermission: boolean;
  /** The browser blocked sound until the person interacts with the page. */
  audioBlocked: boolean;
  /** Shown as a small bar instead of the full call stage. */
  minimized: boolean;
  /** Counts media connections in this call: video elements attach again after a rejoin. */
  mediaEpoch: number;
}

export const idleCall: CallUiState = {
  phase: "idle",
  callId: null,
  conversationId: null,
  title: "",
  subtitle: null,
  colorIndex: 0,
  video: false,
  isGroup: false,
  micOn: true,
  cameraOn: false,
  screenSharing: false,
  participants: [],
  connectedAt: null,
  security: "verifying",
  verification: null,
  error: null,
  endReason: null,
  waitingForKey: false,
  alerted: false,
  media: "none",
  path: null,
  peerReconnecting: false,
  devices: { microphone: null, camera: null },
  askingPermission: false,
  audioBlocked: false,
  minimized: false,
  mediaEpoch: 0,
};

/** What the server's call API hands a device that may join: a room-scoped LiveKit token. */
export interface MediaGrant {
  url: string;
  token: string;
  room: string;
}

export interface DeviceIssues {
  microphone: DeviceIssue | null;
  camera: DeviceIssue | null;
}

/** The devices a person can choose between during a call. */
export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export interface MediaDeviceChoice {
  deviceId: string;
  label: string;
}

/** A microphone, camera or screen share couldn't be started; [issue] says why. */
export class DeviceError extends Error {
  constructor(
    readonly device: "microphone" | "camera" | "screen",
    readonly issue: DeviceIssue,
  ) {
    super(`${device} ${issue}`);
    this.name = "DeviceError";
  }
}

/** What a media session tells the call manager. */
export interface MediaEvents {
  /** Participants, tracks, mute or speaking changed: read [MediaSession.participants] again. */
  changed(): void;
  security(s: MediaSecurity): void;
  flow(flow: MediaFlow, path: string | null): void;
  reconnecting(): void;
  reconnected(): void;
  /** The media connection ended without this browser asking; [reason] is LiveKit's DisconnectReason name. */
  disconnected(reason: string | undefined): void;
  remoteJoined(): void;
  remoteLeft(remaining: number): void;
  audioBlocked(blocked: boolean): void;
}

/**
 * One connection to a call's media room. The real one is LiveKit with frame encryption (`livekitSession.ts`, loaded
 * only when a call starts); tests use a fake.
 */
export interface MediaSession {
  /**
   * Opens the microphone (and camera for [video]) before joining: this is when the browser asks for permission. Never
   * rejects; says which device couldn't be used and why.
   */
  prepare(video: boolean): Promise<DeviceIssues>;
  /** Joins with frame encryption under [key] and publishes what [prepare] opened; rejects if the room can't be reached. */
  connect(grant: MediaGrant, key: string): Promise<void>;
  /** Rejects with [DeviceError] when the device can't be used. */
  setMicrophone(on: boolean): Promise<void>;
  setCamera(on: boolean): Promise<void>;
  participants(): CallParticipantView[];
  remoteCount(): number;
  /** Shows [identity]'s camera in [el]; returns a function that stops. */
  attachVideo(identity: string, el: HTMLVideoElement): () => void;
  /** Starts or stops sharing this browser's screen (the browser asks which screen or window). Rejects with [DeviceError]. */
  setScreenShare(on: boolean): Promise<void>;
  /** Shows [identity]'s shared screen in [el]; returns a function that stops. */
  attachScreen(identity: string, el: HTMLVideoElement): () => void;
  /** The microphones, cameras or speakers the browser offers (labels once permission was given). */
  listDevices(kind: DeviceKind): Promise<MediaDeviceChoice[]>;
  /** Switches the call to another microphone, camera or speaker. */
  useDevice(kind: DeviceKind, deviceId: string): Promise<void>;
  /** Resumes sound after the browser blocked it (needs a click). */
  startAudio(): Promise<void>;
  disconnect(): Promise<void>;
}

export type MediaFactory = (events: MediaEvents) => MediaSession;
