import type { TrackAudit } from "./frameAudit";
import type { MediaSecurity } from "./types";

/**
 * Decides what the call's encryption badge may claim, from evidence only (android MediaSecurityTracker, rule D-17;
 * one instance per media connection).
 *
 * The evidence is the worker's frame audit (`frameAudit.ts`): a track is proven once a frame of it was encrypted or
 * authenticated-and-decrypted with the call's key, and failing while frames arrive but none can be decrypted (wrong
 * or missing key) or one would have crossed unencrypted. LiveKit's own encryption errors for a participant also mark
 * their tracks failing until they decrypt again.
 *
 * `encrypted` only when every live track (published or subscribed, not muted) is proven and at least one is remote;
 * `problem` when any current track is failing; otherwise `verifying`. Removed tracks are forgotten and their late
 * reports ignored.
 */
type TrackState = "proven" | "failing";

/** Frames that reached the cryptor in one report without a single one decrypting: failing (not a slow start). */
export const FAILING_FRAMES = 3;

interface Track {
  identity: string;
  remote: boolean;
  muted: boolean;
}

export class MediaSecurityTracker {
  private tracks = new Map<string, Track>();
  /** States by track key; may arrive before the track is registered, and count only once it is. */
  private states = new Map<string, TrackState>();
  private removed = new Set<string>();

  constructor(private readonly maxRemembered = 2048) {}

  static key(identity: string, trackId: string): string {
    return `${identity}|${trackId}`;
  }

  trackAdded(key: string, identity: string, remote: boolean, muted: boolean): void {
    if (this.removed.delete(key)) this.states.delete(key); // re-added: earlier states belonged to the old pipeline
    this.tracks.set(key, { identity, remote, muted });
  }

  trackMuted(key: string, muted: boolean): void {
    const t = this.tracks.get(key);
    if (t) this.tracks.set(key, { ...t, muted });
  }

  trackRemoved(key: string): void {
    this.tracks.delete(key);
    this.states.delete(key);
    this.removed.add(key);
    if (this.removed.size > this.maxRemembered) this.removed.delete(this.removed.values().next().value as string);
  }

  participantLeft(identity: string): void {
    const prefix = `${identity}|`;
    for (const k of [...this.tracks.keys(), ...this.states.keys()]) if (k.startsWith(prefix)) this.trackRemoved(k);
  }

  /** One worker report for one track. Returns false if it was ignored (the track was removed). */
  audit(a: TrackAudit): boolean {
    const key = MediaSecurityTracker.key(a.participantIdentity, a.trackId);
    if (this.removed.has(key)) return false;
    if (a.verified > 0 && a.unencrypted === 0) this.states.set(key, "proven");
    else if (a.unencrypted > 0 || a.frames - a.injected >= FAILING_FRAMES) this.states.set(key, "failing");
    return true;
  }

  /** LiveKit reported an encryption error for [identity]'s media: their received tracks fail until they decrypt again. */
  participantError(identity: string): void {
    for (const [k, t] of this.tracks) if (t.identity === identity && t.remote) this.states.set(k, "failing");
  }

  /** [key] has decrypted (or encrypted) a frame with the call's key and hasn't failed since. */
  proven(key: string): boolean {
    return this.tracks.has(key) && this.states.get(key) === "proven";
  }

  /** Every track and what's known about it (diagnostics; keys are identities and track ids, never key material). */
  snapshot(): { key: string; remote: boolean; muted: boolean; state: TrackState | null }[] {
    return [...this.tracks.entries()].map(([key, t]) => ({ key, remote: t.remote, muted: t.muted, state: this.states.get(key) ?? null }));
  }

  /** Identities whose tracks fail (a warning on that person's tile). */
  problemIdentities(): Set<string> {
    const out = new Set<string>();
    for (const [k, t] of this.tracks) if (this.states.get(k) === "failing") out.add(t.identity);
    return out;
  }

  security(): MediaSecurity {
    const current = [...this.tracks.entries()];
    if (current.some(([k]) => this.states.get(k) === "failing")) return "problem";
    const live = current.filter(([, t]) => !t.muted);
    const proven = live.length > 0 && live.some(([, t]) => t.remote) && live.every(([k]) => this.states.get(k) === "proven");
    return proven ? "encrypted" : "verifying";
  }
}
