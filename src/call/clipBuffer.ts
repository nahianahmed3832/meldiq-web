export interface ClipSources {
  revision: number;
  tracks: MediaStreamTrack[];
}

const CLIP_MS = 12_000;
const MIN_CURRENT_MS = 1_000;
const MAX_BYTES = 8_000_000;

export function clipSourceKey(sources: ClipSources): string {
  return `${sources.revision}:${sources.tracks
    .map((track) => track.id)
    .sort()
    .join(",")}`;
}

/** Each segment has its own container header and can play independently, including in Safari. */
export class ClipBuffer {
  private readonly context: AudioContext | null;
  private readonly stream: MediaStream;
  private recorder: MediaRecorder | null = null;
  private latest: Blob | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startAt = 0;
  private disposed = false;
  private capturing = false;
  private pendingCapture: ((blob: Blob | null) => void) | undefined;

  constructor(tracks: readonly MediaStreamTrack[]) {
    const audio = tracks.filter((track) => track.kind === "audio");
    const video = tracks.find((track) => track.kind === "video");
    this.context = audio.length > 1 ? new AudioContext() : null;
    this.stream = new MediaStream(video ? [video] : []);
    if (this.context) {
      const mix = this.context.createMediaStreamDestination();
      for (const track of audio) {
        const input = this.context.createMediaStreamSource(new MediaStream([track]));
        const gain = this.context.createGain();
        gain.gain.value = 1 / Math.sqrt(audio.length);
        input.connect(gain).connect(mix);
      }
      for (const track of mix.stream.getAudioTracks()) this.stream.addTrack(track);
      void this.context.resume().catch(() => undefined);
    } else if (audio[0]) this.stream.addTrack(audio[0]);
  }

  start(): void {
    if (this.disposed || this.recorder || !this.stream.getTracks().length) return;
    const recorder = new MediaRecorder(this.stream, { videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    let bytes = 0;
    this.recorder = recorder;
    this.startAt = performance.now();
    recorder.ondataavailable = ({ data }) => {
      bytes += data.size;
      if (!this.disposed && data.size && bytes <= MAX_BYTES) chunks.push(data);
    };
    recorder.onerror = () => this.stop();
    recorder.onstop = () => {
      clearTimeout(this.timer);
      if (this.disposed) return;
      const segment = bytes <= MAX_BYTES && chunks.length ? new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }) : null;
      this.recorder = null;
      if (this.capturing) {
        this.pendingCapture?.(segment ?? this.latest);
        this.pendingCapture = undefined;
        this.capturing = false;
      } else {
        this.latest = segment;
      }
      try {
        this.start();
      } catch {
        this.stop();
      }
    };
    recorder.start(1_000);
    this.timer = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, CLIP_MS);
  }

  capture(): Promise<Blob | null> {
    if (!this.recorder || this.recorder.state === "inactive" || this.capturing) return Promise.resolve(this.latest);
    if (this.latest && performance.now() - this.startAt < MIN_CURRENT_MS) return Promise.resolve(this.latest);
    this.capturing = true;
    return new Promise((resolve) => {
      this.pendingCapture = resolve;
      this.recorder?.stop();
    });
  }

  stop(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
    this.latest = null;
    this.pendingCapture?.(null);
    this.pendingCapture = undefined;
    // The tracks published to LiveKit are owned by the call.
    if (this.context) void this.context.close().catch(() => undefined);
  }
}
