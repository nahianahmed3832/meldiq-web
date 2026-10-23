import { useSyncExternalStore } from "react";
import { DEV } from "./env";

/**
 * One voice message plays at a time (2026-10-24). Every voice message player on the page (any conversation, side panel
 * or route, and the composer's preview) plays through this one controller and its one audio element, so starting B
 * pauses A at once: there is never a second element that could keep playing. A player that goes away (unmounted by
 * navigation, a closed panel), and signing out, stop what it played. Call audio and notification sounds don't use it.
 */
export type VoiceStatus = "idle" | "loading" | "playing" | "paused";

/** What the players draw: which clip is current, and where it is. Replaced as a whole on every change. */
export interface VoicePlaybackState {
  key: string | null;
  status: VoiceStatus;
  positionMs: number;
  rate: number;
  /** The browser refused to play (autoplay rules, a format it can't decode): shown on that clip until it's asked again. */
  failed: string | null;
}

/** The parts of an HTMLAudioElement the controller uses (a fake in tests). */
export interface AudioOutput {
  src: string;
  currentTime: number;
  playbackRate: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
  addEventListener(type: string, listener: () => void): void;
}

/** Speeds a voice message can play at (android VoiceViews: 1×, 1.5×, 2×). */
export const VOICE_RATES = [1, 1.5, 2] as const;
/** Positions remembered for clips paused part-way (oldest forgotten first). */
const MAX_REMEMBERED = 200;

const IDLE: VoicePlaybackState = { key: null, status: "idle", positionMs: 0, rate: 1, failed: null };

export class VoicePlayback {
  private audio: AudioOutput | null = null;
  private state: VoicePlaybackState = IDLE;
  private url: string | null = null;
  /** Bumped whenever the current clip changes or stops: a play() answer for an older request is ignored. */
  private attempt = 0;
  private pendingSeekMs: number | null = null;
  private readonly positions = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly createAudio: () => AudioOutput) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly snapshot = (): VoicePlaybackState => this.state;

  /** Where [key] was left, for a clip that isn't current (0 when it was never played or played to the end). */
  positionOf(key: string): number {
    return this.state.key === key ? this.state.positionMs : (this.positions.get(key) ?? 0);
  }

  /**
   * The person asked to play [key]. Whatever plays now pauses at once (keeping its place); [key] plays from where it was
   * left as soon as its decrypted [url] is known (now, or later through [provide]).
   */
  play(key: string, url: string | null): void {
    if (this.state.key === key && this.state.status === "playing") return;
    if (this.state.key !== key) this.switchTo(key);
    if (url) this.start(url);
    else this.set({ status: "loading", failed: null });
  }

  /** [key]'s audio was decrypted: it starts if it's still the one asked for (a later request wins). */
  provide(key: string, url: string): void {
    if (this.state.key === key && this.state.status === "loading") this.start(url);
  }

  /** Play or pause [key] (the player's one button). */
  toggle(key: string, url: string | null): void {
    if (this.state.key === key && (this.state.status === "playing" || this.state.status === "loading")) this.pause(key);
    else this.play(key, url);
  }

  pause(key: string): void {
    if (this.state.key !== key) return;
    this.attempt++;
    this.audio?.pause();
    this.set({ status: "paused" });
  }

  /** Moves [key] to [ms]: the current clip seeks now; another remembers it for when it plays. */
  seek(key: string, ms: number): void {
    const at = Math.max(0, ms);
    if (this.state.key !== key) {
      this.remember(key, at);
      this.state = { ...this.state }; // a new snapshot, so that player redraws its place
      this.emit();
      return;
    }
    if (this.audio && this.url) this.audio.currentTime = at / 1000;
    else this.pendingSeekMs = at;
    this.set({ positionMs: at });
  }

  /** The next speed after the current one (1× → 1.5× → 2× → 1×); it carries on to the next message, as on the phone. */
  cycleRate(): void {
    const i = VOICE_RATES.indexOf(this.state.rate as (typeof VOICE_RATES)[number]);
    const rate = VOICE_RATES[(i + 1) % VOICE_RATES.length];
    if (this.audio) this.audio.playbackRate = rate;
    this.set({ rate });
  }

  /** A player went away (unmounted): if it was playing or loading, playback stops. Its place is remembered. */
  release(key: string): void {
    if (this.state.key !== key) return;
    this.remember(key, this.state.positionMs);
    this.stopAudio();
    this.state = { ...IDLE, rate: this.state.rate };
    this.emit();
  }

  /** Signing out, or the session ending: nothing keeps playing and nothing is remembered. */
  reset(): void {
    this.stopAudio();
    this.positions.clear();
    this.state = IDLE;
    this.emit();
  }

  private switchTo(key: string): void {
    if (this.state.key) this.remember(this.state.key, this.state.status === "idle" ? 0 : this.state.positionMs);
    this.stopAudio();
    this.state = { ...this.state, key, status: "loading", positionMs: this.positions.get(key) ?? 0, failed: null };
    this.pendingSeekMs = this.state.positionMs;
  }

  private start(url: string): void {
    const audio = this.output();
    const attempt = ++this.attempt;
    if (this.url !== url) {
      this.url = url;
      audio.src = url;
      this.pendingSeekMs ??= this.state.positionMs;
    }
    if (this.pendingSeekMs !== null) {
      // Before its metadata arrives a new source may ignore this; "loadedmetadata" applies it again.
      audio.currentTime = this.pendingSeekMs / 1000;
    }
    audio.playbackRate = this.state.rate;
    this.set({ status: "playing", failed: null });
    audio.play().then(
      () => undefined,
      (e: unknown) => {
        // Paused, or another clip asked for, before the browser started this one: not a failure.
        if (attempt !== this.attempt) return;
        this.set({ status: "paused", failed: playFailure(e) });
      },
    );
  }

  private output(): AudioOutput {
    if (this.audio) return this.audio;
    const audio = this.createAudio();
    const current = () => this.url !== null && audio.src === this.url;
    audio.addEventListener("loadedmetadata", () => {
      if (!current() || this.pendingSeekMs === null) return;
      audio.currentTime = this.pendingSeekMs / 1000;
      this.pendingSeekMs = null;
    });
    audio.addEventListener("timeupdate", () => {
      if (!current() || this.state.status !== "playing") return;
      this.set({ positionMs: Math.round(audio.currentTime * 1000) });
    });
    audio.addEventListener("ended", () => {
      if (!current() || !this.state.key) return;
      this.attempt++;
      this.positions.delete(this.state.key);
      this.set({ status: "idle", positionMs: 0 });
    });
    // Paused from outside the page (the system's media keys, another tab taking audio focus).
    audio.addEventListener("pause", () => {
      if (current() && this.state.status === "playing" && audio.paused) this.set({ status: "paused" });
    });
    this.audio = audio;
    return audio;
  }

  private stopAudio(): void {
    this.attempt++;
    this.pendingSeekMs = null;
    // Forgotten first, so the element's own "pause" event for it changes nothing.
    const had = this.url;
    this.url = null;
    if (!this.audio) return;
    this.audio.pause();
    if (had) {
      this.audio.removeAttribute("src");
      this.audio.load();
    }
  }

  private remember(key: string, ms: number): void {
    this.positions.delete(key);
    if (ms > 0) this.positions.set(key, ms);
    while (this.positions.size > MAX_REMEMBERED) this.positions.delete(this.positions.keys().next().value as string);
  }

  private set(patch: Partial<VoicePlaybackState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit(): void {
    for (const l of [...this.listeners]) l();
  }
}

function playFailure(e: unknown): string {
  const name = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name: unknown }).name) : "";
  if (name === "NotAllowedError") return "Your browser blocked playback. Click play again.";
  if (name === "NotSupportedError") return "This browser can't play this voice message.";
  return "This voice message couldn't play.";
}

/** The page's one controller (its audio element is made on first play). */
export const voicePlayback = new VoicePlayback(() => new Audio());
// Development builds only: the browser tests read what plays.
if (DEV && typeof window !== "undefined") (window as unknown as { __voicePlayback?: VoicePlayback }).__voicePlayback = voicePlayback;

/** The controller's state, for a player; it re-renders on every change. */
export function useVoicePlayback(controller: VoicePlayback = voicePlayback): VoicePlaybackState {
  return useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
}
