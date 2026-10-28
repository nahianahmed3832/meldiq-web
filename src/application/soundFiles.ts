/**
 * Meldiq's own sounds (2026-10-28, chosen by the owner): the notification bell for new messages and the classic phone
 * ring for incoming calls, served from /sounds (same origin, so the CSP stays as it is). Each file is fetched and
 * decoded once per audio context; until then, or if it can't load, the callers fall back to their synthesized tones.
 */
export const NOTIFICATION_SOUND = "/sounds/meldiq-notification.mp3";
export const RINGTONE_SOUND = "/sounds/meldiq-ringtone.mp3";

const decoded = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer | null>>>();

/** The decoded sound at [url] for [ctx], or null when it can't be fetched or decoded (offline on first use, an old browser). */
export function loadSound(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  let byUrl = decoded.get(ctx);
  if (!byUrl) decoded.set(ctx, (byUrl = new Map()));
  let p = byUrl.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    byUrl.set(url, p);
  }
  return p;
}

/** Plays [buffer] once (or looping) at [gain]; answers the source so a loop can be stopped. */
export function playBuffer(ctx: AudioContext, buffer: AudioBuffer, gain: number, loop = false): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buffer;
  src.loop = loop;
  g.gain.value = gain;
  src.connect(g).connect(ctx.destination);
  src.start();
  return src;
}
