/**
 * The in-app sound for a new message (community-first brief §D): a short two-note chime made with Web Audio (no sound
 * file), for messages the notification pipeline lets through (engine.notifyIncoming: not yours, not the conversation
 * you're reading, not muted or paused).
 *
 * - Browsers allow sound only after the person has interacted with the page: the audio context is created on their first
 *   click or key press here, never at load. Until then [state] is "locked" and Settings › Notifications says so.
 * - A burst of messages plays one chime: at most one per CHIME_GAP_MS, across every open tab of this browser (one tab
 *   takes a Web Lock for the gap; without Web Locks, a timestamp in localStorage does the same).
 */
export const CHIME_GAP_MS = 1_500;
const LOCK = "meldiq-message-chime";
const LAST_KEY = "meldiq.chime.last";
const NOTES = [
  { at: 0, hz: 880 },
  { at: 0.11, hz: 1318.5 },
];
const NOTE_S = 0.16;
/** The loudest the chime gets, at volume 100: quieter than the ringtone. */
const PEAK = 0.12;

export type ChimeState = "locked" | "ready" | "unsupported";

let ctx: AudioContext | null = null;
let listening = false;

export function chimeState(): ChimeState {
  if (typeof AudioContext === "undefined") return "unsupported";
  return ctx && ctx.state === "running" ? "ready" : "locked";
}

/** Waits for the first click or key press, then prepares audio (call once at start). */
export function armChimeOnInteraction(): void {
  if (listening || typeof window === "undefined" || typeof AudioContext === "undefined") return;
  listening = true;
  const unlock = () => {
    void unlockChime();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

/** Creates or resumes the audio context; call from a user gesture (also the Settings "Play a test sound" button). */
export async function unlockChime(): Promise<ChimeState> {
  if (typeof AudioContext === "undefined") return "unsupported";
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    /* blocked: stays locked */
  }
  return chimeState();
}

/** Plays the chime at [volume] (0–100) unless another chime played within the gap, in this tab or another. */
export function playChime(volume: number): void {
  if (!ctx || ctx.state !== "running" || volume <= 0) return;
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) {
    void locks
      .request(LOCK, { ifAvailable: true }, async (lock) => {
        if (!lock) return;
        sound(volume);
        await new Promise((r) => setTimeout(r, CHIME_GAP_MS));
      })
      .catch(() => undefined);
    return;
  }
  if (!claimGap(Date.now())) return;
  sound(volume);
}

/** Without Web Locks: the gap through localStorage (best effort; private windows just play). */
function claimGap(now: number): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_KEY) ?? 0);
    if (now - last < CHIME_GAP_MS) return false;
    localStorage.setItem(LAST_KEY, String(now));
  } catch {
    /* no storage: play */
  }
  return true;
}

function sound(volume: number): void {
  const c = ctx;
  if (!c) return;
  const peak = (PEAK * Math.min(100, volume)) / 100;
  const t0 = c.currentTime + 0.02;
  for (const n of NOTES) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = n.hz;
    gain.gain.setValueAtTime(0, t0 + n.at);
    gain.gain.linearRampToValueAtTime(peak, t0 + n.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + NOTE_S);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + NOTE_S + 0.02);
  }
}
