/**
 * A soft two-tone ring made with Web Audio (no sound file). Browsers may block sound until the page has been clicked;
 * then the ring is silent and the incoming-call card and system notification carry the call.
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

export class Ringtone {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;

  start(): void {
    if (this.ctx || typeof AudioContext === "undefined") return;
    try {
      this.ctx = new AudioContext();
      void this.ctx.resume().catch(() => undefined);
      this.ring();
      this.timer = setInterval(() => this.ring(), PATTERN_MS);
    } catch {
      this.stop();
    }
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
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
