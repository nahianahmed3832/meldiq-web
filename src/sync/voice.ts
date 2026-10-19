/**
 * Voice messages recorded in the browser (docs/VOICE_MESSAGES.md): sent as an ordinary encrypted attachment marked
 * `voice` with its length, exactly like the phone's. The phone records AAC in MP4; browsers record what they can:
 * MP4/AAC where supported (Safari, recent Chrome), otherwise Opus in WebM (Chrome, Edge) or Ogg (Firefox).
 */
export const VOICE_MIN_MS = 1000;
export const VOICE_MAX_MS = 10 * 60_000;
const BITRATE = 48_000;

const PREFERRED = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];

/** The best recording format this browser offers, or null when it can't record audio. */
export function voiceMime(isSupported: (t: string) => boolean = (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)): string | null {
  return PREFERRED.find(isSupported) ?? null;
}

/** "audio/webm;codecs=opus" → "audio/webm": what goes in the attachment reference. */
export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function voiceFileName(mime: string, at = new Date()): string {
  const ext = baseMime(mime) === "audio/mp4" ? "m4a" : baseMime(mime) === "audio/ogg" ? "ogg" : "webm";
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  return `voice-${stamp}.${ext}`;
}

/** "0:07", "12:30". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Only an attachment marked voice and typed audio/* plays as a voice message (android VoiceNote.isVoice). */
export function isVoice(ref: { voice?: boolean; mime: string }): boolean {
  return ref.voice === true && ref.mime.toLowerCase().startsWith("audio/");
}

/** A peer's duration is display-only and clamped (it comes from another device). */
export function shownDuration(durationMs: number | undefined): number {
  return Math.min(Math.max(durationMs ?? 0, 0), VOICE_MAX_MS);
}

export interface Recording {
  blob: Blob;
  mime: string;
  durationMs: number;
}

export class RecordingError extends Error {}

/** One recording at a time from the microphone; stops by itself at the length limit. */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private limit: ReturnType<typeof setTimeout> | undefined;
  private done: ((r: Recording | null) => void) | null = null;

  constructor(private readonly onLimit: () => void) {}

  get elapsedMs(): number {
    return this.recorder ? Date.now() - this.startedAt : 0;
  }

  async start(): Promise<void> {
    const mime = voiceMime();
    if (!mime) throw new RecordingError("This browser can't record audio.");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      throw new RecordingError(
        name === "NotAllowedError"
          ? "Meldiq isn't allowed to use your microphone. Allow it in your browser's site settings and try again."
          : name === "NotFoundError"
            ? "No microphone was found."
            : "The microphone couldn't be started. It may be in use by another app.",
      );
    }
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime, audioBitsPerSecond: BITRATE });
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.onstop = () => this.finish(mime);
    this.recorder.start(1000);
    this.startedAt = Date.now();
    this.limit = setTimeout(() => {
      this.onLimit();
    }, VOICE_MAX_MS);
  }

  /** Stops and returns the clip, or null when it was too short to send. */
  stop(): Promise<Recording | null> {
    if (!this.recorder || this.recorder.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      this.done = resolve;
      this.recorder!.stop();
    });
  }

  /** Stops and throws the clip away. */
  cancel(): void {
    this.done = null;
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.release();
  }

  private finish(mime: string): void {
    const durationMs = Math.min(Date.now() - this.startedAt, VOICE_MAX_MS);
    const blob = new Blob(this.chunks, { type: baseMime(mime) });
    this.release();
    const done = this.done;
    this.done = null;
    done?.(durationMs < VOICE_MIN_MS ? null : { blob, mime: baseMime(mime), durationMs });
  }

  private release(): void {
    clearTimeout(this.limit);
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}
