import type { VerificationCode } from "./callKeys";
import type { ShareQuality, ShareStats } from "./shareQuality";
import type { CallShareView } from "./shares";

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
  /** Draw the camera mirrored: only your own front-facing camera (rules.mirrorPreview). */
  mirrored: boolean;
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
  /** A voice room's call (docs/VOICE_ROOMS.md): nobody rings, people raise hands, the room's managers moderate. */
  voiceRoom: boolean;
  /** Voice rooms: who raised a hand, in order (the server's list). */
  hands: string[];
  /** Voice rooms: this person manages the room, so may mute, lower hands and remove people. */
  canModerate: boolean;
  /** Something to tell the person during the call (a manager muted them, a request failed). */
  notice: string | null;
  /** Batch B10: you hear nobody and your microphone is off. */
  deafened: boolean;
  /** The quality this browser shares its screen at (2026-10-24: Standard 720p30 or High 1080p60), and whether with sound. */
  shareQuality: ShareQuality | null;
  /** The qualities this person may share at in this call (Meldiq Mojo: their plan and the community's Sparks), lowest first. */
  shareQualities: ShareQuality[];
  shareAudio: boolean;
  /** What this browser's share actually captures and sends (null when not sharing). */
  shareStats: ShareStats | null;
  /** Every screen shared in the call now, yours included, in the order they started. */
  shares: CallShareView[];
  /** The share this browser watches (only it is received in full); null shows the people. Local to this browser. */
  watching: string | null;
  /** The person went back to the people themselves: a new share waits in the tray instead of opening. */
  watchDismissed: boolean;
  /** The watched share as it arrives here (null until its first frames). */
  watchStats: { width: number; height: number; fps: number } | null;
  /** A voice channel you may join but not talk in (voice.speak): listen only. */
  listenOnly: boolean;
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
  voiceRoom: false,
  hands: [],
  canModerate: false,
  notice: null,
  deafened: false,
  shareQuality: null,
  shareQualities: ["standard", "high"],
  shareAudio: false,
  shareStats: null,
  shares: [],
  watching: null,
  watchDismissed: false,
  watchStats: null,
  listenOnly: false,
};

/** What the server's call API hands a device that may join: a room-scoped LiveKit token. */
export interface MediaGrant {
  url: string;
  token: string;
  room: string;
  /** Meldiq Mojo (API 0.54.0): what this person may publish here; absent from older servers. */
  limits?: { screen: { id: string; width: number; height: number; fps: number }[]; voiceKbps: number } | null;
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

/** How the microphone opens (batch B10): noise reduction, and none at all in a listen-only voice channel. */
export interface PrepareOptions {
  noiseReduction?: boolean;
  /** Settings › Voice & Audio (2026-10-28): echo cancellation and automatic gain, each on unless turned off. */
  echoCancellation?: boolean;
  autoGain?: boolean;
  /** The microphone chosen there (null: the system's default). */
  microphoneId?: string | null;
  microphone?: boolean;
}

/** Where calls play and how loud (Settings › Voice & Audio): the speaker (null: default) and 0–100. */
export interface OutputOptions {
  speakerId: string | null;
  volume: number;
}

/** How a screen is shared: Standard or High, and the shared tab's or system's sound where the browser allows. */
export interface ShareOptions {
  quality: ShareQuality;
  audio: boolean;
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
  /** Batch B11: someone else stopped sharing their screen. */
  shareEnded?(name: string): void;
  /** This browser's share: what it captures and sends (every few seconds while sharing; null when it stops). */
  shareStats?(stats: ShareStats | null): void;
  /** The watched share as received here. */
  watchStats?(stats: { width: number; height: number; fps: number } | null): void;
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
  prepare(video: boolean, opts?: PrepareOptions): Promise<DeviceIssues>;
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
  setScreenShare(on: boolean, opts?: ShareOptions): Promise<void>;
  /** Batch B10 deafen: nobody's sound plays (people who join later too) until turned off. */
  setDeafened(on: boolean): void;
  /** The speaker and volume for everyone's sound (people who join later too). Optional: older fakes leave it out. */
  setOutput?(opts: OutputOptions): void;
  /** Changes the quality of this browser's share while it runs. */
  setShareQuality(quality: ShareQuality): Promise<void>;
  /** Every screen shared in the call now, this browser's included. */
  shares(): CallShareView[];
  /** Receives only [key]'s share (at full quality) and none of the others' video or sound; null receives none. */
  watchShare(key: string | null): void;
  /** Shows the share [key] in [el]; returns a function that stops. */
  attachShare(key: string, el: HTMLVideoElement): () => void;
  /** The microphones, cameras or speakers the browser offers (labels once permission was given). */
  listDevices(kind: DeviceKind): Promise<MediaDeviceChoice[]>;
  /** Switches the call to another microphone, camera or speaker. */
  useDevice(kind: DeviceKind, deviceId: string): Promise<void>;
  /** Resumes sound after the browser blocked it (needs a click). */
  startAudio(): Promise<void>;
  disconnect(): Promise<void>;
}

export type MediaFactory = (events: MediaEvents) => MediaSession;
