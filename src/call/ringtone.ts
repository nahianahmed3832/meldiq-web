import { loadSound, playBuffer, RINGTONE_SOUND } from "../application/soundFiles";

/**
 * The incoming-call ring: Meldiq's classic phone ring (application/soundFiles.ts, 2026-10-28), looped until answered or
 * gone; a soft two-tone ring made with Web Audio while the file loads or if it can't. Browsers may block sound until the
 * page has been clicked; then the ring is silent and the incoming-call card and system notification carry the call.
 */
const PATTERN_MS = 3_000;
const TONES = [
  { at: 0, hz: 660 },
  { at: 0.45, hz: 550 },
  { at: 0.9, hz: 660 },
  { at: 1.35, hz: 550 },
];
const TONE_S = 0.35;
const VOLUME = 0.08;
/** The ring file's level (it's mastered loud). */
const FILE_VOLUME = 0.45;

export class Ringtone {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private loop: AudioBufferSourceNode | null = null;

  /** [enabled]: the person's Call ringtone setting (android Settings › Notifications); off, calls only show. */
  constructor(private readonly enabled: () => boolean = () => true) {}

  start(): void {
    if (this.ctx || typeof AudioContext === "undefined" || !this.enabled()) return;
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      void ctx.resume().catch(() => undefined);
      void loadSound(ctx, RINGTONE_SOUND).then((buffer) => {
        if (this.ctx !== ctx) return; // stopped meanwhile
        if (buffer) {
          this.loop = playBuffer(ctx, buffer, FILE_VOLUME, true);
          return;
        }
        this.ring();
        this.timer = setInterval(() => this.ring(), PATTERN_MS);
      });
    } catch {
      this.stop();
    }
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    try {
      this.loop?.stop();
    } catch {
      /* already stopped */
    }
    this.loop = null;
    const ctx = this.ctx;
    this.ctx = null;
    void ctx?.close().catch(() => undefined);
  }

  private ring(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime + 0.05;
    for (const tone of TONES) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = tone.hz;
      gain.gain.setValueAtTime(0, t0 + tone.at);
      gain.gain.linearRampToValueAtTime(VOLUME, t0 + tone.at + 0.03);
      gain.gain.setValueAtTime(VOLUME, t0 + tone.at + TONE_S - 0.05);
      gain.gain.linearRampToValueAtTime(0, t0 + tone.at + TONE_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + tone.at);
      osc.stop(t0 + tone.at + TONE_S);
    }
  }
}
