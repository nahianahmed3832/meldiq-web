/**
 * The other side of the browser call tests. Signalling and the call key go through the server's reference client
 * (byte-compatible with the Android app); media goes through LiveKit's native SDK (@livekit/rtc-node, installed in
 * the Orbit repository's tools/griip-bot), whose frame encryption is libwebrtc's frame cryptor: the same implementation the Android app's
 * LiveKit SDK uses. So the browser's frames are decrypted here by the same code that decrypts them on a phone, and the
 * key goes in the way Android passes it (`setSharedKey(String)`: the key text's UTF-8 bytes). Not a physical-device test.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serverDir } from "../test/support/serverDir";
import type { Phone } from "./phone";

const here = path.dirname(fileURLToPath(import.meta.url));
/** About a second of audio frames. */
const START_UP_FRAMES = 60;
/** tools/griip-bot of the Orbit repository, next to the server folder the tests use (ORBIT_GRIIP_BOT_DIR overrides). */
function botDir(): string {
  if (process.env.ORBIT_GRIIP_BOT_DIR) return path.resolve(process.env.ORBIT_GRIIP_BOT_DIR);
  try {
    return path.resolve(serverDir(), "../tools/griip-bot");
  } catch {
    return path.resolve(here, "../../tools/griip-bot");
  }
}

/** Why the native peer can't run here, or null when it can. */
export function nativePeerMissing(): string | null {
  if (!process.env.ORBIT_E2E_LIVEKIT) return "livekit-server isn't installed (brew install livekit)";
  if (!fs.existsSync(path.join(botDir(), "node_modules/@livekit/rtc-node"))) return `the native LiveKit SDK isn't installed (npm ci in ${botDir()})`;
  return null;
}

async function rtc(): Promise<any> {
  return import(/* @vite-ignore */ createRequire(path.join(botDir(), "package.json")).resolve("@livekit/rtc-node"));
}

export interface Received {
  frames: number;
  /** Audio frames with sound in them (decrypted noise or silence has none). */
  audible: number;
  /** Indexes (in arrival order) of the frames with sound: tells a moment of start-up noise from sustained audio. */
  audibleAt: number[];
  width?: number;
}

/** A native LiveKit participant publishing a 440 Hz tone (and a moving pattern for video), counting what it receives. */
export class NativeMedia {
  readonly received: Record<"audio" | "video", Received> = { audio: { frames: 0, audible: 0, audibleAt: [] }, video: { frames: 0, audible: 0, audibleAt: [] } };
  private timer: ReturnType<typeof setInterval> | undefined;

  private constructor(private readonly room: any) {}

  static async join(media: { url: string; token: string }, key: string, video: boolean): Promise<NativeMedia> {
    const lk = await rtc();
    const room = new lk.Room();
    const peer = new NativeMedia(room);
    room.on(lk.RoomEvent.TrackSubscribed, (track: any) => peer.count(lk, track));
    await room.connect(media.url, media.token, { autoSubscribe: true, dynacast: false, encryption: { keyProviderOptions: { sharedKey: new TextEncoder().encode(key) } } });
    await peer.publish(lk, video);
    return peer;
  }

  private count(lk: any, track: any): void {
    if (track.kind === lk.TrackKind.KIND_VIDEO) {
      const r = this.received.video;
      void (async () => {
        for await (const ev of new lk.VideoStream(track)) {
          r.frames++;
          r.width = ev.frame.width;
        }
      })().catch(() => undefined);
    } else {
      const r = this.received.audio;
      void (async () => {
        for await (const frame of new lk.AudioStream(track, 48000, 1)) {
          r.frames++;
          if (frame.data.some((s: number) => Math.abs(s) > 300)) {
            r.audible++;
            r.audibleAt.push(r.frames);
          }
        }
      })().catch(() => undefined);
    }
  }

  private async publish(lk: any, video: boolean): Promise<void> {
    const audio = new lk.AudioSource(48000, 1);
    const cam = new lk.VideoSource(640, 360);
    await this.room.localParticipant.publishTrack(lk.LocalAudioTrack.createAudioTrack("mic", audio), new lk.TrackPublishOptions({ source: lk.TrackSource.SOURCE_MICROPHONE }));
    if (video) await this.room.localParticipant.publishTrack(lk.LocalVideoTrack.createVideoTrack("cam", cam), new lk.TrackPublishOptions({ source: lk.TrackSource.SOURCE_CAMERA }));
    let t = 0;
    this.timer = setInterval(() => {
      const f = lk.AudioFrame.create(48000, 1, 4800);
      for (let i = 0; i < f.data.length; i++) f.data[i] = Math.round(Math.sin(((t * 4800 + i) * 2 * Math.PI * 440) / 48000) * 6000);
      void audio.captureFrame(f);
      if (video) {
        const px = new Uint8Array(640 * 360 * 4);
        for (let i = 0; i < px.length; i += 4) {
          px[i] = (t * 5 + (i >> 9)) & 255;
          px[i + 1] = 120;
          px[i + 2] = 200;
          px[i + 3] = 255;
        }
        cam.captureFrame(new lk.VideoFrame(px, 640, 360, lk.VideoBufferType.RGBA));
      }
      t++;
    }, 100);
  }

  /**
   * Audio frames with sound after the first [START_UP_FRAMES]: the browser's microphone, decrypted. Until its frame
   * cryptor is ready, LiveKit's native SDK hands frames to the decoder as they arrived (its
   * `discardFrameWhenCryptorNotReady` defaults to false), and Opus turns that ciphertext into a moment of noise, always
   * within the first handful of frames (measured: frames 1 to 6). Sound after that can only come from decryption.
   */
  sustainedAudio(): number {
    return this.received.audio.audibleAt.filter((i) => i > START_UP_FRAMES).length;
  }

  /**
   * Shares a "screen" of [width]×[height] (a phone in portrait is taller than wide), as the Android app publishes one: a
   * grey picture with a coloured band on each edge (red top, green bottom, blue left, yellow right), so a crop shows.
   */
  async shareScreen(width: number, height: number): Promise<void> {
    const lk = await rtc();
    const source = new lk.VideoSource(width, height);
    const pub = await this.room.localParticipant.publishTrack(lk.LocalVideoTrack.createVideoTrack("screen", source), new lk.TrackPublishOptions({ source: lk.TrackSource.SOURCE_SCREENSHARE }));
    this.screenSid = pub.sid;
    const band = Math.max(8, Math.round(Math.min(width, height) / 12));
    const px = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const rgb = y < band ? [230, 30, 30] : y >= height - band ? [30, 200, 60] : x < band ? [40, 80, 230] : x >= width - band ? [240, 210, 30] : [128, 128, 128];
        px.set([...rgb, 255], (y * width + x) * 4);
      }
    this.screenTimer = setInterval(() => source.captureFrame(new lk.VideoFrame(px, width, height, lk.VideoBufferType.RGBA)), 100);
  }

  private screenTimer: ReturnType<typeof setInterval> | undefined;
  private screenSid: string | undefined;

  /** Stops the shared screen, as the phone's Stop sharing does (the track is unpublished). */
  async stopScreen(): Promise<void> {
    clearInterval(this.screenTimer);
    if (this.screenSid) await this.room.localParticipant.unpublishTrack(this.screenSid);
    this.screenSid = undefined;
  }

  async leave(): Promise<void> {
    clearInterval(this.timer);
    clearInterval(this.screenTimer);
    await this.room.disconnect().catch(() => undefined);
  }
}

export interface PlacedCall {
  id: string;
  key: string;
  media: NativeMedia;
}

/** [caller] starts a call as the Android app does: the call API, then the key in an encrypted `call_invite`. */
export async function placeCall(caller: Phone, conversationId: string, video: boolean, opts: { mediaKey?: string } = {}): Promise<PlacedCall> {
  const res = await caller.req("POST", "/v1/calls", { conversationId, video });
  const key = crypto.randomBytes(32).toString("base64");
  await caller.send(conversationId, { type: "call_invite", callId: res.call.id, video, e2eeKey: key }, "control");
  const media = await NativeMedia.join(res.media, opts.mediaKey ?? key, video);
  return { id: res.call.id, key, media };
}

/** [callee] answers a ringing call with the key its `call_invite` carried. */
export async function answerCall(callee: Phone, video: boolean): Promise<PlacedCall> {
  const ring = await waitUntil(() => callee.events.find((e: any) => e.t === "call" && e.event === "ring"), 20_000, "a ring");
  const invite = await waitUntil(() => callee.received.find((m: any) => m.payload?.type === "call_invite" && m.payload.callId === ring.call.id), 20_000, "the call key");
  const join = await callee.req("POST", `/v1/calls/${ring.call.id}/join`);
  const media = await NativeMedia.join(join.media, (invite.payload as any).e2eeKey, video);
  await callee.req("POST", `/v1/calls/${ring.call.id}/connected`);
  return { id: ring.call.id, key: (invite.payload as any).e2eeKey, media };
}

export async function waitUntil<T>(fn: () => T | undefined | null | false, timeoutMs: number, what: string): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
