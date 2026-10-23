/**
 * Several people can share their screens in one call at once (2026-10-24, like Discord's streams): each share is keyed
 * by its participant and track, and each viewer picks which one to watch, locally. Pure, unit-tested in
 * test/call-shares.test.ts.
 */

/** How many screens may be shared in one call at once (each viewer still receives only the one it watches). */
export const MAX_SCREEN_SHARES = 3;

/** One live screen share in the call. */
export interface CallShareView {
  /** `<identity>#<track sid>`: a new share (or a rejoin) gets a new key. */
  key: string;
  identity: string;
  userId: string;
  name: string;
  isLocal: boolean;
  /** The share's sound comes along. */
  withAudio: boolean;
  /** Its frames can be shown: yours, or someone else's once proven to decrypt with the call key (only while watched). */
  ready: boolean;
}

export const shareKey = (identity: string, trackSid: string): string => `${identity}#${trackSid}`;

export const shareIdentity = (key: string): string => key.slice(0, Math.max(0, key.lastIndexOf("#")));

/**
 * The share this viewer watches next, after the call's shares changed.
 * - The one watched is still live: keep it (a new share never takes over).
 * - It ended: the same person's new share if they shared again (a republish or a rejoin), else another share, else none
 *   (back to the people).
 * - None watched: the first share starts showing unless the viewer went back to the people themselves ([dismissed]);
 *   then shares wait in the tray until picked.
 * Your own share is never watched here (it would show itself).
 */
export function nextWatched(watching: string | null, dismissed: boolean, shares: readonly CallShareView[]): string | null {
  const watchable = shares.filter((s) => !s.isLocal);
  if (watching && watchable.some((s) => s.key === watching)) return watching;
  if (watching) {
    const identity = shareIdentity(watching);
    return (watchable.find((s) => s.identity === identity) ?? watchable[0])?.key ?? null;
  }
  return dismissed ? null : (watchable[0]?.key ?? null);
}

/** Whether this browser may start sharing now: fewer than [max] others are sharing. */
export function mayShare(shares: readonly CallShareView[], max = MAX_SCREEN_SHARES): boolean {
  return shares.filter((s) => !s.isLocal).length < max;
}
